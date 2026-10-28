import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({ default: { BlendModes: {}, Geom: { Rectangle: class {} }, Input: { Keyboard: { KeyCodes: {} } } } }));
vi.mock('../src/core/audio/Sfx', () => ({ playSound: () => undefined }));

import { BIOME_VARIANTS, BIOMES } from '../src/games/platformer/biomes';
import { ENEMY_SPRITES } from '../src/games/platformer/assets/enemySprites';
import { buildEnemyCatalog } from '../src/games/platformer/enemies/EnemyCatalog';
import { type LevelData } from '../src/games/platformer/level/LevelParser';
import { clearSandboxLevels, getSandboxLevel, registerSandboxLevel } from '../src/games/platformer/level/sandboxLevels';
import { validateLevel } from '../src/games/platformer/level/LevelValidator';
import { createDefaultRegistry } from '../src/games/platformer/objects/builtin';
import { type LevelObject, type ObjectContext, LevelObjectManager, ObjectConfigError, ObjectRegistry } from '../src/games/platformer/objects/LevelObjectManager';
import {
  boxesOverlap,
  doorShouldBeOpen,
  HazardCycle,
  hazardEnabled,
  PathMotion,
  SignalBus,
  SwitchModel,
} from '../src/games/platformer/objects/models';
import { OBJECT_TYPES, type BoostPlantConfig, type DoorConfig, type LevelObjectConfig, type SwitchConfig } from '../src/games/platformer/objects/types';
import type { SceneHost } from '../src/games/platformer/objects/sceneHost';
import { removeObjectTextures } from '../src/games/platformer/objects/objectArt';
import { validateObjects } from '../src/games/platformer/objects/validate';
import { buildObjectsSandbox, OBJECTS_SANDBOX_ID } from '../src/games/platformer/sandbox/objectsLevel';

const ROOT = join(__dirname, '..');
const ASSETS = join(ROOT, 'public/assets/platformer');
const readJson = (path: string): any => JSON.parse(readFileSync(join(ASSETS, path), 'utf8'));
const SIZE = { width: 64, height: 14 };
const enemies = buildEnemyCatalog(readJson('enemies/enemies.json'), Object.keys(ENEMY_SPRITES), {}).enemies;
const errorsOf = (raw: unknown, size = SIZE): string[] => validateObjects(raw, size).issues.filter((i) => i.severity === 'error').map((i) => i.message);

const timing = { mode: 'periodic', on: 1, off: 2, warning: 0.5, offset: 0 } as const;

