import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Ability modules only need Phaser for a rectangle and the sound helper; stub both for Node.
vi.mock('phaser', () => ({
  default: {
    Geom: {
      Rectangle: class {
        constructor(
          public x: number,
          public y: number,
          public width: number,
          public height: number,
        ) {}
      },
    },
  },
}));
vi.mock('../src/core/audio/Sfx', () => ({ playSound: () => undefined }));

import { buildAbilityCatalog } from '../src/games/platformer/abilities/AbilityCatalog';
import type { AbilityContext } from '../src/games/platformer/abilities/Ability';
import { AbilitySystem } from '../src/games/platformer/abilities/AbilitySystem';
import { ABILITY_MODULE_IDS } from '../src/games/platformer/abilities/moduleIds';
import { type AbilityButton, KEY_BINDINGS, SHORTCUT_KEYS, type PlatformerAction } from '../src/games/platformer/controls';
import { memoryStorage } from '../src/games/platformer/level/LevelManager';
import { Profile } from '../src/games/platformer/progression/Profile';
import { PLATFORMER_ACCESS, STANDARD_ACCESS } from '../src/games/platformer/progression/accessPolicy';

const catalog = buildAbilityCatalog(JSON.parse(readFileSync(join(__dirname, '../public/assets/platformer/abilities/abilities.json'), 'utf8')), ABILITY_MODULE_IDS);
const DT = 1 / 60;

describe('keyboard controls', () => {
  it('maps F to the energy beam and R to the flamethrower by default', () => {
    expect(KEY_BINDINGS.primary).toEqual(['F']);
    expect(KEY_BINDINGS.secondary).toEqual(['R']);
    expect(catalog.abilities.beam.defaultSlot).toBe('primary');
    expect(catalog.abilities.flamethrower.defaultSlot).toBe('secondary');
    expect(catalog.abilities.jetpack.defaultSlot).toBeNull();
  });

  it('keeps movement on A/D, jump on Space and pause on Esc', () => {
    expect(KEY_BINDINGS.left).toContain('A');
    expect(KEY_BINDINGS.right).toContain('D');
    expect(KEY_BINDINGS.jump).toContain('SPACE');
    expect(SHORTCUT_KEYS.pause).toContain('ESC');
  });

  it('never binds the same key to two actions or shortcuts', () => {
    const all = [...Object.values(KEY_BINDINGS), ...Object.values(SHORTCUT_KEYS)].flat();
    expect(new Set(all).size).toBe(all.length);
    expect(all).not.toContain('J');
    expect(all).not.toContain('K');
  });

  it('accepts a weapon slot only for weapons, and only F/R slots', () => {
    const bad = buildAbilityCatalog(
      {
        a: { name: 'A', module: 'projectile', slot: 'active', defaultSlot: 'tertiary', levels: [{ cost: 1 }] },
        b: { name: 'B', module: 'jetpack', slot: 'passive', defaultSlot: 'primary', levels: [{ cost: 1 }] },
        c: { name: 'C', module: 'projectile', slot: 'active', levels: [{ cost: 1 }] },
      },
      ABILITY_MODULE_IDS,
    );
    expect(bad.issues.map((i) => i.id)).toEqual(['a', 'b']);
    expect(bad.abilities.c.defaultSlot).toBeNull();
  });
});

