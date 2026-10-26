import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({ default: { Geom: { Rectangle: class {} }, Input: { Keyboard: { KeyCodes: {} } } } }));
vi.mock('../src/core/audio/Sfx', () => ({ playSound: () => undefined }));

import type { AbilityContext } from '../src/games/platformer/abilities/Ability';
import { AbilitySystem } from '../src/games/platformer/abilities/AbilitySystem';
import { PlatformerScenes } from '../src/games/platformer/config';
import type { AbilityButton, PlatformerAction } from '../src/games/platformer/controls';
import { memoryStorage } from '../src/games/platformer/level/LevelManager';
import { AFFINITY_KEYS, affinityArrows, affinityNodes, fromAffinity, toAffinity } from '../src/games/platformer/progression/affinityInfo';
import { buildCatalogs } from '../src/games/platformer/progression/gameData';
import { Profile } from '../src/games/platformer/progression/Profile';
import { PointerHold } from '../src/games/platformer/touchHold';

const ROOT = join(__dirname, '..');
const ASSETS = join(ROOT, 'public/assets/platformer');
const readJson = (path: string): any => JSON.parse(readFileSync(join(ASSETS, path), 'utf8'));
const data = buildCatalogs({
  elements: readJson('combat/elements.json'),
  statuses: readJson('combat/status-effects.json'),
  enemies: readJson('enemies/enemies.json'),
  abilities: readJson('abilities/abilities.json'),
});
const { chart, abilities } = data;
const laser = abilities.abilities['laser-cannon'];
const DT = 1 / 60;

function harness(button: AbilityButton = 'primary') {
  const held = new Set<PlatformerAction>();
  const pressed = new Set<PlatformerAction>();
  const shots: number[] = [];
  const log = { ended: 0 };
  const player = { isAlive: true, facing: 1, x: 50, body: { bottom: 100, center: { y: 90 } }, playAction: () => undefined };
  const ctx = {
    scene: {},
    player,
    input: { isDown: (a: PlatformerAction) => held.has(a), justPressed: (a: PlatformerAction) => pressed.has(a) },
    combat: { fireBeam: (b: { hit: { amount: number } }) => (shots.push(b.hit.amount), { endX: 100, hits: 0 }) },
    fx: { setCharge: () => undefined, endCharge: () => void log.ended++, laser: () => undefined },
  } as unknown as Omit<AbilityContext, 'energy'>;
  const system = new AbilitySystem(ctx, [{ def: laser, level: 1, button }]);
  /** One frame; `down` = button state, `fresh` = it went down this frame. */
  const frame = (down: boolean, fresh = false): void => {
    held.clear();
    pressed.clear();
    if (down) held.add(button);
    if (fresh) pressed.add(button);
    system.update(DT, ctx.input);
  };
  const hold = (seconds: number, fresh = true): void => {
    for (let t = 0, first = true; t < seconds; t += DT, first = false) frame(true, fresh && first);
  };
  return { system, frame, hold, shots, log, player };
}

