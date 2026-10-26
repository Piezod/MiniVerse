import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildAbilityCatalog } from '../src/games/platformer/abilities/AbilityCatalog';
import { flameTickDamage } from '../src/games/platformer/abilities/formulas';
import { ABILITY_MODULE_IDS } from '../src/games/platformer/abilities/moduleIds';
import { ENEMY_SPRITES } from '../src/games/platformer/assets/enemySprites';
import { computeDamage, Health } from '../src/games/platformer/combat/damage';
import { Cooldown, EnergyPool } from '../src/games/platformer/combat/resources';
import { nextAiState } from '../src/games/platformer/enemies/ai';
import { buildEnemyCatalog, type EnemyDef } from '../src/games/platformer/enemies/EnemyCatalog';
import { memoryStorage } from '../src/games/platformer/level/LevelManager';
import { buildCatalogs } from '../src/games/platformer/progression/gameData';
import { MAX_ACTIVE_ABILITIES, Profile } from '../src/games/platformer/progression/Profile';

const ASSETS = join(__dirname, '../public/assets/platformer');
const readJson = (path: string): unknown => JSON.parse(readFileSync(join(ASSETS, path), 'utf8'));
const SPRITES = Object.keys(ENEMY_SPRITES);
const catalogs = buildCatalogs({
  elements: readJson('combat/elements.json'),
  statuses: readJson('combat/status-effects.json'),
  enemies: readJson('enemies/enemies.json'),
  abilities: readJson('abilities/abilities.json'),
});
const { enemies, abilities } = catalogs;

describe('damage model', () => {
  it('applies resistances, armor and immunity', () => {
    expect(computeDamage({ amount: 2, form: 'projectile', element: 'energy' }, { armor: 0, resist: {} })).toBe(2);
    expect(computeDamage({ amount: 2, form: 'projectile', element: 'energy' }, { armor: 0, resist: { energy: 0.5 } })).toBe(1);
    expect(computeDamage({ amount: 2, form: 'area', element: 'fire' }, { armor: 0, resist: { fire: 2 } })).toBe(4);
    expect(computeDamage({ amount: 2, form: 'stomp' }, { armor: 0, resist: {}, formResist: { stomp: 0 } })).toBe(0);
    expect(computeDamage({ amount: 2, form: 'projectile' }, { armor: 1.5, resist: {} })).toBe(0.5);
    expect(computeDamage({ amount: 1, form: 'projectile' }, { armor: 3, resist: {} })).toBe(0);
  });

  it('tracks health, kills once and never goes below zero', () => {
    const hp = new Health(3);
    expect(hp.apply({ amount: 1, form: 'contact' })).toEqual({ damage: 1, killed: false, immune: false });
    expect(hp.fraction).toBeCloseTo(2 / 3);
    expect(hp.apply({ amount: 5, form: 'contact' })).toEqual({ damage: 2, killed: true, immune: false });
    expect(hp.current).toBe(0);
    expect(hp.apply({ amount: 1, form: 'contact' })).toEqual({ damage: 0, killed: false, immune: false });
    hp.heal(1);
    expect(hp.current).toBe(0);
    hp.reset();
    expect(hp.current).toBe(3);
  });
});

describe('cooldowns and energy', () => {
  it('cooldown blocks until it elapses', () => {
    const cd = new Cooldown(0.5);
    expect(cd.trigger()).toBe(true);
    expect(cd.trigger()).toBe(false);
    cd.update(0.25);
    expect(cd.remaining).toBeCloseTo(0.5);
    cd.update(0.25);
    expect(cd.ready).toBe(true);
  });

  it('energy is spent all-or-nothing, drained partially and regenerates after a delay', () => {
    const energy = new EnergyPool(100, 20, 0.5);
    expect(energy.tryConsume(30)).toBe(true);
    expect(energy.tryConsume(80)).toBe(false);
    expect(energy.current).toBe(70);
    expect(energy.drain(100)).toBe(70);
    energy.update(0.4);
    expect(energy.current).toBe(0);
    energy.update(0.5);
    expect(energy.current).toBeCloseTo(10);
  });

  it('flamethrower damage ramps while held and is capped', () => {
    expect(flameTickDamage(0, 0.2, 0.6, 0.8)).toBeCloseTo(0.2);
    expect(flameTickDamage(0.5, 0.2, 0.6, 0.8)).toBeCloseTo(0.5);
    expect(flameTickDamage(10, 0.2, 0.6, 0.8)).toBe(0.8);
  });
});

