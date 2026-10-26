import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildAbilityCatalog } from '../src/games/platformer/abilities/AbilityCatalog';
import { ABILITY_MODULE_IDS, PLANNED_MODULE_IDS } from '../src/games/platformer/abilities/moduleIds';
import { ENEMY_SPRITES } from '../src/games/platformer/assets/enemySprites';
import { computeDamage, damageBreakdown, type Defense, Health } from '../src/games/platformer/combat/damage';
import { buildElementChart, NEUTRAL_CHART } from '../src/games/platformer/combat/elements';
import { buildStatusCatalog, rollEffects, StatusEffects } from '../src/games/platformer/combat/status';
import { buildEnemyCatalog } from '../src/games/platformer/enemies/EnemyCatalog';
import { memoryStorage } from '../src/games/platformer/level/LevelManager';
import { type LevelData, parseLevel } from '../src/games/platformer/level/LevelParser';
import { buildCatalogs } from '../src/games/platformer/progression/gameData';
import { migrateProfile, Profile, PROFILE_VERSION } from '../src/games/platformer/progression/Profile';
import { weaponSummary } from '../src/games/platformer/progression/weaponInfo';

const ASSETS = join(__dirname, '../public/assets/platformer');
const readJson = (path: string): unknown => JSON.parse(readFileSync(join(ASSETS, path), 'utf8'));
const data = buildCatalogs({
  elements: readJson('combat/elements.json'),
  statuses: readJson('combat/status-effects.json'),
  enemies: readJson('enemies/enemies.json'),
  abilities: readJson('abilities/abilities.json'),
});
const { chart, statuses, enemies, abilities } = data;
const ELEMENTS = ['energy', 'laser', 'plasma', 'cryo', 'fire'];

describe('affinity chart (elements.json)', () => {
  it('loads the five elements without issues', () => {
    expect(data.issues).toEqual([]);
    expect(Object.keys(chart.elements)).toEqual(ELEMENTS);
  });

  it('follows the cycle Energía → Láser → Plasma → Criogénico → Fuego → Energía', () => {
    ELEMENTS.forEach((attacker, i) => {
      const beaten = ELEMENTS[(i + 1) % ELEMENTS.length];
      expect(chart.multiplier(attacker, beaten)).toBe(1.5);
      expect(chart.multiplier(beaten, attacker)).toBe(0.5);
      expect(chart.strongAgainst(attacker)).toEqual([beaten]);
    });
  });

  it('every other combination is neutral, including same-type and untyped', () => {
    let neutral = 0;
    for (const a of ELEMENTS)
      for (const d of ELEMENTS) {
        const i = ELEMENTS.indexOf(a);
        const j = ELEMENTS.indexOf(d);
        const adjacent = (j - i + 5) % 5 === 1 || (i - j + 5) % 5 === 1;
        if (!adjacent) {
          expect(chart.multiplier(a, d)).toBe(1);
          neutral++;
        }
      }
    expect(neutral).toBe(15);
    expect(chart.multiplier(null, 'fire')).toBe(1);
    expect(chart.multiplier('fire', null)).toBe(1);
    expect(chart.multiplier('unknown', 'fire')).toBe(1);
  });

  it('is configurable: custom multipliers, cycle and overrides', () => {
    const { chart: custom, issues } = buildElementChart({
      elements: { a: { name: 'A', color: '#ffffff' }, b: { name: 'B', color: '#000000' }, c: { name: 'C', color: '#ff0000' } },
      cycle: ['a', 'b', 'c'],
      advantage: 2,
      disadvantage: 0.25,
      overrides: { c: { c: 0 } },
    });
    expect(issues).toEqual([]);
    expect(custom.multiplier('a', 'b')).toBe(2);
    expect(custom.multiplier('b', 'a')).toBe(0.25);
    expect(custom.multiplier('c', 'a')).toBe(2);
    expect(custom.multiplier('c', 'c')).toBe(0);
  });

  it('reports invalid configuration', () => {
    const { issues } = buildElementChart({ elements: { a: { name: 'A', color: 'red' } }, cycle: ['a', 'zzz'], advantage: -1 });
    expect(issues.map((i) => i.message).join('\n')).toMatch(/color.*\n.*advantage.*\n.*cycle/s);
  });
});