describe('ciclo de vida de la carga del láser', () => {
  it('iniciar → mantener → soltar dispara una vez', () => {
    const h = harness();
    h.hold(0.5);
    expect(h.shots).toHaveLength(0);
    h.frame(false);
    expect(h.shots).toHaveLength(1);
    h.frame(false);
    expect(h.shots).toHaveLength(1);
  });

  it('cancelar descarta la carga: sin disparo, sin energía gastada y sin cooldown', () => {
    const h = harness();
    h.hold(0.8);
    h.system.cancelAll();
    expect(h.log.ended).toBeGreaterThan(0);
    h.frame(false);
    expect(h.shots).toHaveLength(0);
    expect(h.system.energy.current).toBe(100);
    expect(h.system.on('primary')?.cooldown.ready).toBe(true);
  });

  it('tras cancelar con el botón aún pulsado no se reinicia: hace falta una nueva pulsación', () => {
    const h = harness();
    h.hold(0.5);
    h.system.cancelAll();
    h.hold(1, false);
    h.frame(false);
    expect(h.shots).toHaveLength(0);
    h.hold(0.3);
    h.frame(false);
    expect(h.shots).toHaveLength(1);
  });

  it('pausar y reanudar con el botón soltado durante la pausa no dispara', () => {
    const h = harness();
    h.hold(0.7);
    h.system.cancelAll(); // PAUSE event
    // while paused the HUD drops touches; on resume the button reads as released
    h.frame(false);
    h.frame(false);
    expect(h.shots).toHaveLength(0);
    expect(h.system.energy.current).toBe(100);
  });

  it('pausar y reanudar con el botón mantenido tampoco reinicia la carga', () => {
    const h = harness();
    h.hold(0.7);
    h.system.cancelAll();
    h.hold(0.5, false);
    h.frame(false);
    expect(h.shots).toHaveLength(0);
  });

  it('perder el foco equivale a cancelar', () => {
    const h = harness('secondary');
    h.hold(0.4);
    h.system.cancelAll(); // BLUR event
    h.frame(false);
    expect(h.shots).toHaveLength(0);
    expect(h.system.energy.current).toBe(100);
  });

  it('morir durante la carga la cancela sin disparar ni gastar; al reaparecer hace falta pulsar de nuevo', () => {
    const h = harness();
    h.hold(0.6);
    h.player.isAlive = false;
    h.frame(false);
    expect(h.shots).toHaveLength(0);
    expect(h.system.energy.current).toBe(100);
    h.player.isAlive = true;
    h.hold(1, false);
    h.frame(false);
    expect(h.shots).toHaveLength(0);
    h.hold(0.3);
    h.frame(false);
    expect(h.shots).toHaveLength(1);
  });

  it('cancelar sin carga en curso es inocuo y no afecta al cooldown', () => {
    const h = harness();
    h.system.cancelAll();
    h.hold(0.3);
    h.frame(false);
    expect(h.shots).toHaveLength(1);
    h.system.cancelAll();
    expect(h.system.on('primary')?.cooldown.ready).toBe(false);
  });

  it('los demás tipos de arma ignoran cancelAll sin error', () => {
    const flame = abilities.abilities.flamethrower;
    const system = new AbilitySystem({ scene: {}, player: {}, input: {}, combat: {}, fx: {} } as never, [{ def: flame, level: 1, button: 'secondary' }]);
    expect(() => system.cancelAll()).not.toThrow();
  });
});

describe('controles táctiles: varios dedos', () => {
  it('un botón sigue pulsado mientras quede un dedo', () => {
    const hold = new PointerHold();
    expect(hold.press(1)).toBe(true);
    expect(hold.press(2)).toBe(false);
    expect(hold.release(1)).toBe(false);
    expect(hold.down).toBe(true);
    expect(hold.release(2)).toBe(true);
    expect(hold.down).toBe(false);
    expect(hold.release(2)).toBe(false);
  });

  it('cargar el láser con un dedo y moverse con otro no interfiere, y soltar el láser dispara', () => {
    const laserBtn = new PointerHold();
    const right = new PointerHold();
    const h = harness();
    // finger 1 holds the laser, finger 2 holds "right"
    laserBtn.press(1);
    right.press(2);
    let fresh = true;
    for (let t = 0; t < 0.6; t += DT) {
      h.frame(laserBtn.down, fresh);
      fresh = false;
    }
    right.release(2); // moving finger leaves: the charge is untouched
    h.frame(laserBtn.down);
    expect(h.shots).toHaveLength(0);
    expect(right.down).toBe(false);
    laserBtn.release(1);
    h.frame(laserBtn.down);
    expect(h.shots).toHaveLength(1);
  });

  it('un dedo suelto que no pertenece al botón no lo libera', () => {
    const laserBtn = new PointerHold();
    laserBtn.press(1);
    expect(laserBtn.release(7)).toBe(false);
    expect(laserBtn.down).toBe(true);
  });

  it('la pausa suelta todos los dedos', () => {
    const laserBtn = new PointerHold();
    laserBtn.press(1);
    laserBtn.press(2);
    expect(laserBtn.clear()).toBe(true);
    expect(laserBtn.down).toBe(false);
    expect(laserBtn.clear()).toBe(false);
    // a finger still on the screen needs a new press
    expect(laserBtn.press(1)).toBe(true);
  });

  it('teclado y táctil usan el mismo estado: tocar y soltar rápido (un fotograma) dispara un tiro sin carga', () => {
    const h = harness();
    h.frame(true, true);
    h.frame(false);
    expect(h.shots).toHaveLength(1);
  });
});

