import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({ default: { Geom: { Rectangle: class {} } } }));
vi.mock('../src/core/audio/Sfx', () => ({ playSound: () => undefined }));

import type { AbilityContext } from '../src/games/platformer/abilities/Ability';
import { AbilitySystem } from '../src/games/platformer/abilities/AbilitySystem';
import { affordableCharge, chargedDamage, chargeEnergyCost, chargeFraction } from '../src/games/platformer/abilities/formulas';
import { beamTargets } from '../src/games/platformer/combat/beam';
import { computeDamage, type Hit } from '../src/games/platformer/combat/damage';
import type { AbilityButton, PlatformerAction } from '../src/games/platformer/controls';
import { memoryStorage } from '../src/games/platformer/level/LevelManager';
import { buildCatalogs } from '../src/games/platformer/progression/gameData';
import { Profile } from '../src/games/platformer/progression/Profile';
import { weaponSummary } from '../src/games/platformer/progression/weaponInfo';

const ASSETS = join(__dirname, '../public/assets/platformer');
const readJson = (path: string): unknown => JSON.parse(readFileSync(join(ASSETS, path), 'utf8'));
const data = buildCatalogs({
  elements: readJson('combat/elements.json'),
  statuses: readJson('combat/status-effects.json'),
  enemies: readJson('enemies/enemies.json'),
  abilities: readJson('abilities/abilities.json'),
});
const { chart, enemies, abilities, statuses } = data;
const laser = abilities.abilities['laser-cannon'];
const L1 = laser.levels[0];
const DT = 1 / 60;

interface BeamCall {
  dir: number;
  range: number;
  pierce: number;
  height: number;
  hit: Hit;
}

function harness(level = 1, button: AbilityButton = 'primary') {
  const held = new Set<PlatformerAction>();
  const pressed = new Set<PlatformerAction>();
  const beams: BeamCall[] = [];
  const log = { charge: [] as number[], ended: 0, lasers: 0 };
  const player = { isAlive: true, facing: 1, x: 50, body: { bottom: 100, center: { y: 90 } }, playAction: () => undefined };
  const ctx = {
    scene: {},
    player,
    input: { isDown: (a: PlatformerAction) => held.has(a), justPressed: (a: PlatformerAction) => pressed.has(a) },
    combat: {
      fireBeam: (b: BeamCall) => {
        beams.push(b);
        return { endX: 50 + b.range, hits: 0 };
      },
    },
    fx: {
      setCharge: (_x: number, _y: number, f: number) => void log.charge.push(f),
      endCharge: () => void log.ended++,
      laser: () => void log.lasers++,
    },
  } as unknown as Omit<AbilityContext, 'energy'>;
  const system = new AbilitySystem(ctx, [{ def: laser, level, button }]);
  /** Advances `seconds` holding or not holding the button; `press` marks the first frame as a fresh press. */
  const run = (seconds: number, opts: { hold?: boolean; press?: boolean } = {}): void => {
    for (let t = 0, first = true; t < seconds - 1e-9; t += DT, first = false) {
      held.clear();
      pressed.clear();
      if (opts.hold) held.add(button);
      if (opts.press && first) pressed.add(button);
      system.update(DT, ctx.input);
    }
  };
  const charge = (seconds: number): void => {
    run(DT, { hold: true, press: true });
    run(seconds - DT, { hold: true });
  };
  const release = (): void => run(DT);
  return { system, run, charge, release, beams, log, player };
}