describe('validación de la configuración JSON', () => {
  it('sin objetos (niveles antiguos) es válido y vacío', () => {
    for (const raw of [undefined, null, []]) expect(validateObjects(raw, SIZE)).toMatchObject({ ok: true, objects: [], issues: [] });
  });

  it('aplica valores por defecto y normaliza cada tipo', () => {
    const { objects, ok } = validateObjects(
      [
        { type: 'movingPlatform', col: 2, row: 10, axis: 'x', travel: 5 },
        { type: 'laser', col: 10, row: 3, orientation: 'vertical' },
        { type: 'electricFloor', col: 20, row: 11 },
        { type: 'switch', id: 'a', col: 4, row: 11 },
        { type: 'door', col: 30, row: 9, opensWith: 'a' },
      ],
      SIZE,
    );
    expect(ok).toBe(true);
    expect(objects[0]).toMatchObject({ width: 3, speed: 40, wait: 0.5, offset: 0 });
    expect(objects[1]).toMatchObject({ mode: 'periodic', on: 1.5, off: 1.5, warning: 0.6, length: 4, damage: 1 });
    expect(objects[2]).toMatchObject({ width: 3, damage: 1, mode: 'periodic' });
    expect(objects[3]).toMatchObject({ duration: 0 });
    expect(objects[4]).toMatchObject({ height: 3, opensWith: ['a'], inverted: false });
  });

  it('valida parámetros configurables del suelo tóxico', () => {
    const result = validateObjects([{ type: 'toxicFloor', col: 5, row: 11 }], SIZE);
    expect(result.ok).toBe(true);
    expect(result.objects[0]).toMatchObject({ width: 3, damage: 1, interval: 1, mode: 'periodic', warning: 0.6 });
    expect(errorsOf([{ type: 'toxicFloor', col: 5, row: 11, interval: 0 }])[0]).toMatch(/"interval"/);
    expect(errorsOf([{ type: 'toxicFloor', col: 62, row: 11, width: 3 }])[0]).toMatch(/se sale del nivel/);
  });

  it('valida dirección y fuerza de la planta impulsora', () => {
    const result = validateObjects([{ type: 'boostPlant', col: 3, row: 10, direction: 'up-right', force: 520 }], SIZE);
    expect(result.ok).toBe(true);
    expect(result.objects[0]).toMatchObject({ direction: 'up-right', force: 520 });
    expect(errorsOf([{ type: 'boostPlant', col: 3, row: 10, force: 700 }])[0]).toMatch(/"force"/);
    expect(errorsOf([{ type: 'boostPlant', col: 3, row: 10, direction: 'down' }])[0]).toMatch(/"direction"/);
  });

  it('valida nodos como señales y puertas membrane como puertas existentes', () => {
    const result = validateObjects([
      { type: 'organicNode', id: 'root', col: 1, row: 10, mode: 'toggle' },
      { type: 'door', id: 'membrane', col: 8, row: 8, height: 3, opensWith: 'root', style: 'membrane' },
      { type: 'laser', col: 20, row: 2, orientation: 'vertical', length: 3, enabledBy: 'root' },
    ], SIZE);
    expect(result.ok).toBe(true);
    expect(result.objects[0]).toMatchObject({ type: 'organicNode', id: 'root', mode: 'toggle' });
    expect(result.objects[1]).toMatchObject({ type: 'door', style: 'membrane', opensWith: ['root'] });
    expect(errorsOf([{ type: 'organicNode', col: 1, row: 10 }])[0]).toMatch(/"id" es obligatorio/);
    expect(errorsOf([{ type: 'organicNode', id: 'timed', col: 1, row: 10, mode: 'timed', duration: 0 }])[0]).toMatch(/"duration"/);
  });

  it('rechaza tipos desconocidos y campos mal escritos (nada falla en silencio)', () => {
    expect(errorsOf([{ type: 'trampoline', col: 1, row: 1 }])[0]).toMatch(/"type" debe ser uno de: movingPlatform/);
    expect(errorsOf([{ type: 'laser', col: 1, row: 1, orientation: 'vertical', lenght: 3 }])[0]).toMatch(/campo desconocido "lenght"/);
    expect(errorsOf([{ type: 'laser', col: 1, row: 1 }])[0]).toMatch(/orientation.*obligatorio/);
    expect(errorsOf(['x', 5])).toHaveLength(2);
    expect(errorsOf({ type: 'laser' })[0]).toMatch(/debe ser una lista/);
  });

  it('valida coordenadas y límites del nivel', () => {
    expect(errorsOf([{ type: 'switch', id: 'a', col: -1, row: 0 }])[0]).toMatch(/"col"/);
    expect(errorsOf([{ type: 'switch', id: 'a', col: 1.5, row: 0 }])[0]).toMatch(/entero/);
    expect(errorsOf([{ type: 'switch', id: 'a', col: 64, row: 0 }])[0]).toMatch(/"col"/);
    expect(errorsOf([{ type: 'switch', id: 'a', col: 0, row: 14 }])[0]).toMatch(/"row"/);
    expect(errorsOf([{ type: 'movingPlatform', col: 60, row: 5, axis: 'x', travel: 5 }])[0]).toMatch(/se sale del nivel/);
    expect(errorsOf([{ type: 'movingPlatform', col: 5, row: 2, axis: 'y', travel: -5 }])[0]).toMatch(/se sale del nivel/);
    expect(errorsOf([{ type: 'laser', col: 60, row: 3, orientation: 'horizontal', length: 10 }])[0]).toMatch(/derecha/);
    expect(errorsOf([{ type: 'laser', col: 3, row: 10, orientation: 'vertical', length: 10 }])[0]).toMatch(/abajo/);
    expect(errorsOf([{ type: 'electricFloor', col: 62, row: 11, width: 5 }])[0]).toMatch(/se sale/);
    expect(errorsOf([{ type: 'switch', id: 'a', col: 1, row: 1 }, { type: 'door', col: 3, row: 12, height: 4, opensWith: 'a' }])[0]).toMatch(/abajo/);
  });

  it('valida rangos de velocidad, tiempos y daño', () => {
    const platform = (extra: object) => [{ type: 'movingPlatform', col: 5, row: 5, axis: 'x', travel: 3, ...extra }];
    expect(errorsOf(platform({ speed: 5 }))[0]).toMatch(/"speed"/);
    expect(errorsOf(platform({ speed: 500 }))[0]).toMatch(/"speed"/);
    expect(errorsOf(platform({ wait: -1 }))[0]).toMatch(/"wait"/);
    expect(errorsOf(platform({ travel: 0 }))).toContain('movingPlatform: "travel" no puede ser 0');
    expect(errorsOf(platform({ axis: 'z' }))[0]).toMatch(/"axis"/);
    const laser = (extra: object) => [{ type: 'laser', col: 5, row: 2, orientation: 'vertical', length: 3, ...extra }];
    expect(errorsOf(laser({ on: 0 }))[0]).toMatch(/"on"/);
    expect(errorsOf(laser({ off: 99 }))[0]).toMatch(/"off"/);
    expect(errorsOf(laser({ warning: 6 }))[0]).toMatch(/"warning"/);
    expect(errorsOf(laser({ damage: 0 }))[0]).toMatch(/"damage"/);
    expect(errorsOf(laser({ mode: 'sometimes' }))[0]).toMatch(/"mode"/);
    expect(errorsOf([{ type: 'switch', id: 'a', col: 1, row: 1, duration: 500 }])[0]).toMatch(/"duration"/);
  });

  it('exige identificadores únicos y válidos', () => {
    const sw = (id: string, col: number) => ({ type: 'switch', id, col, row: 5 });
    expect(errorsOf([sw('a', 1), sw('a', 2)])[0]).toMatch(/id duplicado "a" \(también en objects\[0\]\)/);
    expect(errorsOf([{ type: 'switch', col: 1, row: 1 }])[0]).toMatch(/"id" es obligatorio/);
    expect(errorsOf([sw('Bad Id', 1)])[0]).toMatch(/debe ser un id/);
    expect(errorsOf([{ type: 'laser', id: 'x', col: 1, row: 1, orientation: 'horizontal' }, { type: 'door', id: 'x', col: 5, row: 5, opensWith: 'a' }]).join()).toMatch(/duplicado/);
  });

  it('comprueba las referencias entre interruptores, puertas y peligros', () => {
    const sw = { type: 'switch', id: 'a', col: 1, row: 5 };
    expect(errorsOf([sw, { type: 'door', col: 8, row: 5, opensWith: ['a', 'ghost'] }])[0]).toMatch(/"opensWith" apunta a "ghost", que no existe/);
    expect(errorsOf([{ type: 'door', id: 'd', col: 8, row: 5, opensWith: 'a' }, { type: 'door', col: 9, row: 5, opensWith: 'd' }])).toEqual(expect.arrayContaining([expect.stringMatching(/"d", que no es un interruptor|"a", que no existe/)]));
    expect(errorsOf([sw, { type: 'laser', col: 3, row: 3, orientation: 'vertical', enabledBy: 'nope' }])[0]).toMatch(/"enabledBy" apunta a "nope"/);
    expect(errorsOf([sw, { type: 'laser', col: 3, row: 3, orientation: 'vertical', enabledBy: 'a', disabledBy: 'a' }])[0]).toMatch(/no ambos/);
    expect(errorsOf([{ type: 'door', col: 8, row: 5, opensWith: [] }])[0]).toMatch(/"opensWith" es obligatorio/);
  });

  it('avisa (sin error) de interruptores que nada usa', () => {
    const result = validateObjects([{ type: 'switch', id: 'lonely', col: 1, row: 5 }], SIZE);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([{ severity: 'warning', index: 0, message: 'switch "lonely": ningún objeto lo usa' }]);
  });

  it('los objetos con errores no llegan a la lista normalizada', () => {
    const result = validateObjects([{ type: 'switch', id: 'ok', col: 1, row: 5 }, { type: 'laser', col: 1, row: 1 }], SIZE);
    expect(result.ok).toBe(false);
    expect(result.objects.map((o) => o.type)).toEqual(['switch']);
  });

  it('acepta una puerta con varios interruptores y varias puertas con el mismo interruptor', () => {
    const list = [
      { type: 'switch', id: 'a', col: 1, row: 5 },
      { type: 'switch', id: 'b', col: 2, row: 5 },
      { type: 'door', col: 8, row: 5, opensWith: ['a', 'b', 'a'] },
      { type: 'door', col: 9, row: 5, opensWith: 'a', inverted: true },
    ];
    const { objects, ok } = validateObjects(list, SIZE);
    expect(ok).toBe(true);
    expect((objects[2] as DoorConfig).opensWith).toEqual(['a', 'b']);
  });
});