describe('free weapon access', () => {
  it('offers every functional weapon at level one without purchases or completed levels', () => {
    const profile = new Profile(catalog, memoryStorage(), PLATFORMER_ACCESS);
    const weapons = Object.values(catalog.abilities).filter((def) => def.available && def.slot === 'active');
    expect(weapons.map((def) => def.id)).toEqual(['beam', 'flamethrower', 'laser-cannon']);
    for (const def of weapons) {
      expect(profile.levelOf(def.id)).toBe(1);
      for (const slot of ['primary', 'secondary'] as const) {
        expect(profile.equipWeapon(def.id, slot)).toBe(true);
        expect(profile.loadout().find((entry) => entry.button === slot)?.def.id).toBe(def.id);
      }
    }
    expect(profile.snapshot().owned).toEqual({});
    expect(profile.snapshot().collected).toEqual({});
    expect(profile.balance).toBe(0);
    expect(profile.levelOf('jetpack')).toBe(0);
    expect(profile.equipWeapon('cryo-cannon', 'primary')).toBe(false);
    expect(profile.equipWeapon('plasma-projector', 'secondary')).toBe(false);
  });

  it('persists chosen F/R slots without recording free access as ownership', () => {
    const storage = memoryStorage();
    const profile = new Profile(catalog, storage, PLATFORMER_ACCESS);
    expect(profile.activeSlots).toEqual(['beam', 'flamethrower']);
    profile.equipWeapon('laser-cannon', 'secondary');
    profile.equipWeapon('flamethrower', 'primary');
    const restored = new Profile(catalog, storage, PLATFORMER_ACCESS);
    expect(restored.equippedOn('primary')).toBe('flamethrower');
    expect(restored.equippedOn('secondary')).toBe('laser-cannon');
    expect(restored.loadout().map((entry) => [entry.def.id, entry.level, entry.button])).toEqual([
      ['flamethrower', 1, 'primary'], ['laser-cannon', 1, 'secondary'],
    ]);
    expect(restored.snapshot().owned).toEqual({});
    expect(new Profile(catalog, storage, STANDARD_ACCESS).activeSlots).toEqual([]);
  });

  it('keeps deliberately empty slots empty between sessions', () => {
    const storage = memoryStorage();
    const profile = new Profile(catalog, storage, PLATFORMER_ACCESS);
    profile.unequipWeapon('primary');
    profile.unequipWeapon('secondary');
    const restored = new Profile(catalog, storage, PLATFORMER_ACCESS);
    expect(restored.activeSlots).toEqual([]);
    expect(restored.levelOf('laser-cannon')).toBe(1);
    expect(restored.equipWeapon('laser-cannon', 'secondary')).toBe(true);
  });

  it('preserves existing purchases, passive equipment, upgrades and wallet exactly', () => {
    const storage = memoryStorage();
    const original = new Profile(catalog, storage, STANDARD_ACCESS);
    original.recordStars('forest-1', Array.from({ length: 100 }, (_, index) => String(index)));
    original.purchase('beam', () => true);
    original.purchase('beam', () => true);
    original.purchase('jetpack', () => true);
    const before = original.snapshot();
    const saved = storage.load();
    const free = new Profile(catalog, storage, PLATFORMER_ACCESS);
    expect(free.snapshot()).toEqual(before);
    expect(storage.load()).toBe(saved);
    expect(free.balance).toBe(original.balance);
    expect(free.levelOf('beam')).toBe(2);
    expect(free.isEquipped('jetpack')).toBe(true);
    expect(free.levelOf('flamethrower')).toBe(1);
    free.equipWeapon('laser-cannon', 'secondary');
    const restored = new Profile(catalog, storage, PLATFORMER_ACCESS);
    expect(restored.loadout().map((entry) => [entry.def.id, entry.level])).toEqual([['jetpack', 1], ['beam', 2], ['laser-cannon', 1]]);
    expect(restored.snapshot().owned).toEqual(before.owned);
    expect(restored.collectedIn('forest-1')).toBe(100);
  });

  it('charges only actual upgrades and retains paid levels when standard access returns', () => {
    const storage = memoryStorage();
    const profile = new Profile(catalog, storage, PLATFORMER_ACCESS);
    const cost = catalog.abilities['laser-cannon'].levels[1].cost;
    expect(profile.canPurchase('laser-cannon', () => false)).toEqual({ ok: false, reason: 'funds', cost });
    profile.recordStars('c1-3-reactor', Array.from({ length: cost + 2 }, (_, index) => String(index)));
    profile.equipWeapon('laser-cannon', 'secondary');
    expect(profile.purchase('laser-cannon', () => false)).toEqual({ ok: true, cost, nextLevel: 2 });
    expect(profile.balance).toBe(2);
    const standard = new Profile(catalog, storage, STANDARD_ACCESS);
    expect(standard.levelOf('laser-cannon')).toBe(2);
    expect(standard.levelOf('beam')).toBe(0);
    expect(standard.equippedOn('secondary')).toBe('laser-cannon');
    expect(standard.balance).toBe(2);
  });
});