describe('charge formulas', () => {
  it('charge grows with time up to 1', () => {
    expect(chargeFraction(0.6, 1.2)).toBeCloseTo(0.5);
    expect(chargeFraction(9, 1.2)).toBe(1);
    expect(chargeFraction(0, 0)).toBe(1);
  });

  it('damage is linear between the uncharged and the maximum', () => {
    expect(chargedDamage(0, 1, 2.5)).toBe(1);
    expect(chargedDamage(0.5, 1, 2.5)).toBeCloseTo(1.75);
    expect(chargedDamage(1, 1, 2.5)).toBe(2.5);
    expect(chargedDamage(5, 1, 2.5)).toBe(2.5);
  });

  it('energy cost: 40 % uncharged up to 100 % at full charge', () => {
    expect(chargeEnergyCost(0, 30)).toBeCloseTo(12);
    expect(chargeEnergyCost(1, 30)).toBeCloseTo(30);
  });

  it('affordable charge is capped by the available energy', () => {
    expect(affordableCharge(100, 30)).toBe(1);
    expect(affordableCharge(12, 30)).toBeCloseTo(0);
    expect(affordableCharge(21, 30)).toBeCloseTo(0.5);
    expect(affordableCharge(11, 30)).toBe(-1);
  });
});

describe('Cañón láser: carga y disparo', () => {
  it('does not fire while the button is held; fires once on release', () => {
    const h = harness();
    h.charge(0.5);
    expect(h.beams).toHaveLength(0);
    h.release();
    expect(h.beams).toHaveLength(1);
    expect(h.log.lasers).toBe(1);
  });

  it('damage grows with the charge and is capped at the configured maximum', () => {
    const { damage, chargedDamage: max, chargeTime } = L1.params;
    const dmg = (seconds: number): number => {
      const h = harness();
      h.charge(seconds);
      h.release();
      return h.beams[0].hit.amount;
    };
    const tap = dmg(DT);
    const half = dmg(chargeTime / 2);
    const full = dmg(chargeTime);
    expect(tap).toBeCloseTo(damage, 1);
    expect(half).toBeGreaterThan(tap);
    expect(full).toBeGreaterThan(half);
    expect(full).toBeCloseTo(max, 5);
    expect(dmg(chargeTime * 5)).toBeCloseTo(max, 5);
  });

  it('the shot carries the laser element, pierce limit and range from the config', () => {
    const h = harness();
    h.charge(0.3);
    h.release();
    expect(h.beams[0]).toMatchObject({ dir: 1, range: L1.params.range, pierce: L1.params.pierce });
    expect(h.beams[0].hit).toMatchObject({ element: 'laser', form: 'projectile' });
  });

  it('the charge glow is shown while holding and removed on release', () => {
    const h = harness();
    h.charge(1);
    expect(h.log.charge.length).toBeGreaterThan(10);
    expect(h.log.charge[h.log.charge.length - 1]).toBeGreaterThan(h.log.charge[0]);
    h.release();
    expect(h.log.ended).toBeGreaterThan(0);
  });

  it('fires in the facing direction', () => {
    const h = harness();
    h.player.facing = -1;
    h.charge(0.2);
    h.release();
    expect(h.beams[0].dir).toBe(-1);
  });
});

describe('Cañón láser: energía y cooldown', () => {
  it('consumes energy only on release, scaled by charge', () => {
    const h = harness();
    h.charge(L1.params.chargeTime);
    expect(h.system.energy.current).toBe(100);
    h.release();
    expect(h.system.energy.current).toBeCloseTo(100 - L1.energy);

    const tap = harness();
    tap.charge(DT);
    tap.release();
    expect(tap.system.energy.current).toBeCloseTo(100 - L1.energy * 0.4, 0);
  });

  it('cannot start charging without enough energy', () => {
    const h = harness();
    h.system.energy.drain(100);
    h.charge(1);
    h.release();
    expect(h.beams).toHaveLength(0);
    expect(h.log.charge).toHaveLength(0);
  });

  it('energy spent elsewhere while charging caps the charge', () => {
    const h = harness();
    h.charge(0.4);
    h.system.energy.drain(100 - 15);
    h.release();
    expect(h.beams).toHaveLength(1);
    expect(h.beams[0].hit.amount).toBeCloseTo(chargedDamage(affordableCharge(15, L1.energy), L1.params.damage, L1.params.chargedDamage), 1);
    expect(h.beams[0].hit.amount).toBeLessThan(chargedDamage(0.4 / L1.params.chargeTime, L1.params.damage, L1.params.chargedDamage));
    expect(h.system.energy.current).toBeGreaterThanOrEqual(0);
  });

  it('the cooldown blocks a new charge until it elapses', () => {
    const h = harness();
    h.charge(0.2);
    h.release();
    h.charge(0.2);
    h.release();
    expect(h.beams).toHaveLength(1);
    h.run(L1.cooldown + 0.1);
    h.charge(0.2);
    h.release();
    expect(h.beams).toHaveLength(2);
  });

  it('a dead player cancels the charge without firing', () => {
    const h = harness();
    h.charge(0.5);
    h.player.isAlive = false;
    h.release();
    expect(h.beams).toHaveLength(0);
    expect(h.system.energy.current).toBe(100);
  });
});