describe('integración con el validador de niveles', () => {
  const level = (objects?: unknown): unknown => ({
    id: 'objs',
    name: 'Objs',
    biome: 'ruins',
    height: 12,
    sections: [{ rows: ['.P........', '##########', '##########'] }, { rows: ['..........', '##########', '##########'] }, { rows: ['.........O', '##########', '##########'] }],
    ...(objects === undefined ? {} : { objects }),
  });
  const run = (raw: unknown) => validateLevel(raw, Object.keys(BIOMES), enemies, BIOME_VARIANTS);

  it('un nivel sin "objects" se valida exactamente como antes', () => {
    expect(run(level()).ok).toBe(true);
    expect(run(level([])).ok).toBe(true);
  });

  it('un error de objetos invalida el nivel con el índice del objeto', () => {
    const result = run(level([{ type: 'laser', col: 1, row: 1, orientation: 'sideways' }]));
    expect(result.ok).toBe(false);
    expect(result.issues.map((i) => i.message).join()).toMatch(/objects\[0\].*orientation/);
  });

  it('las dimensiones salen del nivel parseado', () => {
    expect(run(level([{ type: 'electricFloor', col: 29, row: 10, width: 1 }])).ok).toBe(true);
    expect(run(level([{ type: 'electricFloor', col: 30, row: 10, width: 1 }])).ok).toBe(false);
  });

  it('los cuatro niveles originales siguen válidos y sin objetos', () => {
    for (const file of (readJson('levels/levels.json').levels as string[]).filter((f) => !f.includes('/'))) {
      const raw = readJson(`levels/${file}`);
      expect(raw.objects, file).toBeUndefined();
      const result = run(raw);
      expect(result.ok, file).toBe(true);
      expect(result.issues.filter((i) => i.severity === 'error'), file).toEqual([]);
    }
  });
});

describe('señales', () => {
  it('notifica solo los cambios reales y permite darse de baja', () => {
    const bus = new SignalBus();
    const log: string[] = [];
    const off = bus.onChange((id, on) => log.push(`${id}:${on}`));
    bus.set('a', true);
    bus.set('a', true);
    bus.set('a', false);
    off();
    bus.set('a', true);
    expect(log).toEqual(['a:true', 'a:false']);
    expect(bus.isOn('a')).toBe(true);
    expect(bus.isOn('zzz')).toBe(false);
    bus.clear();
    expect(bus.isOn('a')).toBe(false);
  });
});

describe('temporizadores de peligros', () => {
  const run = (cycle: HazardCycle, seconds: number, dt = 0.05): string[] => {
    const phases: string[] = [];
    for (let t = 0; t < seconds - 1e-9; t += dt) {
      cycle.update(dt);
      phases.push(cycle.phase);
    }
    return phases;
  };

  it('periódico: apagado → aviso → activo, y se repite', () => {
    const cycle = new HazardCycle({ ...timing });
    expect(cycle.phase).toBe('off');
    cycle.update(1.9);
    expect(cycle.phase).toBe('off');
    cycle.update(0.2);
    expect(cycle.phase).toBe('warning');
    cycle.update(0.5);
    expect(cycle.phase).toBe('active');
    expect(cycle.isActive).toBe(true);
    cycle.update(1);
    expect(cycle.phase).toBe('off');
    cycle.update(2.6);
    expect(cycle.phase).toBe('active');
  });

  it('el aviso siempre precede al daño', () => {
    const phases = run(new HazardCycle({ ...timing }), 10);
    phases.forEach((p, i) => {
      if (p === 'active' && phases[i - 1] === 'off') throw new Error('active without warning');
    });
    expect(new Set(phases)).toEqual(new Set(['off', 'warning', 'active']));
  });

  it('las duraciones de cada fase son las configuradas', () => {
    const phases = run(new HazardCycle({ ...timing }), 3.5, 0.01);
    const count = (p: string): number => phases.filter((x) => x === p).length * 0.01;
    expect(count('off')).toBeCloseTo(2, 1);
    expect(count('warning')).toBeCloseTo(0.5, 1);
    expect(count('active')).toBeCloseTo(1, 1);
  });

  it('offset adelanta el ciclo para desincronizar peligros', () => {
    expect(new HazardCycle({ ...timing, offset: 2.2 }).phase).toBe('warning');
    expect(new HazardCycle({ ...timing, offset: 2.6 }).phase).toBe('active');
  });

  it('pasos muy largos siguen el ciclo (módulo) sin saltarse estados incoherentes', () => {
    const cycle = new HazardCycle({ ...timing });
    cycle.update(3.5 * 7 + 2.1);
    expect(cycle.phase).toBe('warning');
  });

  it('permanente: activo desde el inicio', () => {
    const cycle = new HazardCycle({ ...timing, mode: 'permanent' });
    expect(cycle.phase).toBe('active');
    cycle.update(100);
    expect(cycle.phase).toBe('active');
  });

  it('desactivado por un interruptor: apagado y, al reactivarse, vuelve a avisar', () => {
    const cycle = new HazardCycle({ ...timing });
    cycle.update(3);
    expect(cycle.phase).toBe('active');
    cycle.setEnabled(false);
    cycle.update(10);
    expect(cycle.phase).toBe('off');
    expect(cycle.time).toBe(0);
    cycle.setEnabled(true);
    expect(cycle.phase).toBe('off');
    cycle.update(2.1);
    expect(cycle.phase).toBe('warning');
  });

  it('un peligro permanente reactivado avisa antes de dañar', () => {
    const cycle = new HazardCycle({ ...timing, mode: 'permanent', warning: 0.6 });
    cycle.setEnabled(false);
    cycle.setEnabled(true);
    expect(cycle.phase).toBe('warning');
    cycle.update(0.7);
    expect(cycle.phase).toBe('active');
  });

  it('enabledBy / disabledBy según el estado del interruptor', () => {
    const bus = new SignalBus();
    expect(hazardEnabled({}, bus)).toBe(true);
    expect(hazardEnabled({ enabledBy: 's' }, bus)).toBe(false);
    expect(hazardEnabled({ disabledBy: 's' }, bus)).toBe(true);
    bus.set('s', true);
    expect(hazardEnabled({ enabledBy: 's' }, bus)).toBe(true);
    expect(hazardEnabled({ disabledBy: 's' }, bus)).toBe(false);
  });

  it('un dt negativo o cero no hace avanzar el ciclo', () => {
    const cycle = new HazardCycle({ ...timing });
    cycle.update(-5);
    cycle.update(0);
    expect(cycle.time).toBe(0);
  });

  it('colisión por cajas solo cuando se solapan', () => {
    const a = { x: 0, y: 0, width: 10, height: 10 };
    expect(boxesOverlap(a, { x: 9, y: 9, width: 5, height: 5 })).toBe(true);
    expect(boxesOverlap(a, { x: 10, y: 0, width: 5, height: 5 })).toBe(false);
  });
});