describe('equipment by slot (F / R)', () => {
  it('allows one weapon per slot; equipping on an occupied slot replaces it', () => {
    const custom = buildAbilityCatalog(
      {
        beam: { name: 'Beam', module: 'projectile', slot: 'active', defaultSlot: 'primary', levels: [{ cost: 1 }] },
        laser: { name: 'Laser', module: 'projectile', slot: 'active', defaultSlot: 'primary', levels: [{ cost: 1 }] },
        flame: { name: 'Flame', module: 'flamethrower', slot: 'active', defaultSlot: 'secondary', levels: [{ cost: 1 }] },
      },
      ABILITY_MODULE_IDS,
    );
    const profile = new Profile(custom, memoryStorage());
    profile.recordStars('x', ['1', '2', '3']);
    for (const id of ['beam', 'flame', 'laser']) profile.purchase(id, () => true);
    expect(profile.equippedOn('primary')).toBe('beam');
    expect(profile.equippedOn('secondary')).toBe('flame');
    expect(profile.isEquipped('laser')).toBe(false);
    expect(profile.equip('laser')).toBe(false);
    expect(profile.equipWeapon('laser', 'primary')).toBe(true);
    expect(profile.isEquipped('beam')).toBe(false);
    expect(profile.activeSlots).toEqual(['laser', 'flame']);
  });
});

/** Minimal stand-ins for the scene objects an ability touches. `slots` maps weapons to buttons (defaults to their defaultSlot). */
function harness(abilityIds: string[], slots: Partial<Record<string, AbilityButton>> = {}) {
  const pressed = new Set<PlatformerAction>();
  const held = new Set<PlatformerAction>();
  const shots: Array<{ damage: number; element: string | null }> = [];
  const areaHits: number[] = [];
  const areaElements: Array<string | null | undefined> = [];
  const airJumps: number[] = [];
  const body = { bottom: 100, center: { y: 90 }, blocked: { down: true }, velocity: { y: 0 }, setVelocityY: (v: number) => void (body.velocity.y = v) };
  const player = {
    isAlive: true,
    facing: 1,
    x: 50,
    body,
    jumpedThisFrame: false,
    canGroundJump: false,
    playAction: () => undefined,
    airJump: (v: number) => {
      airJumps.push(v);
      body.velocity.y = -v;
    },
  };
  const ctx = {
    scene: {},
    player,
    input: { isDown: (a: PlatformerAction) => held.has(a), justPressed: (a: PlatformerAction) => pressed.has(a) },
    combat: {
      firePlayerShot: (shot: { damage: number; element: string | null }) => void shots.push(shot),
      damageArea: (_area: unknown, hit: { amount: number; element?: string | null }) => {
        areaHits.push(hit.amount);
        areaElements.push(hit.element);
        return 1;
      },
    },
    fx: { impact: () => undefined, flame: () => undefined, jet: () => undefined },
  } as unknown as Omit<AbilityContext, 'energy'>;
  const loadout = abilityIds.map((id) => {
    const def = catalog.abilities[id];
    return { def, level: 1, button: def.slot === 'active' ? (slots[id] ?? def.defaultSlot) : null };
  });
  const system = new AbilitySystem(ctx, loadout);
  /** Advances one frame with the given keys pressed this frame and/or held. */
  const step = (opts: { press?: PlatformerAction[]; hold?: PlatformerAction[] } = {}, dt = DT): void => {
    pressed.clear();
    held.clear();
    for (const a of opts.press ?? []) {
      pressed.add(a);
      held.add(a);
    }
    for (const a of opts.hold ?? []) held.add(a);
    system.update(dt, ctx.input);
  };
  return { system, step, shots, areaHits, areaElements, airJumps, body, player };
}

