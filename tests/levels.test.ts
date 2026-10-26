import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BIOMES } from '../src/games/platformer/biomes';
import { type LevelEntry, LevelManager, memoryStorage } from '../src/games/platformer/level/LevelManager';
import { analyzeReachability, validateLevel } from '../src/games/platformer/level/LevelValidator';
import { parseLevel, type LevelData } from '../src/games/platformer/level/LevelParser';
import { ENEMY_SPRITES } from '../src/games/platformer/assets/enemySprites';
import { buildEnemyCatalog } from '../src/games/platformer/enemies/EnemyCatalog';

const LEVELS_DIR = join(__dirname, '../public/assets/platformer/levels');
const BIOME_IDS = Object.keys(BIOMES);
const ENEMIES = buildEnemyCatalog(
  JSON.parse(readFileSync(join(__dirname, '../public/assets/platformer/enemies/enemies.json'), 'utf8')),
  Object.keys(ENEMY_SPRITES),
).enemies;
const registry = JSON.parse(readFileSync(join(LEVELS_DIR, 'levels.json'), 'utf8')) as { levels: string[] };
const load = (file: string): unknown => JSON.parse(readFileSync(join(LEVELS_DIR, file), 'utf8'));

/** Minimal level: flat ground, spawn on the left, portal on the right, custom middle section. */
function level(middle: string[], extra: Partial<LevelData> = {}): LevelData {
  return {
    id: 'test',
    name: 'Test',
    biome: 'forest',
    height: 12,
    sections: [
      { rows: ['.P........', '##########', '##########'] },
      { rows: middle },
      { rows: ['.........O', '##########', '##########'] },
    ],
    ...extra,
  };
}

const errors = (raw: unknown): string[] => validateLevel(raw, BIOME_IDS, ENEMIES).issues.filter((i) => i.severity === 'error').map((i) => i.message);