describe('movimiento de plataformas', () => {
  const spec = { travel: 4, speed: 32, wait: 1, offset: 0, tileSize: 16 };

  it('va y vuelve entre los dos extremos con espera', () => {
    const m = new PathMotion(spec);
    expect(m.length).toBe(64);
    m.update(1);
    expect(m.pos).toBeCloseTo(32);
    m.update(1);
    expect(m.pos).toBe(64);
    expect(m.velocity).toBe(0);
    m.update(0.5);
    expect(m.pos).toBe(64);
    m.update(1);
    expect(m.pos).toBeCloseTo(48);
    expect(m.velocity).toBe(-32);
    m.update(1.5);
    expect(m.pos).toBe(0);
    m.update(0.9);
    expect(m.pos).toBe(0);
    m.update(0.6);
    expect(m.pos).toBeCloseTo(16);
  });

  it('es independiente de la tasa de fotogramas', () => {
    const coarse = new PathMotion(spec);
    const fine = new PathMotion(spec);
    for (let i = 0; i < 50; i++) coarse.update(0.2);
    for (let i = 0; i < 1000; i++) fine.update(0.01);
    expect(coarse.pos).toBeCloseTo(fine.pos, 3);
    const jump = new PathMotion(spec);
    jump.update(10);
    expect(jump.pos).toBeCloseTo(fine.pos, 3);
  });

  it('no se sale nunca del recorrido', () => {
    const m = new PathMotion({ ...spec, speed: 160, wait: 0 });
    for (let i = 0; i < 500; i++) {
      m.update(0.037);
      expect(m.pos).toBeGreaterThanOrEqual(0);
      expect(m.pos).toBeLessThanOrEqual(64);
    }
  });

  it('recorrido negativo (izquierda / arriba) y desfase inicial', () => {
    const up = new PathMotion({ ...spec, travel: -4, offset: 0.5 });
    expect(up.displacement).toBeCloseTo(-32);
    up.update(0.5);
    expect(up.displacement).toBeCloseTo(-48);
    expect(up.velocity).toBe(-32);
  });

  it('velocidad cero o recorrido vacío dejan la plataforma quieta', () => {
    const still = new PathMotion({ ...spec, speed: 0 });
    still.update(5);
    expect(still.pos).toBe(0);
  });
});

describe('interruptores y puertas', () => {
  it('un interruptor permanente se queda activado', () => {
    const bus = new SignalBus();
    const sw = new SwitchModel('a', 0, bus);
    expect(sw.activate()).toBe(true);
    expect(sw.activate()).toBe(false);
    sw.update(1000);
    expect(sw.isOn).toBe(true);
    expect(bus.isOn('a')).toBe(true);
  });

  it('un interruptor temporizado se apaga y reactivarlo renueva el tiempo', () => {
    const bus = new SignalBus();
    const sw = new SwitchModel('a', 2, bus);
    sw.activate();
    sw.update(1.5);
    expect(sw.timeLeft).toBeCloseTo(0.5);
    sw.activate();
    expect(sw.timeLeft).toBe(2);
    sw.update(1.9);
    expect(bus.isOn('a')).toBe(true);
    sw.update(0.2);
    expect(sw.isOn).toBe(false);
    expect(bus.isOn('a')).toBe(false);
  });

  it('reset suelta la señal', () => {
    const bus = new SignalBus();
    const sw = new SwitchModel('a', 0, bus);
    sw.activate();
    sw.reset();
    expect(bus.isOn('a')).toBe(false);
    expect(sw.isOn).toBe(false);
  });

  it('la puerta se abre con el interruptor y se cierra al apagarse', () => {
    const bus = new SignalBus();
    expect(doorShouldBeOpen(['a'], false, bus)).toBe(false);
    bus.set('a', true);
    expect(doorShouldBeOpen(['a'], false, bus)).toBe(true);
    bus.set('a', false);
    expect(doorShouldBeOpen(['a'], false, bus)).toBe(false);
  });

  it('varias puertas dependen del mismo interruptor; una puerta con varios exige todos', () => {
    const bus = new SignalBus();
    bus.set('a', true);
    expect([['a'], ['a']].map((s) => doorShouldBeOpen(s, false, bus))).toEqual([true, true]);
    expect(doorShouldBeOpen(['a', 'b'], false, bus)).toBe(false);
    bus.set('b', true);
    expect(doorShouldBeOpen(['a', 'b'], false, bus)).toBe(true);
  });

  it('puerta invertida: abierta por defecto y cerrada con el interruptor', () => {
    const bus = new SignalBus();
    expect(doorShouldBeOpen(['a'], true, bus)).toBe(true);
    bus.set('a', true);
    expect(doorShouldBeOpen(['a'], true, bus)).toBe(false);
  });

  it('un interruptor temporizado cierra la puerta al terminar el tiempo', () => {
    const bus = new SignalBus();
    const sw = new SwitchModel('a', 1, bus);
    sw.activate();
    expect(doorShouldBeOpen(['a'], false, bus)).toBe(true);
    sw.update(1.1);
    expect(doorShouldBeOpen(['a'], false, bus)).toBe(false);
  });
});