describe('pantalla de afinidades: datos', () => {
  const nodes = affinityNodes(chart);

  it('muestra los cinco elementos en el orden del JSON con nombre y color', () => {
    expect(nodes.map((n) => n.id)).toEqual(['energy', 'laser', 'plasma', 'cryo', 'fire']);
    expect(nodes.map((n) => n.name)).toEqual(['Energia', 'Laser', 'Plasma', 'Criogenico', 'Fuego']);
    for (const n of nodes) expect(n.color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('cada elemento es fuerte contra uno (×1.5) y débil contra otro (×0.5)', () => {
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
    expect(byId.laser.strong).toEqual([{ id: 'plasma', name: 'Plasma', multiplier: 1.5 }]);
    expect(byId.laser.weak).toEqual([{ id: 'energy', name: 'Energia', multiplier: 0.5 }]);
    expect(byId.fire.strong.map((m) => m.id)).toEqual(['energy']);
    expect(byId.energy.weak.map((m) => m.id)).toEqual(['fire']);
    for (const n of nodes) {
      expect(n.strong).toHaveLength(1);
      expect(n.weak).toHaveLength(1);
    }
  });

  it('dibuja cinco flechas que cierran el círculo', () => {
    const arrows = affinityArrows(chart);
    expect(arrows.map((a) => `${a.from}>${a.to}`)).toEqual(['energy>laser', 'laser>plasma', 'plasma>cryo', 'cryo>fire', 'fire>energy']);
    expect(arrows.every((a) => a.multiplier === 1.5)).toBe(true);
  });

  it('refleja los cambios del JSON sin tocar código', () => {
    const custom = buildCatalogs({
      elements: { elements: { a: { name: 'A', color: '#ffffff' }, b: { name: 'B', color: '#000000' }, c: { name: 'C', color: '#ff0000' } }, cycle: ['a', 'b', 'c'], advantage: 2, disadvantage: 0.25 },
      statuses: {},
      enemies: {},
      abilities: {},
    });
    const result = affinityNodes(custom.chart);
    expect(result.map((n) => n.id)).toEqual(['a', 'b', 'c']);
    expect(result[0].strong[0].multiplier).toBe(2);
    expect(result[0].weak[0].multiplier).toBe(0.25);
  });
});

describe('pantalla de afinidades: navegación', () => {
  it('tienda → afinidades → tienda conserva la fila seleccionada', () => {
    for (const selected of [0, 2, 4]) {
      const there = toAffinity(selected);
      expect(there.key).toBe(PlatformerScenes.Affinity);
      const back = fromAffinity(there.data.selected);
      expect(back).toEqual({ key: PlatformerScenes.Shop, data: { selected } });
    }
  });

  it('las teclas no chocan con las de equipar ni con la vuelta', () => {
    expect(AFFINITY_KEYS.open).toBe('A');
    expect(AFFINITY_KEYS.back).toEqual(expect.arrayContaining(['ESC', 'A', 'ENTER']));
    expect(['F', 'R', 'E', 'ENTER', 'UP', 'DOWN']).not.toContain(AFFINITY_KEYS.open);
  });

  it('la escena está registrada en el módulo y tiene clave propia', () => {
    const index = readFileSync(join(ROOT, 'src/games/platformer/index.ts'), 'utf8');
    expect(index).toMatch(/scenes: \[[^\]]*PlatformerAffinityScene/);
    expect(new Set(Object.values(PlatformerScenes)).size).toBe(Object.values(PlatformerScenes).length);
  });

  it('la tienda ofrece el acceso y la pantalla ofrece la vuelta con las teclas definidas', () => {
    const shop = readFileSync(join(ROOT, 'src/games/platformer/scenes/PlatformerShopScene.ts'), 'utf8');
    const scene = readFileSync(join(ROOT, 'src/games/platformer/scenes/PlatformerAffinityScene.ts'), 'utf8');
    expect(shop).toMatch(/toAffinity\(/);
    expect(shop).toMatch(/AFFINITY_KEYS\.open/);
    expect(scene).toMatch(/fromAffinity\(/);
    expect(scene).toMatch(/AFFINITY_KEYS\.back/);
  });
});

describe('desbloqueo de armas centralizado en configuración', () => {
  const levelIds = (readJson('levels/levels.json').levels as string[]).map((f) => readJson(`levels/${f}`).id as string);

  it('todos los requisitos de abilities.json son niveles existentes', () => {
    for (const def of Object.values(abilities.abilities)) if (def.requires) expect(levelIds, def.id).toContain(def.requires);
  });

  it('el láser se desbloquea con ice-1 solo en el JSON', () => {
    expect(laser.requires).toBe('ice-1');
    const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
    const offenders = walk(join(ROOT, 'src')).filter((f) => /['"`](forest|ruins|ice|volcano)-\d+['"`]/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('la compra solo consulta el requisito configurado', () => {
    const profile = new Profile(abilities, memoryStorage());
    profile.recordStars('x', Array.from({ length: 100 }, (_, i) => `${i},0`));
    const asked: string[] = [];
    profile.purchase('laser-cannon', (id) => (asked.push(id), false));
    expect(asked).toEqual([laser.requires]);
  });
});

describe('armas en F y R al recargar', () => {
  const rich = (storage = memoryStorage()): Profile => {
    const p = new Profile(abilities, storage);
    p.recordStars('x', Array.from({ length: 300 }, (_, i) => `${i},0`));
    return p;
  };
  const all = (): boolean => true;
  const reload = (storage: ReturnType<typeof memoryStorage>): Profile => new Profile(abilities, storage);

  it('conserva dos armas distintas, su orden y su nivel', () => {
    const storage = memoryStorage();
    const p = rich(storage);
    for (const id of ['beam', 'beam', 'laser-cannon', 'flamethrower']) p.purchase(id, all);
    p.equipWeapon('laser-cannon', 'primary');
    p.equipWeapon('flamethrower', 'secondary');
    const again = reload(storage);
    expect(again.equippedOn('primary')).toBe('laser-cannon');
    expect(again.equippedOn('secondary')).toBe('flamethrower');
    expect(again.levelOf('beam')).toBe(2);
    expect(again.loadout().map((e) => [e.def.id, e.button])).toEqual([
      ['laser-cannon', 'primary'],
      ['flamethrower', 'secondary'],
    ]);
  });

  it('conserva un intercambio F↔R y una ranura vacía', () => {
    const storage = memoryStorage();
    const p = rich(storage);
    p.purchase('beam', all);
    p.purchase('flamethrower', all);
    p.equipWeapon('beam', 'secondary');
    expect(reload(storage).equippedOn('primary')).toBe('flamethrower');
    expect(reload(storage).equippedOn('secondary')).toBe('beam');
    p.unequipWeapon('primary');
    const again = reload(storage);
    expect(again.equippedOn('primary')).toBeUndefined();
    expect(again.equippedOn('secondary')).toBe('beam');
  });

  it('el JSON guardado tiene el formato v2 y recargar varias veces no lo altera', () => {
    const storage = memoryStorage();
    const p = rich(storage);
    p.purchase('laser-cannon', all);
    p.equipWeapon('laser-cannon', 'secondary');
    const first = storage.load();
    expect(JSON.parse(first ?? '{}')).toMatchObject({ version: 2, weapons: { primary: null, secondary: 'laser-cannon' } });
    reload(storage);
    reload(storage);
    expect(storage.load()).toBe(first);
  });
});