describe('enemy configuration (enemies.json)', () => {
  it('has no configuration errors', () => {
    expect(catalogs.issues).toEqual([]);
  });

  it('provides a ground patroller, a flying chaser and a multi-hit tough enemy', () => {
    const list = Object.values(enemies.enemies);
    expect(list.some((e) => e.movement === 'patrol' && e.maxHealth === 1)).toBe(true);
    expect(list.some((e) => e.movement === 'fly' && e.detectRange > 0)).toBe(true);
    expect(list.some((e) => e.maxHealth >= 4 && e.stomp === 'immune')).toBe(true);
    expect(list.some((e) => e.attack?.kind === 'shoot')).toBe(true);
    expect(list.some((e) => e.boss)).toBe(true);
  });

  it('resolves variants with extends (inherit + override)', () => {
    const fast = enemies.enemies['walker-fast'];
    expect(fast.sprite).toBe('walker');
    expect(fast.maxHealth).toBe(1);
    expect(fast.speed).toBeGreaterThan(enemies.enemies.walker.speed);
    expect(enemies.enemies['magma-king'].guard).toBe(enemies.enemies.golem.guard);
  });

  it('rejects invalid definitions', () => {
    const bad = buildEnemyCatalog(
      {
        a: { sprite: 'nope', maxHealth: 1 },
        b: { sprite: 'walker', maxHealth: -1 },
        c: { extends: 'missing' },
        d: { extends: 'e' },
        e: { extends: 'd' },
        f: { sprite: 'golem', maxHealth: 5, stomp: 'immune', boss: true },
        g: { sprite: 'walker', maxHealth: 1, movement: 'teleport' },
      },
      SPRITES,
    );
    expect(Object.keys(bad.enemies)).toEqual([]);
    const text = bad.issues.map((i) => `${i.id}: ${i.message}`).join('\n');
    for (const pattern of [/a: "sprite"/, /b: "maxHealth"/, /c: "extends"/, /circular/, /f: un jefe/, /g: "movement"/]) expect(text).toMatch(pattern);
  });
});

describe('enemy AI states', () => {
  const base: EnemyDef = enemies.enemies.walker;
  const snap = { dead: false, hurtTime: 0, attackTime: 0, distance: Infinity, attackReady: true };

  it('patrols, gets hurt and dies', () => {
    expect(nextAiState(base, snap)).toBe('patrol');
    expect(nextAiState(base, { ...snap, hurtTime: 0.1 })).toBe('hurt');
    expect(nextAiState(base, { ...snap, dead: true, hurtTime: 0.1 })).toBe('death');
  });

  it('flying enemies idle until they see the player, then chase', () => {
    const bat = enemies.enemies.bat;
    expect(nextAiState(bat, snap)).toBe('idle');
    expect(nextAiState(bat, { ...snap, distance: bat.detectRange - 1 })).toBe('chase');
  });

  it('ranged enemies attack in range only when the cooldown is ready', () => {
    const spitter = enemies.enemies.spitter;
    expect(nextAiState(spitter, { ...snap, distance: 100 })).toBe('attack');
    expect(nextAiState(spitter, { ...snap, distance: 100, attackReady: false })).toBe('idle');
    expect(nextAiState(spitter, { ...snap, distance: 400 })).toBe('idle');
  });
});

describe('ability configuration (abilities.json)', () => {
  it('has no configuration errors and includes the three abilities', () => {
    expect(abilities.issues).toEqual([]);
    expect(Object.keys(abilities.abilities)).toEqual(expect.arrayContaining(['jetpack', 'beam', 'flamethrower']));
    for (const def of Object.values(abilities.abilities)) {
      expect(def.levels.length).toBeGreaterThan(0);
      def.levels.forEach((l) => expect(Number.isInteger(l.cost)).toBe(true));
    }
  });

  it('rejects unknown modules and bad levels', () => {
    const bad = buildAbilityCatalog({ x: { name: 'X', module: 'laser', slot: 'active', levels: [{ cost: -1 }] } }, ABILITY_MODULE_IDS);
    expect(bad.abilities).toEqual({});
    expect(bad.issues.map((i) => i.message).join()).toMatch(/module.*cost/s);
  });
});