/** Fake host: factories built from the real models, so lifecycle and signals are exercised without Phaser. */
interface FakeHost {
  log: string[];
}

function fakeRegistry(): ObjectRegistry<FakeHost> {
  const make = <C extends LevelObjectConfig>(config: C, host: FakeHost, tag: string, update?: (dt: number) => void): LevelObject<C> => {
    host.log.push(`create:${tag}`);
    let destroyed = false;
    return {
      config,
      update: (dt) => update?.(dt),
      destroy: () => {
        if (destroyed) return;
        destroyed = true;
        host.log.push(`destroy:${tag}`);
      },
    };
  };
  return new ObjectRegistry<FakeHost>()
    .register('movingPlatform', (c, ctx) => {
      const motion = new PathMotion({ travel: c.travel, speed: c.speed, wait: c.wait, offset: c.offset, tileSize: 16 });
      const object = make(c, ctx, 'platform', (dt) => motion.update(dt));
      return Object.assign(object, { motion });
    })
    .register('laser', (c, ctx) => {
      const cycle = new HazardCycle(c);
      const object = make(c, ctx, 'laser', (dt) => {
        cycle.setEnabled(hazardEnabled(c, ctx.signals));
        cycle.update(dt);
      });
      return Object.assign(object, { cycle });
    })
    .register('electricFloor', (c, ctx) => make(c, ctx, 'floor'))
    .register('switch', (c: SwitchConfig, ctx) => {
      const model = new SwitchModel(c.id, c.duration, ctx.signals);
      const object = make(c, ctx, `switch:${c.id}`, (dt) => model.update(dt));
      return Object.assign(object, { model });
    })
    .register('door', (c, ctx) => {
      const state = { open: false };
      const object = make(c, ctx, 'door', () => void (state.open = doorShouldBeOpen(c.opensWith, c.inverted, ctx.signals)));
      return Object.assign(object, { state });
    });
}

const LEVEL_OBJECTS = [
  { type: 'movingPlatform', id: 'p', col: 2, row: 5, axis: 'x', travel: 4, speed: 32, wait: 0 },
  { type: 'switch', id: 's', col: 10, row: 11, duration: 1 },
  { type: 'laser', id: 'l', col: 20, row: 2, orientation: 'vertical', length: 4, on: 1, off: 1, warning: 0.5, disabledBy: 's' },
  { type: 'door', id: 'd', col: 30, row: 8, opensWith: 's' },
  { type: 'electricFloor', col: 40, row: 11 },
];