describe('campaign levels (public/assets/platformer/levels)', () => {
  it('registers at least three levels', () => {
    expect(registry.levels.length).toBeGreaterThanOrEqual(3);
  });

  it.each(registry.levels)('%s is valid and completable without abilities', (file) => {
    const result = validateLevel(load(file), BIOME_IDS, ENEMIES);
    expect(result.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('introduces new enemy behaviours level by level (configured in JSON)', () => {
    const defsPerLevel = registry.levels.map((f) => parseLevel(load(f) as LevelData).enemies.map((e) => ENEMIES[e.type]));
    const [l1, l2, l3, l4] = defsPerLevel;
    expect(l1.every((e) => e.maxHealth === 1 && !e.attack)).toBe(true);
    expect(l2.some((e) => e.speed > ENEMIES.walker.speed) && l2.some((e) => e.maxHealth > 1)).toBe(true);
    expect(l3.some((e) => e.movement === 'fly') && l3.some((e) => e.attack?.kind === 'shoot')).toBe(true);
    expect(l4.some((e) => e.boss) && l4.some((e) => e.stomp === 'immune')).toBe(true);
    expect(new Set(l4.map((e) => e.movement)).size).toBeGreaterThanOrEqual(3);
  });

  it('uses unique ids and at least three different biomes', () => {
    const levels = registry.levels.map((f) => load(f) as LevelData);
    expect(new Set(levels.map((l) => l.id)).size).toBe(levels.length);
    expect(new Set(levels.map((l) => l.biome)).size).toBeGreaterThanOrEqual(3);
  });

  it('ramps up difficulty (floor gaps + 3 x enemies never decreases)', () => {
    const scores = registry.levels.map((f) => {
      const parsed = parseLevel(load(f) as LevelData);
      const floor = parsed.terrain[parsed.height - 1];
      const gaps = floor.filter((cell) => !cell).length;
      return gaps + parsed.enemies.length * 3;
    });
    for (let i = 1; i < scores.length; i++) expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
  });
});

describe('level validator', () => {
  it('accepts a simple flat level', () => {
    expect(errors(level(['..........', '##########', '##########']))).toEqual([]);
  });

  it('accepts a 4-tile gap (within jump distance)', () => {
    expect(errors(level(['..........', '###....###', '###....###']))).toEqual([]);
  });

  it('rejects a 7-tile gap as impossible', () => {
    expect(errors(level(['..........', '#.......##', '#.......##'])).join()).toMatch(/meta .* inalcanzable/);
  });

  it('accepts a 3-tile step up but rejects a 5-tile wall', () => {
    expect(errors(level(['.....#####', '.....#####', '.....#####', '##########', '##########']))).toEqual([]);
    const wall = ['.....#####', '.....#####', '.....#####', '.....#####', '.....#####', '##########', '##########'];
    expect(errors(level(wall)).join()).toMatch(/inalcanzable/);
  });

  it('reports unreachable stars', () => {
    const msgs = errors(level(['.....S....', '', '', '', '', '', '', '', '##########', '##########']));
    expect(msgs.join()).toMatch(/estrella .* inalcanzable/);
  });

  it('allows climbing through one-way platforms', () => {
    const tower = ['.....S....', '....===...', '', '', '.....===..', '', '', '....===...', '##########', '##########'];
    expect(errors(level(tower))).toEqual([]);
  });

  it('detects structural problems', () => {
    expect(errors(level(['..........', '##########', '##########'], { enemies: { B: 'dragon' } })).join()).toMatch(/tipo desconocido/);
    expect(errors(level(['..........', '##########', '##########'], { enemies: { S: 'bat' } })).join()).toMatch(/no reservada/);
    expect(errors(level(['....B.....', '##########', '##########'], { enemies: { B: 'bat' } }))).toEqual([]);
    expect(errors(null).length).toBeGreaterThan(0);
    expect(errors(level(['..........', '##########', '##########'], { biome: 'moon' })).join()).toMatch(/biome/);
    expect(errors(level(['....Z.....', '##########', '##########'])).join()).toMatch(/no válido/);
    expect(errors({ ...level(['P.........', '##########', '##########']) }).join()).toMatch(/exactamente un punto de aparición/);
    expect(errors(level(['..........', '##########'], { height: 3 })).join()).toMatch(/height/);
  });

  it('exposes the reachable area', () => {
    const reach = analyzeReachability(parseLevel(level(['..........', '##########', '##########'])));
    expect(reach.standing.size).toBeGreaterThan(20);
  });
});

describe('LevelManager progress', () => {
  const entries = (): LevelEntry[] =>
    ['a', 'b', 'c'].map((id, index) => ({
      index,
      file: `${id}.json`,
      id,
      name: id,
      biome: 'forest',
      data: null,
      validation: { ok: true, issues: [] },
    }));

  it('unlocks levels in order and keeps the best result', () => {
    const storage = memoryStorage();
    const manager = new LevelManager(entries(), storage);
    expect(manager.isUnlocked('a')).toBe(true);
    expect(manager.isUnlocked('b')).toBe(false);

    expect(manager.complete('a', { stars: 2, total: 5 })?.id).toBe('b');
    expect(manager.isUnlocked('b')).toBe(true);
    expect(manager.isUnlocked('c')).toBe(false);

    manager.complete('a', { stars: 1, total: 5 });
    expect(manager.best('a')?.stars).toBe(2);

    const reloaded = new LevelManager(entries(), storage);
    expect(reloaded.isUnlocked('b')).toBe(true);
    expect(reloaded.latestUnlocked()?.id).toBe('b');
  });

  it('skips invalid levels when unlocking', () => {
    const list = entries();
    list[1].validation = { ok: false, issues: [] };
    const manager = new LevelManager(list, memoryStorage());
    expect(manager.complete('a', { stars: 0, total: 0 })?.id).toBe('c');
    expect(manager.isUnlocked('b')).toBe(false);
  });

  it('survives corrupt saved data', () => {
    const storage = memoryStorage();
    storage.save('{not json');
    expect(new LevelManager(entries(), storage).isUnlocked('a')).toBe(true);
  });
});