describe('Cañón láser: slots y controles', () => {
  it('works on F or R (touch uses the same held/released button state)', () => {
    for (const button of ['primary', 'secondary'] as const) {
      const h = harness(1, button);
      h.charge(0.5);
      h.release();
      expect(h.beams, button).toHaveLength(1);
    }
  });

  it('the other slot does not trigger it', () => {
    const h = harness(1, 'primary');
    const system = h.system;
    expect(system.on('secondary')).toBeUndefined();
    expect(system.on('primary')?.def.id).toBe('laser-cannon');
  });
});

describe('Cañón láser: penetración, afinidades y armadura', () => {
  it('hits only the nearest N targets', () => {
    const xs = [{ x: 90 }, { x: 60 }, { x: 140 }, { x: 75 }, { x: 200 }];
    expect(beamTargets(50, xs, 3).map((e) => e.x)).toEqual([60, 75, 90]);
    expect(beamTargets(50, xs, 1)).toHaveLength(1);
    expect(beamTargets(50, xs, 0)).toEqual([]);
    expect(beamTargets(50, xs, 99)).toHaveLength(5);
  });

  const vs = (enemy: string, amount: number, extra: Partial<Hit> = {}): number => {
    const e = enemies.enemies[enemy];
    return computeDamage({ amount, form: 'projectile', element: 'laser', ...extra }, { element: e.element, armor: e.armor, resist: e.resist, formResist: e.formResist, immune: e.immune }, chart);
  };

  it('Láser beats Plasma (×1.5) and loses against Energía (×0.5)', () => {
    expect(vs('bat', 2)).toBe(3);
    expect(vs('walker', 2)).toBe(1);
    expect(vs('spitter', 2)).toBe(2);
  });

  it('respects personal resistances, immunities and armor', () => {
    expect(computeDamage({ amount: 2, form: 'projectile', element: 'laser' }, { element: 'plasma', armor: 0, resist: { laser: 0.5 } }, chart)).toBe(1.5);
    expect(computeDamage({ amount: 2, form: 'projectile', element: 'laser' }, { element: 'plasma', armor: 0, resist: {}, immune: ['laser'] }, chart)).toBe(0);
    expect(computeDamage({ amount: 2, form: 'projectile', element: 'laser' }, { element: 'plasma', armor: 1, resist: {} }, chart)).toBe(2);
  });

  it('the energy golem resists the laser (×0.5), so a full charge needs four shots', () => {
    const golem = enemies.enemies.golem;
    expect(vs('golem', L1.params.chargedDamage)).toBeCloseTo(1.25);
    expect(Math.ceil(golem.maxHealth / vs('golem', L1.params.chargedDamage))).toBe(4);
    expect(vs('golem', L1.params.chargedDamage, { situational: golem.guard })).toBeLessThan(vs('golem', L1.params.chargedDamage));
  });
});