describe('unified damage calculation', () => {
  const plain: Defense = { armor: 0, resist: {} };

  it('applies affinity type vs type', () => {
    expect(computeDamage({ amount: 2, form: 'projectile', element: 'energy' }, { ...plain, element: 'laser' }, chart)).toBe(3);
    expect(computeDamage({ amount: 2, form: 'projectile', element: 'laser' }, { ...plain, element: 'energy' }, chart)).toBe(1);
    expect(computeDamage({ amount: 2, form: 'projectile', element: 'energy' }, { ...plain, element: 'cryo' }, chart)).toBe(2);
  });

  it('keeps decimals', () => {
    expect(computeDamage({ amount: 0.3, form: 'area', element: 'fire' }, { ...plain, element: 'energy' }, chart)).toBeCloseTo(0.45);
  });

  it('applies each factor once and in order: affinity, personal, form, situational, armor', () => {
    const b = damageBreakdown(
      { amount: 4, form: 'projectile', element: 'energy', situational: 0.5 },
      { element: 'laser', armor: 1, resist: { energy: 0.5 }, formResist: { projectile: 2 } },
      chart,
    );
    expect(b).toMatchObject({ base: 4, affinity: 1.5, personal: 0.5, form: 2, situational: 0.5, armor: 1 });
    // 4 × 1.5 × 0.5 × 2 × 0.5 = 3, then − 1 armor
    expect(b.total).toBe(2);
  });

  it('armor is flat and applied last; it can be ignored (damage over time)', () => {
    expect(computeDamage({ amount: 1, form: 'status' }, { armor: 1, resist: {} })).toBe(0);
    expect(computeDamage({ amount: 1, form: 'status', ignoreArmor: true }, { armor: 1, resist: {} })).toBe(1);
  });

  it('untyped hits ignore elemental resistances but not form resistances', () => {
    const defense: Defense = { element: 'fire', armor: 0, resist: { fire: 0 }, formResist: { stomp: 0.5 } };
    expect(computeDamage({ amount: 2, form: 'stomp' }, defense, chart)).toBe(1);
  });

  it('immunities by element or by form deal 0 and are reported', () => {
    const defense: Defense = { armor: 0, resist: {}, immune: ['fire', 'stomp'] };
    expect(computeDamage({ amount: 5, form: 'area', element: 'fire' }, defense, chart)).toBe(0);
    expect(computeDamage({ amount: 5, form: 'stomp' }, defense, chart)).toBe(0);
    expect(computeDamage({ amount: 5, form: 'projectile', element: 'energy' }, defense, chart)).toBe(5);
    expect(new Health(5).apply({ amount: 5, form: 'stomp' }, defense, chart)).toEqual({ damage: 0, killed: false, immune: true });
  });

  it('defaults to a neutral chart, so code without elements behaves as before', () => {
    expect(computeDamage({ amount: 2, form: 'projectile', element: 'energy' }, { ...plain, element: 'laser' }, NEUTRAL_CHART)).toBe(2);
  });
});