describe('registro y gestor de objetos', () => {
  const setup = () => {
    const host: FakeHost = { log: [] };
    const manager = new LevelObjectManager(fakeRegistry(), host);
    return { host, manager };
  };

  it('el registro integrado cubre todos los tipos y no admite duplicados ni tipos inventados', () => {
    const registry = createDefaultRegistry();
    expect(registry.types.sort()).toEqual([...OBJECT_TYPES].sort());
    for (const type of OBJECT_TYPES) expect(registry.has(type)).toBe(true);
    expect(() => registry.register('laser', (() => undefined) as never)).toThrow(/already registered/);
    expect(() => new ObjectRegistry<object>().register('portal' as never, (() => undefined) as never)).toThrow(/Unknown object type/);
  });

  it('crea cada objeto con su constructor, en orden', () => {
    const { host, manager } = setup();
    const created = manager.load(LEVEL_OBJECTS, SIZE);
    expect(created.map((o) => o.config.type)).toEqual(['movingPlatform', 'switch', 'laser', 'door', 'electricFloor']);
    expect(host.log).toEqual(['create:platform', 'create:switch:s', 'create:laser', 'create:door', 'create:floor']);
    expect(manager.count).toBe(5);
    expect(manager.get('d')?.config.type).toBe('door');
    expect(manager.get('nope')).toBeUndefined();
  });

  it('un tipo sin constructor registrado falla de forma explícita', () => {
    const registry = new ObjectRegistry<FakeHost>();
    const manager = new LevelObjectManager(registry, { log: [] });
    expect(() => manager.load([{ type: 'switch', id: 'a', col: 1, row: 1 }], SIZE)).toThrow(/No constructor registered for object type "switch"/);
  });

  it('una configuración inválida lanza ObjectConfigError con todos los problemas y no crea nada', () => {
    const { host, manager } = setup();
    let error: unknown;
    try {
      manager.load([{ type: 'laser', col: 1, row: 1 }, { type: 'ufo', col: 1, row: 1 }, { type: 'switch', id: 'ok', col: 2, row: 2 }], SIZE);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ObjectConfigError);
    expect((error as ObjectConfigError).issues.filter((i) => i.severity === 'error')).toHaveLength(2);
    expect((error as Error).message).toMatch(/objects\[0\].*\n.*objects\[1\]/);
    expect(host.log).toEqual([]);
    expect(manager.count).toBe(0);
  });

  it('si un constructor falla, destruye lo ya creado y propaga el error', () => {
    const host: FakeHost = { log: [] };
    const broken = new ObjectRegistry<FakeHost>();
    const manager = new LevelObjectManager(
      broken
        .register('switch', (c, ctx) => {
          ctx.log.push('create:switch');
          return { config: c, update: () => undefined, destroy: () => void ctx.log.push('destroy:switch') };
        })
        .register('door', () => {
          throw new Error('boom');
        }),
      host,
    );
    expect(() => manager.load([{ type: 'switch', id: 'a', col: 1, row: 1 }, { type: 'door', col: 5, row: 5, opensWith: 'a' }], SIZE)).toThrow('boom');
    expect(host.log).toEqual(['create:switch', 'destroy:switch']);
    expect(manager.count).toBe(0);
  });

  it('los objetos comparten el bus de señales: interruptor → puerta y peligro', () => {
    const { manager } = setup();
    const [, sw, laser, door] = manager.load(LEVEL_OBJECTS, SIZE) as unknown as Array<{ model: SwitchModel; cycle: HazardCycle; state: { open: boolean } }>;
    manager.update(0.016);
    expect(door.state.open).toBe(false);
    sw.model.activate();
    manager.update(0.016);
    expect(door.state.open).toBe(true);
    // the laser is disabled while the timed switch is on
    manager.update(0.1);
    expect(laser.cycle.phase).toBe('off');
    for (let i = 0; i < 12; i++) manager.update(0.1);
    expect(sw.model.isOn).toBe(false);
    manager.update(0.016);
    expect(door.state.open).toBe(false);
    // enabled again: its cycle restarted from the beginning
    expect(laser.cycle.time).toBeLessThan(0.5);
  });

  it('update avanza los objetos y recorta los pasos enormes', () => {
    const { manager } = setup();
    const [platform] = manager.load(LEVEL_OBJECTS, SIZE) as unknown as Array<{ motion: PathMotion }>;
    manager.update(0.05);
    expect(platform.motion.pos).toBeCloseTo(1.6);
    manager.update(60);
    expect(platform.motion.pos).toBeCloseTo(1.6 + 3.2, 5);
    manager.update(-1);
    expect(platform.motion.pos).toBeCloseTo(4.8, 5);
  });

  it('la planta impulsa una vez por contacto, se rearma al salir y limpia su sprite', () => {
    const body = { x: 0, y: 8, width: 12, height: 12, velocity: { x: 0, y: 0 }, setVelocityX: vi.fn(), setVelocityY: vi.fn() };
    const player = { body, isAlive: true };
    const sprite = { setOrigin: vi.fn().mockReturnThis(), setDepth: vi.fn().mockReturnThis(), setTexture: vi.fn().mockReturnThis(), destroy: vi.fn() };
    const scene = { textures: { exists: () => true }, add: { image: () => sprite }, sound: { mute: true } };
    const fx = { jump: vi.fn() };
    const config: BoostPlantConfig = { type: 'boostPlant', col: 0, row: 0, direction: 'up-left', force: 300 };
    const context = { scene, player, fx, damagePlayer: vi.fn(), signals: new SignalBus() } as unknown as ObjectContext<SceneHost>;
    const plant = createDefaultRegistry().create(config, context);

    plant.update(0.016);
    expect(body.setVelocityX).toHaveBeenCalledWith(-165);
    expect(body.setVelocityY).toHaveBeenCalledWith(-300);
    expect(fx.jump).toHaveBeenCalledOnce();
    plant.update(0.016);
    expect(body.setVelocityY).toHaveBeenCalledOnce();
    body.x = 40;
    plant.update(0.016);
    body.x = 0;
    plant.update(0.016);
    expect(body.setVelocityY).toHaveBeenCalledTimes(2);
    expect(fx.jump).toHaveBeenCalledTimes(2);
    plant.destroy();
    plant.destroy();
    expect(sprite.destroy).toHaveBeenCalledOnce();
  });

  it('el suelo tóxico daña con intervalo, respeta invulnerabilidad y limpia sus celdas', () => {
    const body = { x: 0, y: 10, width: 12, height: 10 };
    const player = { body, isAlive: true, isInvulnerable: false };
    const cells = Array.from({ length: 2 }, () => ({ setOrigin: vi.fn().mockReturnThis(), setDepth: vi.fn().mockReturnThis(), setTexture: vi.fn(), destroy: vi.fn() }));
    let cellIndex = 0;
    const scene = { textures: { exists: () => true }, add: { image: () => cells[cellIndex++] }, sound: { mute: true } };
    const damagePlayer = vi.fn();
    const fx = { impact: vi.fn() };
    const context = { scene, player, fx, damagePlayer, signals: new SignalBus() } as unknown as ObjectContext<SceneHost>;
    const config = { type: 'toxicFloor', col: 0, row: 0, width: 2, damage: 1, interval: 0.5, mode: 'periodic', on: 2, off: 0.2, warning: 0.3, offset: 0 } as const;
    const floor = createDefaultRegistry().create(config, context);

    floor.update(0.21);
    expect(damagePlayer).not.toHaveBeenCalled();
    floor.update(0.3);
    expect(damagePlayer).toHaveBeenCalledTimes(1);
    expect(damagePlayer).toHaveBeenLastCalledWith({ amount: 1, form: 'area', element: 'plasma', fromX: 16 });
    player.isInvulnerable = true;
    floor.update(0.5);
    expect(damagePlayer).toHaveBeenCalledTimes(1);
    player.isInvulnerable = false;
    floor.update(0.5);
    expect(damagePlayer).toHaveBeenCalledTimes(2);
    expect(fx.impact).toHaveBeenCalledTimes(3);
    floor.destroy();
    floor.destroy();
    expect(cells.every((cell) => cell.destroy.mock.calls.length === 1)).toBe(true);
  });

  it('el nodo orgánico conmuta una puerta membrane por contacto y limpia señal/collider al reiniciar', () => {
    const makeSprite = () => ({
      body: { enable: true, setAllowGravity: vi.fn(), setImmovable: vi.fn(), setSize: vi.fn().mockReturnThis(), setOffset: vi.fn() },
      setOrigin: vi.fn().mockReturnThis(), setDepth: vi.fn().mockReturnThis(), setTexture: vi.fn().mockReturnThis(),
      setVisible: vi.fn(), setAlpha: vi.fn(), destroy: vi.fn(),
    });
    const nodeSprite = makeSprite();
    const doorSprite = makeSprite();
    const collider = { destroy: vi.fn() };
    const doorImage = vi.fn(() => doorSprite);
    const player = { body: { x: 2, y: 2, width: 12, height: 12 }, isAlive: true };
    const scene = {
      textures: { exists: () => true }, add: { image: () => nodeSprite },
      physics: { add: { image: doorImage, collider: () => collider } }, sound: { mute: true },
    };
    const fx = { checkpoint: vi.fn(), step: vi.fn() };
    const context = { scene, player, fx, damagePlayer: vi.fn(), signals: new SignalBus() } as unknown as ObjectContext<SceneHost>;
    const manager = new LevelObjectManager(createDefaultRegistry(), context);
    manager.load([
      { type: 'organicNode', id: 'root', col: 0, row: 0, mode: 'toggle' },
      { type: 'door', id: 'wall', col: 4, row: 0, height: 2, opensWith: 'root', style: 'membrane' },
    ], SIZE);

    manager.update(0.016);
    expect(manager.signals.isOn('root')).toBe(true);
    expect(hazardEnabled({ enabledBy: 'root' }, manager.signals)).toBe(true);
    expect(doorImage).toHaveBeenCalledWith(64, 0, 'platformer.obj.door.membrane.2');
    expect(doorSprite.body.enable).toBe(false);
    expect(doorSprite.setVisible).toHaveBeenLastCalledWith(false);
    manager.update(0.016);
    expect(fx.checkpoint).toHaveBeenCalledOnce();
    player.body.x = 80;
    manager.update(0.016);
    player.body.x = 2;
    manager.update(0.016);
    expect(manager.signals.isOn('root')).toBe(false);
    expect(hazardEnabled({ enabledBy: 'root' }, manager.signals)).toBe(false);
    expect(doorSprite.body.enable).toBe(true);
    manager.destroy();
    expect(collider.destroy).toHaveBeenCalledOnce();
    expect(nodeSprite.destroy).toHaveBeenCalledOnce();
    expect(doorSprite.destroy).toHaveBeenCalledOnce();
    expect(manager.signals.isOn('root')).toBe(false);
  });
});