describe('profile: stars, purchases and equipment', () => {
  const completed = new Set<string>();
  const isCompleted = (id: string): boolean => completed.has(id);
  const fresh = (storage = memoryStorage()): Profile => new Profile(abilities, storage);

  it('counts each star only once, even when replaying', () => {
    const profile = fresh();
    expect(profile.recordStars('forest-1', ['1,2', '3,4'])).toBe(2);
    expect(profile.recordStars('forest-1', ['1,2', '3,4', '5,6'])).toBe(1);
    expect(profile.recordStars('ice-1', ['1,2'])).toBe(1);
    expect(profile.balance).toBe(4);
  });

  it('validates purchases: funds, requirements and max level', () => {
    completed.clear();
    const profile = fresh();
    expect(profile.purchase('beam', isCompleted)).toMatchObject({ ok: false, reason: 'funds' });
    profile.recordStars('forest-1', Array.from({ length: 30 }, (_, i) => `${i},0`));
    expect(profile.purchase('jetpack', isCompleted)).toMatchObject({ ok: false, reason: 'locked' });
    expect(profile.purchase('beam', isCompleted)).toMatchObject({ ok: true, cost: 8, nextLevel: 1 });
    expect(profile.balance).toBe(22);
    expect(profile.purchase('beam', isCompleted)).toMatchObject({ ok: true, cost: 18 });
    expect(profile.balance).toBe(4);
    expect(profile.purchase('beam', isCompleted)).toMatchObject({ ok: false, reason: 'funds' });
    expect(profile.balance).toBe(4);
    completed.add('forest-1');
    expect(profile.canPurchase('jetpack', isCompleted)).toMatchObject({ ok: false, reason: 'funds' });
    expect(profile.purchase('unknown', isCompleted)).toMatchObject({ ok: false, reason: 'unknown' });
  });

  it('auto-equips new abilities and limits active slots', () => {
    completed.add('forest-1').add('ruins-1');
    const profile = fresh();
    profile.recordStars('x', Array.from({ length: 100 }, (_, i) => `${i},0`));
    profile.purchase('beam', isCompleted);
    profile.purchase('flamethrower', isCompleted);
    profile.purchase('jetpack', isCompleted);
    expect(profile.activeSlots).toEqual(['beam', 'flamethrower']);
    expect(profile.isEquipped('jetpack')).toBe(true);
    expect(profile.activeSlots.length).toBeLessThanOrEqual(MAX_ACTIVE_ABILITIES);
    profile.unequip('beam');
    expect(profile.activeSlots).toEqual(['flamethrower']);
    expect(profile.equip('beam')).toBe(true);
    expect(profile.equippedOn('primary')).toBe('beam');
    expect(profile.loadout().map((l) => [l.def.id, l.button])).toEqual([
      ['jetpack', null],
      ['beam', 'primary'],
      ['flamethrower', 'secondary'],
    ]);
    expect(fresh().equip('beam')).toBe(false);
  });

  it('persists and reloads purchases, equipment and wallet', () => {
    completed.add('forest-1');
    const storage = memoryStorage();
    const profile = fresh(storage);
    profile.recordStars('forest-1', Array.from({ length: 20 }, (_, i) => `${i},0`));
    profile.purchase('jetpack', isCompleted);
    const reloaded = fresh(storage);
    expect(reloaded.levelOf('jetpack')).toBe(1);
    expect(reloaded.isEquipped('jetpack')).toBe(true);
    expect(reloaded.balance).toBe(8);
  });

  it('sanitizes tampered saves (no negative balance, no unknown abilities)', () => {
    const storage = memoryStorage();
    storage.save(JSON.stringify({ collected: { a: ['1', '1', '2'] }, spent: 999, owned: { beam: 99, hack: 3 }, equipped: ['hack', 'beam'] }));
    const profile = fresh(storage);
    expect(profile.earned).toBe(2);
    expect(profile.balance).toBe(0);
    expect(profile.levelOf('beam')).toBe(abilities.abilities.beam.levels.length);
    expect(profile.levelOf('hack')).toBe(0);
    expect(profile.equipped).toEqual(['beam']);
  });
});
