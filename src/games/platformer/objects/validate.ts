import type { BoostPlantConfig, DoorConfig, ElectricFloorConfig, HazardTiming, LaserConfig, LevelDimensions, LevelObjectConfig, MovingPlatformConfig, ObjectIssue, OrganicNodeConfig, SwitchConfig, ToxicFloorConfig } from './types';
import { OBJECT_TYPES } from './types';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const ID = /^[a-z][a-z0-9-]*$/;
const MAX_OBJECTS = 200;

const COMMON = ['type', 'id', 'col', 'row'];
const TIMING = ['mode', 'on', 'off', 'warning', 'offset', 'enabledBy', 'disabledBy'];
const ALLOWED: Record<(typeof OBJECT_TYPES)[number], readonly string[]> = {
  movingPlatform: [...COMMON, 'width', 'axis', 'travel', 'speed', 'wait', 'offset'],
  laser: [...COMMON, 'orientation', 'length', 'damage', ...TIMING],
  electricFloor: [...COMMON, 'width', 'damage', ...TIMING],
  switch: [...COMMON, 'duration'],
  door: [...COMMON, 'height', 'opensWith', 'inverted', 'style'],
  boostPlant: [...COMMON, 'direction', 'force'],
  toxicFloor: [...COMMON, 'width', 'damage', 'interval', ...TIMING],
  organicNode: [...COMMON, 'duration', 'mode'],
};

export interface ObjectValidation {
  /** Normalized (defaults applied) objects that passed validation. */
  objects: LevelObjectConfig[];
  issues: ObjectIssue[];
  ok: boolean;
}

/**
 * Validates the "objects" list of a level and applies defaults. Unknown types and unknown fields are
 * errors (typos must not be silently ignored); ranges, bounds, unique ids and switch references are
 * checked. Objects with errors are left out of `objects`.
 */