describe('enemy elements and weaknesses (enemies.json)', () => {
  it('every enemy has a valid main element', () => {
    for (const def of Object.values(enemies.enemies)) expect(ELEMENTS).toContain(def.element);
  });

  it('keeps previous stats, behaviours and defenses', () => {
    const golem = enemies.enemies.golem;
    expect(golem).toMatchObject({ maxHealth: 4, stomp: 'immune', guard: 0.5, resist: { fire: 0.5 } });
    expect(enemies.enemies['magma-king']).toMatchObject({ boss: true, maxHealth: 8, resist: { fire: 0.25 }, guard: 0.5 });
    expect(enemies.enemies['bat-frost'].resist.fire).toBe(2);
  });

  it('variants inherit and override elements', () => {
    expect(enemies.enemies['walker-fast'].element).toBe(enemies.enemies.walker.element);
    expect(enemies.enemies['bat-frost'].element).toBe('cryo');
    expect(enemies.enemies['bat-frost'].statusImmune).toContain('chill');
  });

  it('validates elements, form resistances, immunities and status immunities', () => {
    const bad = buildEnemyCatalog(
      {
        a: { sprite: 'walker', maxHealth: 1 },
        b: { sprite: 'walker', maxHealth: 1, element: 'water' },
        c: { sprite: 'walker', maxHealth: 1, element: 'fire', resist: { beam: 0.5 } },
        d: { sprite: 'walker', maxHealth: 1, element: 'fire', formResist: { kick: 0 } },
        e: { sprite: 'walker', maxHealth: 1, element: 'fire', immune: ['water'] },
        f: { sprite: 'walker', maxHealth: 1, element: 'fire', statusImmune: ['sleep'] },
        g: { sprite: 'golem', maxHealth: 5, element: 'fire', boss: true, immune: ['stomp'] },
      },
      Object.keys(ENEMY_SPRITES),
      { elements: ELEMENTS, statuses: Object.keys(statuses.effects) },
    );
    expect(Object.keys(bad.enemies)).toEqual([]);
    expect(new Set(bad.issues.map((i) => i.id))).toEqual(new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g']));
  });

  it('weapons now have a matchup against existing enemies', () => {
    const vs = (weapon: string, enemy: string, amount = 1): number => {
      const e = enemies.enemies[enemy];
      return computeDamage(
        { amount, form: 'projectile', element: abilities.abilities[weapon].element },
        { element: e.element, armor: e.armor, resist: e.resist, formResist: e.formResist, immune: e.immune },
        chart,
      );
    };
    // Fuego > Energía: the flamethrower is effective against energy robots.
    expect(vs('flamethrower', 'walker')).toBe(1.5);
    // Energía < Fuego: the beam is weak against fire enemies (spitter / magma king).
    expect(vs('beam', 'spitter')).toBe(0.5);
    // Criogénico > Fuego gives ×0.5, combined with the frost bat's personal fire vulnerability (×2) = ×1.
    expect(vs('flamethrower', 'bat-frost')).toBe(1);
    // Energía vs Plasma is neutral; the shellbot's personal energy resistance still applies.
    expect(vs('beam', 'shellbot')).toBe(0.5);
  });
});

describe('status effects (status-effects.json)', () => {
  const catalog = statuses.effects;
  const make = (element: string | null = null, immune: string[] = []): StatusEffects => new StatusEffects(catalog, { element, immune });

  it('loads burn, chill, freeze, overload and plasma residue without issues', () => {
    expect(statuses.issues).toEqual([]);
    expect(Object.keys(catalog)).toEqual(expect.arrayContaining(['burn', 'chill', 'freeze', 'overload', 'plasma-residue']));
  });

  it('burn deals periodic damage and expires', () => {
    const s = make('energy');
    expect(s.apply('burn')).toBe(true);
    const { duration, tick, intensity } = catalog.burn;
    const ticks = [];
    for (let t = 0; t < duration + 1; t += 0.05) ticks.push(...s.update(0.05));
    expect(ticks).toHaveLength(Math.round(duration / tick));
    expect(ticks[0]).toMatchObject({ amount: intensity, element: 'fire' });
    expect(s.has('burn')).toBe(false);
  });

  it('intensity stacking is capped by maxStacks', () => {
    const s = make();
    for (let i = 0; i < 10; i++) s.apply('burn');
    expect(s.stacks('burn')).toBe(catalog.burn.maxStacks);
  });

  it('extend stacking never exceeds maxDuration', () => {
    const s = make();
    for (let i = 0; i < 10; i++) s.apply('chill');
    expect(s.remaining('chill')).toBe(catalog.chill.maxDuration);
  });

  it('slow and stun change speed; overload increases damage taken (capped)', () => {
    const s = make();
    s.apply('chill');
    expect(s.speedMultiplier).toBe(catalog.chill.intensity);
    s.apply('freeze');
    expect(s.stunned).toBe(true);
    expect(s.speedMultiplier).toBe(0);
    s.apply('overload');
    expect(s.damageTakenMultiplier).toBe(catalog.overload.intensity);
    expect(s.damageTakenMultiplier).toBeLessThanOrEqual(3);
  });

  it('respects immunity rules: blocked by element and per-enemy immunity', () => {
    expect(make('fire').apply('burn')).toBe(false);
    expect(make('cryo').apply('chill')).toBe(false);
    expect(make('energy', ['burn']).apply('burn')).toBe(false);
    expect(make('energy').apply('unknown')).toBe(false);
  });

  it('nothing is permanent: every effect ends even when reapplied continuously within limits', () => {
    const s = make();
    for (const id of Object.keys(catalog)) s.apply(id);
    for (let t = 0; t < 25; t += 0.1) s.update(0.1);
    expect(s.ids).toEqual([]);
    expect(s.speedMultiplier).toBe(1);
    expect(s.damageTakenMultiplier).toBe(1);
  });

  it('freeze ignores reapplication while active (no stun-lock)', () => {
    const s = make();
    s.apply('freeze');
    s.update(0.5);
    expect(s.apply('freeze')).toBe(false);
    expect(s.remaining('freeze')).toBeCloseTo(catalog.freeze.duration - 0.5);
  });

  it('effects trigger according to their chance', () => {
    const effects = [{ id: 'burn', chance: 0.25 }, { id: 'chill' }];
    expect(rollEffects(effects, () => 0.1)).toEqual(['burn', 'chill']);
    expect(rollEffects(effects, () => 0.9)).toEqual(['chill']);
  });

  it('rejects invalid definitions', () => {
    const bad = buildStatusCatalog(
      {
        a: { kind: 'poison', duration: 1 },
        b: { kind: 'dot', duration: 999, tick: 1, intensity: 1 },
        c: { kind: 'slow', duration: 1, intensity: 2 },
        d: { kind: 'dot', duration: 1, tick: 0.5, intensity: 1, blockedBy: ['water'] },
      },
      ELEMENTS,
    );
    expect(bad.effects).toEqual({});
    expect(new Set(bad.issues.map((i) => i.id))).toEqual(new Set(['a', 'b', 'c', 'd']));
  });
});

describe('modular weapons (abilities.json)', () => {
  it('current weapons keep working with their elements', () => {
    expect(abilities.abilities.beam).toMatchObject({ element: 'energy', module: 'projectile', available: true });
    expect(abilities.abilities.flamethrower).toMatchObject({ element: 'fire', module: 'flamethrower', available: true });
  });

  it('planned weapons are declared but unavailable (cryo and plasma)', () => {
    for (const [id, element] of [
      ['cryo-cannon', 'cryo'],
      ['plasma-projector', 'plasma'],
    ]) {
      expect(abilities.abilities[id]).toMatchObject({ element, available: false });
      expect(PLANNED_MODULE_IDS).toContain(abilities.abilities[id].module);
    }
  });

  it('an unimplemented module can only be used by an unavailable weapon', () => {
    const level = [{ cost: 1 }];
    const result = buildAbilityCatalog(
      {
        ok: { name: 'Ok', module: 'cryo-spray', slot: 'active', element: 'cryo', available: false, levels: level },
        bad: { name: 'Bad', module: 'cryo-spray', slot: 'active', element: 'cryo', levels: level },
      },
      ABILITY_MODULE_IDS,
      { elements: ELEMENTS, plannedModules: PLANNED_MODULE_IDS },
    );
    expect(Object.keys(result.abilities)).toEqual(['ok']);
    expect(result.issues[0].message).toMatch(/available/);
  });

  it('two weapons can share an element and reuse a module with their own configuration', () => {
    const result = buildAbilityCatalog(
      {
        beam: { name: 'Beam', module: 'projectile', slot: 'active', element: 'energy', levels: [{ cost: 1, params: { damage: 1 } }] },
        spark: {
          name: 'Spark',
          module: 'projectile',
          slot: 'active',
          element: 'energy',
          levels: [{ cost: 2, energy: 5, cooldown: 0.2, params: { damage: 0.5, range: 60 }, effects: [{ id: 'overload', chance: 0.5 }] }],
        },
      },
      ABILITY_MODULE_IDS,
      { elements: ELEMENTS, statuses: Object.keys(statuses.effects) },
    );
    expect(result.issues).toEqual([]);
    expect(result.abilities.spark.levels[0].effects).toEqual([{ id: 'overload', chance: 0.5 }]);
  });

  it('validates weapon elements and effects', () => {
    const result = buildAbilityCatalog(
      {
        a: { name: 'A', module: 'projectile', slot: 'active', levels: [{ cost: 1 }] },
        b: { name: 'B', module: 'projectile', slot: 'active', element: 'water', levels: [{ cost: 1 }] },
        c: { name: 'C', module: 'projectile', slot: 'active', element: 'fire', levels: [{ cost: 1, effects: [{ id: 'sleep' }] }] },
        d: { name: 'D', module: 'projectile', slot: 'active', element: 'fire', levels: [{ cost: 1, effects: [{ id: 'burn', chance: 2 }] }] },
      },
      ABILITY_MODULE_IDS,
      { elements: ELEMENTS, statuses: Object.keys(statuses.effects) },
    );
    expect(result.abilities).toEqual({});
    expect(result.issues.map((i) => i.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('shop card summary shows damage, energy, cooldown and effects', () => {
    expect(weaponSummary(abilities.abilities.beam, 2, statuses.effects)).toEqual({ damage: '1.5', energy: '12', cooldown: '0.3s', effects: '-' });
    expect(weaponSummary(abilities.abilities.flamethrower, 1, statuses.effects)).toEqual({
      damage: '0.2-0.8/tick',
      energy: '40/s',
      cooldown: 'continuo',
      effects: 'Quemadura 15/100',
    });
  });
});

describe('shop purchases and F/R equipment', () => {
  const rich = (storage = memoryStorage()): Profile => {
    const profile = new Profile(abilities, storage);
    profile.recordStars('x', Array.from({ length: 300 }, (_, i) => `${i},0`));
    return profile;
  };
  const all = (): boolean => true;

  it('unavailable weapons cannot be bought or equipped', () => {
    const profile = rich();
    expect(profile.purchase('cryo-cannon', all)).toMatchObject({ ok: false, reason: 'unavailable' });
    expect(profile.levelOf('cryo-cannon')).toBe(0);
    expect(profile.equipWeapon('cryo-cannon', 'primary')).toBe(false);
  });

  it('upgrades keep the current price table', () => {
    const profile = rich();
    const costs = [1, 2, 3].map(() => (profile.purchase('beam', all) as { cost: number }).cost);
    expect(costs).toEqual([8, 18, 30]);
    expect(profile.purchase('beam', all)).toMatchObject({ ok: false, reason: 'maxed' });
  });

  it('new weapons go to their default slot, or to the free one', () => {
    const profile = rich();
    profile.purchase('flamethrower', all);
    expect(profile.equippedOn('secondary')).toBe('flamethrower');
    profile.purchase('beam', all);
    expect(profile.equippedOn('primary')).toBe('beam');
  });

  it('equipping on the other slot swaps both weapons', () => {
    const profile = rich();
    profile.purchase('beam', all);
    profile.purchase('flamethrower', all);
    expect(profile.equipWeapon('beam', 'secondary')).toBe(true);
    expect(profile.equippedOn('secondary')).toBe('beam');
    expect(profile.equippedOn('primary')).toBe('flamethrower');
    expect(profile.loadout().filter((l) => l.button).map((l) => [l.def.id, l.button])).toEqual([
      ['flamethrower', 'primary'],
      ['beam', 'secondary'],
    ]);
  });

  it('unequipping a slot leaves it empty; passives are not weapons', () => {
    const profile = rich();
    profile.purchase('beam', all);
    profile.purchase('jetpack', all);
    profile.unequipWeapon('primary');
    expect(profile.equippedOn('primary')).toBeUndefined();
    expect(profile.equipWeapon('jetpack', 'primary')).toBe(false);
    expect(profile.isEquipped('jetpack')).toBe(true);
  });

  it('persists the slot assignment', () => {
    const storage = memoryStorage();
    const profile = rich(storage);
    profile.purchase('beam', all);
    profile.purchase('flamethrower', all);
    profile.equipWeapon('flamethrower', 'primary');
    const reloaded = new Profile(abilities, storage);
    expect(reloaded.equippedOn('primary')).toBe('flamethrower');
    expect(reloaded.equippedOn('secondary')).toBe('beam');
  });
});

describe('save migration v1 → v2', () => {
  const v1 = {
    version: 1,
    collected: { 'forest-1': ['1,1', '2,2', '3,3'], 'ruins-1': Array.from({ length: 60 }, (_, i) => `${i},9`) },
    spent: 46,
    owned: { beam: 2, flamethrower: 1, jetpack: 1 },
    equipped: ['jetpack', 'flamethrower', 'beam'],
  };

  it('keeps stars, purchases and upgrades, and maps weapons to F/R', () => {
    const storage = memoryStorage();
    storage.save(JSON.stringify(v1));
    const profile = new Profile(abilities, storage);
    expect(profile.earned).toBe(63);
    expect(profile.balance).toBe(63 - 46);
    expect(profile.levelOf('beam')).toBe(2);
    expect(profile.levelOf('flamethrower')).toBe(1);
    expect(profile.equippedOn('primary')).toBe('beam');
    expect(profile.equippedOn('secondary')).toBe('flamethrower');
    expect(profile.isEquipped('jetpack')).toBe(true);
  });

  it('writes the migrated save immediately with the new version', () => {
    const storage = memoryStorage();
    storage.save(JSON.stringify(v1));
    new Profile(abilities, storage);
    const saved = JSON.parse(storage.load() ?? '{}');
    expect(saved.version).toBe(PROFILE_VERSION);
    expect(saved.equipped).toBeUndefined();
    expect(saved.weapons).toEqual({ primary: 'beam', secondary: 'flamethrower' });
  });

  it('migrates saves without version and with only one weapon', () => {
    const migrated = migrateProfile({ collected: {}, spent: 0, owned: { flamethrower: 1 }, equipped: ['flamethrower'] }, abilities);
    expect(migrated).toMatchObject({ version: 2, passives: [], weapons: { primary: null, secondary: 'flamethrower' } });
  });

  it('owned but unequipped weapons stay owned', () => {
    const migrated = migrateProfile({ ...v1, equipped: [] }, abilities);
    expect(migrated).toMatchObject({ owned: v1.owned, weapons: { primary: null, secondary: null } });
  });

  it('is idempotent: a v2 save is not changed', () => {
    const v2 = { version: 2, collected: {}, spent: 0, owned: {}, passives: [], weapons: { primary: null, secondary: null } };
    expect(migrateProfile(v2, abilities)).toBe(v2);
  });

  it('survives corrupt saves', () => {
    const storage = memoryStorage();
    storage.save('{not json');
    expect(new Profile(abilities, storage).balance).toBe(0);
  });
});

describe('existing levels stay compatible', () => {
  const registry = readJson('levels/levels.json') as { levels: string[] };

  it('every enemy placed in the levels exists, has an element and bosses stay stompable', () => {
    for (const file of registry.levels) {
      const level = parseLevel(readJson(`levels/${file}`) as LevelData);
      for (const placed of level.enemies) {
        const def = enemies.enemies[placed.type];
        expect(def, `${file}: ${placed.type}`).toBeDefined();
        expect(ELEMENTS).toContain(def.element);
        // Bosses must stay stompable so a level never requires a weapon.
        if (def.boss) expect(def.stomp === 'immune' || def.immune.includes('stomp') || def.formResist.stomp === 0).toBe(false);
      }
    }
  });
});