describe('pausa y reanudación', () => {
  it('en pausa nada avanza (plataformas, peligros ni interruptores temporizados) y al reanudar continúa', () => {
    const manager = new LevelObjectManager(fakeRegistry(), { log: [] });
    const [platform, sw, laser] = manager.load(LEVEL_OBJECTS, SIZE) as unknown as Array<{ motion: PathMotion; model: SwitchModel; cycle: HazardCycle }>;
    sw.model.activate();
    manager.update(0.2);
    const snapshot = { pos: platform.motion.pos, time: laser.cycle.time, left: sw.model.timeLeft };
    manager.pause();
    expect(manager.paused).toBe(true);
    for (let i = 0; i < 100; i++) manager.update(0.05);
    expect({ pos: platform.motion.pos, time: laser.cycle.time, left: sw.model.timeLeft }).toEqual(snapshot);
    manager.resume();
    manager.update(0.1);
    expect(platform.motion.pos).toBeGreaterThan(snapshot.pos);
    expect(sw.model.timeLeft).toBeCloseTo(snapshot.left - 0.1);
  });

  it('pausar dos veces o reanudar sin pausa es inocuo', () => {
    const manager = new LevelObjectManager(fakeRegistry(), { log: [] });
    manager.load([], SIZE);
    manager.resume();
    manager.pause();
    manager.pause();
    manager.resume();
    expect(manager.paused).toBe(false);
  });

  it('un respawn desde checkpoint reactiva el suelo tóxico con aviso y no hereda el pulso', () => {
    const body = { x: 0, y: 10, width: 12, height: 10 };
    const player = { body, isAlive: true, isInvulnerable: false };
    const cell = { setOrigin: vi.fn().mockReturnThis(), setDepth: vi.fn().mockReturnThis(), setTexture: vi.fn(), destroy: vi.fn() };
    const scene = { textures: { exists: () => true }, add: { image: () => cell }, sound: { mute: true } };
    const damagePlayer = vi.fn();
    const context = { scene, player, fx: { impact: vi.fn() }, damagePlayer, signals: new SignalBus() } as unknown as ObjectContext<SceneHost>;
    const manager = new LevelObjectManager(createDefaultRegistry(), context);
    manager.load([{ type: 'toxicFloor', col: 0, row: 0, width: 1, damage: 1, interval: 0.5, mode: 'permanent', warning: 0.4 }], SIZE);
    manager.update(0.016);
    expect(damagePlayer).toHaveBeenCalledOnce();

    manager.pause();
    player.isAlive = false;
    manager.update(5);
    expect(damagePlayer).toHaveBeenCalledOnce();
    player.isAlive = true;
    player.isInvulnerable = true;
    manager.resume();
    manager.update(0.2);
    expect(damagePlayer).toHaveBeenCalledOnce();
    manager.update(0.21);
    expect(damagePlayer).toHaveBeenCalledOnce();
    player.isInvulnerable = false;
    for (let step = 0; step < 5; step++) manager.update(0.1);
    expect(damagePlayer).toHaveBeenCalledTimes(2);
    manager.destroy();
    expect(cell.destroy).toHaveBeenCalledOnce();
  });
});