export function validateObjects(raw: unknown, size: LevelDimensions): ObjectValidation {
  const issues: ObjectIssue[] = [];
  const result: ObjectValidation = { objects: [], issues, ok: true };
  if (raw === undefined || raw === null) return result;
  if (!Array.isArray(raw)) {
    issues.push({ severity: 'error', index: -1, message: '"objects" debe ser una lista' });
    return { ...result, ok: false };
  }
  if (raw.length > MAX_OBJECTS) issues.push({ severity: 'error', index: -1, message: `demasiados objetos (${raw.length} > ${MAX_OBJECTS})` });

  const ids = new Map<string, number>();
  const parsed: Array<{ index: number; config: LevelObjectConfig }> = [];

  raw.slice(0, MAX_OBJECTS).forEach((entry, index) => {
    const errors: string[] = [];
    const label = isRecord(entry) ? `${String(entry.type)}${typeof entry.id === 'string' ? ` "${entry.id}"` : ''}` : 'objeto';
    if (!isRecord(entry)) {
      issues.push({ severity: 'error', index, message: 'cada objeto debe ser un objeto JSON' });
      return;
    }
    const type = entry.type;
    if (typeof type !== 'string' || !(OBJECT_TYPES as readonly string[]).includes(type)) {
      issues.push({ severity: 'error', index, message: `${label}: "type" debe ser uno de: ${OBJECT_TYPES.join(', ')}` });
      return;
    }
    const known = ALLOWED[type as keyof typeof ALLOWED];
    for (const key of Object.keys(entry)) if (!known.includes(key)) errors.push(`campo desconocido "${key}" (permitidos: ${known.join(', ')})`);

    const num = (key: string, min: number, max: number, fallback: number | undefined, integer = false): number => {
      const value = entry[key] ?? fallback;
      if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
        errors.push(`"${key}" ${value === undefined ? 'es obligatorio y' : ''} debe ser un ${integer ? 'entero' : 'número'} entre ${min} y ${max}`);
        return min;
      }
      return value;
    };
    const oneOf = <T extends string>(key: string, options: readonly T[], fallback?: T): T => {
      const value = entry[key] ?? fallback;
      if (typeof value !== 'string' || !options.includes(value as T)) {
        errors.push(`"${key}" ${value === undefined ? 'es obligatorio y' : ''} debe ser uno de: ${options.join(', ')}`);
        return options[0];
      }
      return value as T;
    };
    const flag = (key: string, fallback: boolean): boolean => {
      const value = entry[key] ?? fallback;
      if (typeof value !== 'boolean') {
        errors.push(`"${key}" debe ser true o false`);
        return fallback;
      }
      return value;
    };
    const optionalId = (key: string): string | undefined => {
      const value = entry[key];
      if (value === undefined) return undefined;
      if (typeof value !== 'string' || !ID.test(value)) {
        errors.push(`"${key}" debe ser un id (minúsculas, números y guiones)`);
        return undefined;
      }
      return value;
    };

    const id = optionalId('id');
    const col = num('col', 0, size.width - 1, undefined, true);
    const row = num('row', 0, size.height - 1, undefined, true);
    if (id !== undefined) {
      if (ids.has(id)) errors.push(`id duplicado "${id}" (también en objects[${ids.get(id)}])`);
      else ids.set(id, index);
    }

    const timing = (): HazardTiming => ({
      mode: oneOf('mode', ['periodic', 'permanent'] as const, 'periodic'),
      on: num('on', 0.2, 30, 1.5),
      off: num('off', 0, 30, 1.5),
      warning: num('warning', 0, 5, 0.6),
      offset: num('offset', 0, 60, 0),
    });
    const gate = (): { enabledBy?: string; disabledBy?: string } => {
      const enabledBy = optionalId('enabledBy');
      const disabledBy = optionalId('disabledBy');
      if (enabledBy && disabledBy) errors.push('usa "enabledBy" o "disabledBy", no ambos');
      return { ...(enabledBy ? { enabledBy } : {}), ...(disabledBy ? { disabledBy } : {}) };
    };

    let config: LevelObjectConfig | null = null;
    switch (type as (typeof OBJECT_TYPES)[number]) {
      case 'movingPlatform': {
        const c: MovingPlatformConfig = {
          type: 'movingPlatform',
          ...(id ? { id } : {}),
          col,
          row,
          width: num('width', 1, 12, 3, true),
          axis: oneOf('axis', ['x', 'y'] as const),
          travel: num('travel', -40, 40, undefined, true),
          speed: num('speed', 10, 160, 40),
          wait: num('wait', 0, 10, 0.5),
          offset: num('offset', 0, 1, 0),
        };
        if (c.travel === 0) errors.push('"travel" no puede ser 0');
        const lo = Math.min(0, c.travel);
        const hi = Math.max(0, c.travel);
        if (c.axis === 'x' && (col + lo < 0 || col + c.width + hi > size.width)) errors.push('el recorrido se sale del nivel (horizontal)');
        if (c.axis === 'y' && (col + c.width > size.width || row + lo < 0 || row + hi > size.height - 1)) errors.push('el recorrido se sale del nivel (vertical)');
        config = c;
        break;
      }
      case 'laser': {
        const c: LaserConfig = {
          type: 'laser',
          ...(id ? { id } : {}),
          col,
          row,
          orientation: oneOf('orientation', ['horizontal', 'vertical'] as const),
          length: num('length', 1, 40, 4, true),
          damage: num('damage', 0.5, 3, 1),
          ...timing(),
          ...gate(),
        };
        if (c.orientation === 'horizontal' && col + c.length > size.width - 1) errors.push('el haz se sale del nivel por la derecha');
        if (c.orientation === 'vertical' && row + c.length > size.height - 1) errors.push('el haz se sale del nivel por abajo');
        config = c;
        break;
      }
      case 'electricFloor': {
        const c: ElectricFloorConfig = {
          type: 'electricFloor',
          ...(id ? { id } : {}),
          col,
          row,
          width: num('width', 1, 20, 3, true),
          damage: num('damage', 0.5, 3, 1),
          ...timing(),
          ...gate(),
        };
        if (col + c.width > size.width) errors.push('la superficie se sale del nivel');
        config = c;
        break;
      }
      case 'switch': {
        if (id === undefined) errors.push('"id" es obligatorio en los interruptores');
        config = { type: 'switch', id: id ?? '', col, row, duration: num('duration', 0, 120, 0) } satisfies SwitchConfig;
        break;
      }
      case 'door': {
        const list = typeof entry.opensWith === 'string' ? [entry.opensWith] : entry.opensWith;
        let opensWith: string[] = [];
        if (!Array.isArray(list) || list.length === 0 || list.some((s) => typeof s !== 'string' || !ID.test(s))) errors.push('"opensWith" es obligatorio: un id de interruptor o una lista de ids');
        else opensWith = [...new Set(list as string[])];
        const c: DoorConfig = { type: 'door', ...(id ? { id } : {}), col, row, height: num('height', 1, 8, 3, true), opensWith, inverted: flag('inverted', false), style: oneOf('style', ['metal', 'membrane'] as const, 'metal') };
        if (row + c.height > size.height) errors.push('la puerta se sale del nivel por abajo');
        config = c;
        break;
      }
      case 'boostPlant': {
        const c: BoostPlantConfig = {
          type: 'boostPlant',
          ...(id ? { id } : {}),
          col,
          row,
          direction: oneOf('direction', ['up', 'up-left', 'up-right'] as const, 'up'),
          force: num('force', 160, 520, 320),
        };
        config = c;
        break;
      }
      case 'toxicFloor': {
        const c: ToxicFloorConfig = {
          type: 'toxicFloor',
          ...(id ? { id } : {}),
          col,
          row,
          width: num('width', 1, 20, 3, true),
          damage: num('damage', 0.5, 3, 1),
          interval: num('interval', 0.4, 3, 1),
          ...timing(),
          ...gate(),
        };
        if (col + c.width > size.width) errors.push('la superficie toxica se sale del nivel');
        config = c;
        break;
      }
      case 'organicNode': {
        const c: OrganicNodeConfig = {
          type: 'organicNode',
          id: id ?? '',
          col,
          row,
          mode: oneOf('mode', ['toggle', 'timed'] as const, 'toggle'),
          duration: num('duration', 0, 120, 0),
        };
        if (id === undefined) errors.push('"id" es obligatorio en los nodos orgánicos');
        if (c.mode === 'toggle' && c.duration !== 0) errors.push('"duration" debe ser 0 en modo toggle');
        if (c.mode === 'timed' && c.duration <= 0) errors.push('"duration" debe ser mayor que 0 en modo timed');
        config = c;
        break;
      }
    }

    if (errors.length) errors.forEach((message) => issues.push({ severity: 'error', index, message: `${label}: ${message}` }));
    else if (config) parsed.push({ index, config });
  });

  // References are checked once every id is known.
  const switches = new Set(parsed.filter((p) => p.config.type === 'switch' || p.config.type === 'organicNode').map((p) => p.config.id!));
  for (const signal of size.externalSignals ?? []) {
    if (!ID.test(signal) || ids.has(signal)) issues.push({ severity: 'error', index: -1, message: `señal externa inválida o duplicada: ${signal}` });
    switches.add(signal);
  }
  const used = new Set<string>();
  const valid: Array<{ index: number; config: LevelObjectConfig }> = [];
  for (const entry of parsed) {
    const { config, index } = entry;
    const refs: Array<[string, string]> = [];
    if (config.type === 'door') config.opensWith.forEach((id) => refs.push(['opensWith', id]));
    if (config.type === 'laser' || config.type === 'electricFloor') {
      if (config.enabledBy) refs.push(['enabledBy', config.enabledBy]);
      if (config.disabledBy) refs.push(['disabledBy', config.disabledBy]);
    }
    const missing = refs.filter(([, id]) => !switches.has(id));
    for (const [field, id] of missing) {
      const what = ids.has(id) ? 'no es un interruptor' : 'no existe';
      issues.push({ severity: 'error', index, message: `${config.type}: "${field}" apunta a "${id}", que ${what}` });
    }
    refs.forEach(([, id]) => used.add(id));
    if (missing.length === 0) valid.push(entry);
  }
  for (const { config, index } of valid) {
    if ((config.type === 'switch' || config.type === 'organicNode') && !used.has(config.id)) issues.push({ severity: 'warning', index, message: `switch "${config.id}": ningún objeto lo usa` });
  }

  const ok = !issues.some((i) => i.severity === 'error');
  return { objects: valid.map((v) => v.config), issues, ok };
}