describe('abilities in play (F / R / Space)', () => {
  let h: ReturnType<typeof harness>;
  beforeEach(() => {
    h = harness(['beam', 'flamethrower', 'jetpack']);
  });

  it('F fires one beam per press, consuming energy and respecting the cooldown', () => {
    const { energy, cooldown } = catalog.abilities.beam.levels[0];
    h.step({ press: ['primary'] });
    expect(h.shots).toHaveLength(1);
    expect(h.system.energy.current).toBeCloseTo(100 - energy);

    h.step({ press: ['primary'] });
    expect(h.shots).toHaveLength(1);

    for (let t = 0; t < cooldown * 2; t += DT) h.step({ hold: ['primary'] });
    expect(h.shots).toHaveLength(1);

    h.step({ press: ['primary'] });
    expect(h.shots).toHaveLength(2);
  });

  it('F does nothing without enough energy', () => {
    h.system.energy.drain(100);
    h.step({ press: ['primary'] });
    expect(h.shots).toHaveLength(0);
  });

  it('holding R keeps the flamethrower on, draining energy per second with ramping damage', () => {
    const { energy: perSecond, params } = catalog.abilities.flamethrower.levels[0];
    for (let t = 0; t < 1; t += DT) h.step({ hold: ['secondary'] });
    expect(h.areaHits.length).toBeGreaterThan(4);
    expect(h.areaHits[h.areaHits.length - 1]).toBeGreaterThan(h.areaHits[0]);
    expect(Math.max(...h.areaHits)).toBeLessThanOrEqual(params.maxDamage);
    expect(h.system.energy.current).toBeCloseTo(100 - perSecond, 0);

    const hits = h.areaHits.length;
    h.step();
    expect(h.areaHits).toHaveLength(hits);
  });

  it('the flamethrower stops when energy runs out and needs R released to reignite', () => {
    for (let t = 0; t < 5; t += DT) h.step({ hold: ['secondary'] });
    const hits = h.areaHits.length;
    for (let t = 0; t < 2; t += DT) h.step({ hold: ['secondary'] });
    expect(h.areaHits).toHaveLength(hits);
    h.step();
    h.step({ press: ['secondary'] });
    expect(h.areaHits).toHaveLength(hits + 1);
  });

  it('F and R work independently in the same frame', () => {
    h.step({ press: ['primary', 'secondary'] });
    expect(h.shots).toHaveLength(1);
    expect(h.areaHits).toHaveLength(1);
  });

  it('weapons carry their element: beam = energy, flamethrower = fire', () => {
    h.step({ press: ['primary', 'secondary'] });
    expect(h.shots[0].element).toBe('energy');
    expect(h.areaElements[0]).toBe('fire');
  });

  it('swapped slots: F fires the flamethrower and R the beam', () => {
    const swapped = harness(['beam', 'flamethrower'], { beam: 'secondary', flamethrower: 'primary' });
    swapped.step({ hold: ['primary'] });
    expect(swapped.areaHits).toHaveLength(1);
    expect(swapped.shots).toHaveLength(0);
    swapped.step({ press: ['secondary'] });
    expect(swapped.shots).toHaveLength(1);
    expect(swapped.system.on('primary')?.def.id).toBe('flamethrower');
  });

  it('Space in the air double-jumps once, and holding it glides', () => {
    const { params } = catalog.abilities.jetpack.levels[0];
    h.body.blocked.down = true;
    h.step();
    h.body.blocked.down = false;
    h.step({ press: ['jump'] });
    expect(h.airJumps).toEqual([params.jumpVelocity]);
    h.step({ press: ['jump'] });
    expect(h.airJumps).toHaveLength(1);

    h.body.velocity.y = 300;
    h.step({ hold: ['jump'] });
    expect(h.body.velocity.y).toBe(params.glideFallSpeed);
  });

  it('Space does not double-jump on the same frame as the ground jump', () => {
    h.body.blocked.down = false;
    h.player.jumpedThisFrame = true;
    h.step({ press: ['jump'] });
    expect(h.airJumps).toHaveLength(0);
  });
});