describe('Cañón láser: tienda, mejoras y persistencia', () => {
  const stars = (profile: Profile, n = 300): number => profile.recordStars('x', Array.from({ length: n }, (_, i) => `${i},0`));
  const unlocked = (id: string): boolean => id === 'ice-1';

  it('is available, in the laser element and no longer planned', () => {
    expect(laser).toMatchObject({ available: true, element: 'laser', module: 'charged-shot' });
    expect(data.issues).toEqual([]);
    expect(abilities.abilities['cryo-cannon'].available).toBe(false);
    expect(abilities.abilities['plasma-projector'].available).toBe(false);
  });

  it('requires completing the ice level', () => {
    const profile = new Profile(abilities, memoryStorage());
    stars(profile);
    expect(profile.purchase('laser-cannon', () => false)).toMatchObject({ ok: false, reason: 'locked' });
    expect(profile.purchase('laser-cannon', unlocked)).toMatchObject({ ok: true, cost: 25 });
  });

  it('has three upgrade levels with growing power and falling energy/cooldown', () => {
    expect(laser.levels.map((l) => l.cost)).toEqual([25, 35, 45]);
    for (let i = 1; i < laser.levels.length; i++) {
      const a = laser.levels[i - 1];
      const b = laser.levels[i];
      expect(b.params.chargedDamage).toBeGreaterThan(a.params.chargedDamage);
      expect(b.params.pierce).toBeGreaterThanOrEqual(a.params.pierce);
      expect(b.params.chargeTime).toBeLessThan(a.params.chargeTime);
      expect(b.energy).toBeLessThan(a.energy);
      expect(b.cooldown).toBeLessThan(a.cooldown);
    }
    const profile = new Profile(abilities, memoryStorage());
    stars(profile);
    const costs = [1, 2, 3].map(() => (profile.purchase('laser-cannon', unlocked) as { cost: number }).cost);
    expect(costs).toEqual([25, 35, 45]);
    expect(profile.purchase('laser-cannon', unlocked)).toMatchObject({ ok: false, reason: 'maxed' });
  });

  it('is balanced against the beam and flamethrower (full charge pays off in damage per energy)', () => {
    const perEnergy = (damage: number, energy: number): number => damage / energy;
    const beam = abilities.abilities.beam.levels[0];
    for (const l of laser.levels) expect(perEnergy(l.params.chargedDamage, l.energy)).toBeGreaterThan(perEnergy(beam.params.damage, beam.energy));
    // Spamming uncharged shots must be worse than the beam.
    expect(laser.levels[0].params.damage / (laser.levels[0].cooldown * 1)).toBeLessThan(abilities.abilities.beam.levels[2].params.damage / abilities.abilities.beam.levels[2].cooldown);
  });

  it('equips on F or R, swaps with the other weapon and persists', () => {
    const storage = memoryStorage();
    const profile = new Profile(abilities, storage);
    stars(profile);
    profile.purchase('beam', unlocked);
    profile.purchase('laser-cannon', unlocked);
    expect(profile.equipWeapon('laser-cannon', 'secondary')).toBe(true);
    const reloaded = new Profile(abilities, storage);
    expect(reloaded.levelOf('laser-cannon')).toBe(1);
    expect(reloaded.equippedOn('secondary')).toBe('laser-cannon');
    expect(reloaded.loadout().find((e) => e.def.id === 'laser-cannon')?.button).toBe('secondary');
    expect(reloaded.equipWeapon('laser-cannon', 'primary')).toBe(true);
    expect(reloaded.equippedOn('primary')).toBe('laser-cannon');
    expect(reloaded.equippedOn('secondary')).toBe('beam');
  });

  it('the shop card shows damage range, energy, cooldown and pierce', () => {
    expect(weaponSummary(laser, 1, statuses.effects)).toEqual({ damage: '1-2.5', energy: '30', cooldown: '0.9s', effects: 'Perfora 2' });
  });

  it('beam and flamethrower keep their previous stats', () => {
    expect(abilities.abilities.beam.levels.map((l) => [l.cost, l.energy, l.cooldown, l.params.damage])).toEqual([
      [8, 15, 0.45, 1],
      [18, 12, 0.3, 1.5],
      [30, 10, 0.25, 2],
    ]);
    expect(abilities.abilities.flamethrower.levels.map((l) => l.cost)).toEqual([20, 35]);
  });
});