describe('destrucción y reinicio', () => {
  it('el unload elimina solo las texturas propiedad del registro de objetos', () => {
    const remove = vi.fn();
    removeObjectTextures({ textures: {
      getTextureKeys: () => ['platformer.obj.toxic.on', 'platformer.obj.organic-node.on', 'platformer.enemy.walker'],
      remove,
    } } as unknown as Parameters<typeof removeObjectTextures>[0]);
    expect(remove.mock.calls.map(([key]) => key)).toEqual(['platformer.obj.toxic.on', 'platformer.obj.organic-node.on']);
  });

  it('destroy libera todo en orden inverso, limpia las señales y es idempotente', () => {
    const host: FakeHost = { log: [] };
    const manager = new LevelObjectManager(fakeRegistry(), host);
    manager.load(LEVEL_OBJECTS, SIZE);
    manager.signals.set('s', true);
    host.log.length = 0;
    manager.destroy();
    expect(host.log).toEqual(['destroy:floor', 'destroy:door', 'destroy:laser', 'destroy:switch:s', 'destroy:platform']);
    expect(manager.count).toBe(0);
    expect(manager.signals.isOn('s')).toBe(false);
    manager.destroy();
    expect(host.log).toHaveLength(5);
  });

  it('un gestor destruido ignora update y no admite nuevas cargas', () => {
    const manager = new LevelObjectManager(fakeRegistry(), { log: [] });
    manager.load(LEVEL_OBJECTS, SIZE);
    manager.destroy();
    expect(() => manager.update(1)).not.toThrow();
    expect(() => manager.load(LEVEL_OBJECTS, SIZE)).toThrow(/destroyed/);
  });

  it('reiniciar el nivel crea un gestor nuevo con estado limpio (sin señales ni tiempos heredados)', () => {
    const host: FakeHost = { log: [] };
    const first = new LevelObjectManager(fakeRegistry(), host);
    const [, sw1] = first.load(LEVEL_OBJECTS, SIZE) as unknown as Array<{ model: SwitchModel }>;
    sw1.model.activate();
    first.update(0.5);
    first.destroy();
    const second = new LevelObjectManager(fakeRegistry(), host);
    const [platform, sw2, laser] = second.load(LEVEL_OBJECTS, SIZE) as unknown as Array<{ motion: PathMotion; model: SwitchModel; cycle: HazardCycle }>;
    expect(second.signals.isOn('s')).toBe(false);
    expect(sw2.model.isOn).toBe(false);
    expect(platform.motion.pos).toBe(0);
    expect(laser.cycle.time).toBe(0);
  });

  it('si un objeto falla al destruirse, el resto se destruye igualmente y se informa del error', () => {
    const host: FakeHost = { log: [] };
    const registry = new ObjectRegistry<FakeHost>()
      .register('switch', (c, ctx) => ({ config: c, update: () => undefined, destroy: () => void ctx.log.push(`destroy:${c.id}`) }))
      .register('door', (c) => ({
        config: c,
        update: () => undefined,
        destroy: () => {
          throw new Error('door failed');
        },
      }));
    const manager = new LevelObjectManager(registry, host);
    manager.load([{ type: 'switch', id: 'a', col: 1, row: 1 }, { type: 'door', col: 5, row: 5, opensWith: 'a' }], SIZE);
    expect(() => manager.destroy()).toThrow('door failed');
    expect(host.log).toEqual(['destroy:a']);
  });
});

describe('escenario técnico de objetos', () => {
  const enemyDefs = enemies;

  it('es un nivel válido con los seis elementos pedidos', () => {
    const data = buildObjectsSandbox();
    const result = validateLevel(data, Object.keys(BIOMES), enemyDefs, BIOME_VARIANTS);
    expect(result.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(result.ok).toBe(true);
    const types = (data.objects as Array<{ type: string; axis?: string }>).map((o) => (o.type === 'movingPlatform' ? `platform-${o.axis}` : o.type));
    expect(types).toEqual(expect.arrayContaining(['platform-x', 'platform-y', 'laser', 'electricFloor', 'switch', 'door']));
    expect(validateObjects(data.objects, { width: result.parsed!.width, height: result.parsed!.height }).issues.filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('no forma parte de la campaña ni de levels.json', () => {
    expect(readJson('levels/levels.json').levels.join()).not.toMatch(/sandbox/);
    expect(JSON.stringify(readJson('campaign.json'))).not.toMatch(/sandbox/);
    expect(OBJECTS_SANDBOX_ID).toBe('sandbox-objects');
  });

  it('se registra aparte, sin escribir nada en el guardado', () => {
    const writes: string[] = [];
    vi.stubGlobal('window', { localStorage: { getItem: () => null, setItem: (k: string) => void writes.push(k), removeItem: () => undefined } });
    clearSandboxLevels();
    const data = registerSandboxLevel(buildObjectsSandbox(), enemyDefs);
    expect(getSandboxLevel(OBJECTS_SANDBOX_ID)).toBe(data);
    expect(getSandboxLevel('forest-1')).toBeUndefined();
    expect(writes).toEqual([]);
    clearSandboxLevels();
    expect(getSandboxLevel(OBJECTS_SANDBOX_ID)).toBeUndefined();
    vi.unstubAllGlobals();
  });

  it('registrar un escenario inválido lanza un error legible', () => {
    const bad: LevelData = { ...buildObjectsSandbox(), objects: [{ type: 'door', col: 3, row: 5, opensWith: 'missing' }] };
    expect(() => registerSandboxLevel(bad, enemyDefs)).toThrow(/Invalid sandbox level[\s\S]*missing/);
  });

  it('solo se alcanza desde el modo de desarrollo y no guarda estrellas ni progreso', () => {
    const chapters = readFileSync(join(ROOT, 'src/games/platformer/scenes/PlatformerChapterSelectScene.ts'), 'utf8');
    expect(chapters).toMatch(/if \(import\.meta\.env\.DEV\) \{[\s\S]*openObjectsSandbox/);
    expect(chapters).toMatch(/private openObjectsSandbox\(\): void \{\s*if \(!import\.meta\.env\.DEV\) return;/);
    const level = readFileSync(join(ROOT, 'src/games/platformer/scenes/PlatformerLevelScene.ts'), 'utf8');
    expect(level).toMatch(/this\.sandbox \? 0 : getGameData\(\)\.profile\.recordStars/);
    expect(level).toMatch(/this\.sandbox\s*\? \{ next: undefined[\s\S]*: getCampaign\(\)\.complete/);
  });

  it('la escena de nivel destruye los objetos al cerrarse, los pausa y los actualiza solo sin terminar', () => {
    const level = readFileSync(join(ROOT, 'src/games/platformer/scenes/PlatformerLevelScene.ts'), 'utf8');
    expect(level).toMatch(/Scenes\.Events\.PAUSE, pauseObjects/);
    expect(level).toMatch(/Scenes\.Events\.RESUME, resumeObjects/);
    expect(level).toMatch(/this\.objects\?\.destroy\(\)/);
    expect(level).toMatch(/if \(!this\.finished\) this\.objects\?\.update\(delta \/ 1000\)/);
  });
});
