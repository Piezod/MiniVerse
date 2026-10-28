/** Enemy definitions loaded from enemies.json (Phaser-free so they can be validated in tests). */
import { ATTACK_FORMS, type AttackForm } from '../combat/damage';

export const MOVEMENTS = ['patrol', 'chase', 'fly', 'hover', 'stationary'] as const;
export const STOMP_RULES = ['kill', 'damage', 'immune'] as const;
export const ATTACK_KINDS = ['shoot', 'hop', 'lunge'] as const;

export type Movement = (typeof MOVEMENTS)[number];

/** Bounded patrol of a hovering enemy: sweeps +-range, bobs +-bob and may leave the zone by `leash` px while chasing. */
export interface PatrolZone {
  range: number;
  bob: number;
  leash: number;
  standoff?: number;
  axis?: 'x' | 'y';
}

export const isFlying = (def: Pick<EnemyDef, 'movement'>): boolean => def.movement === 'fly' || def.movement === 'hover';
export type StompRule = (typeof STOMP_RULES)[number];

export interface EnemyAttack {
  kind: (typeof ATTACK_KINDS)[number];
  cooldown: number;
  /** Distance (px) to the player at which the attack starts. */
  range: number;
  damage: number;
  /** Projectile speed (shoot) or jump velocity (hop), px/s. */
  power: number;
  /** Seconds the enemy stops and flashes before the attack lands (0 = no warning). */
  telegraph: number;
  recovery?: number;
  burstCount?: number;
  burstInterval?: number;
  projectile?: 'fireball' | 'energy' | 'spore';
  /** Element of the attack; defaults to the enemy's element. */
  element: string | null;
}

export interface EnemyDef {
  id: string;
  name: string;
  /** Sprite family (see assets/enemySprites.ts). */
  sprite: string;
  /** Integer visual/body scale. */
  scale: number;
  /** Optional colour tint for variants (#rrggbb). */
  tint?: string;
  /** Signal held on while at least one instance is alive in the level. */
  activeSignal?: string;
  maxHealth: number;
  contactDamage: number;
  speed: number;
  facing?: 'left' | 'right';
  fixedFacing?: boolean;
  patrolRange?: number;
  armor: number;
  /** Main elemental type (elements.json id). */
  element: string | null;
  /** Personal multipliers per element, applied after the affinity chart. */
  resist: Record<string, number>;
  /** Multipliers per attack form (contact, stomp, projectile, area, status). */
  formResist: Partial<Record<AttackForm, number>>;
  /** Elements and/or forms that deal no damage. */
  immune: string[];
  /** Status effects this enemy never receives. */
  statusImmune: string[];
  /** What happens when the player lands on it. */
  stomp: StompRule;
  stompDamage: number;
  movement: Movement;
  /** Distance (px) at which it notices the player. */
  detectRange: number;
  /** Flight zone of `hover` enemies, in px around their spawn point (null for other movements). */
  patrol: PatrolZone | null;
  attack?: EnemyAttack;
  /** Frontal shield: hits coming from the side it faces are multiplied by this. */
  guard?: number;
  reward: { energy: number };
  boss: boolean;
  healthBar: boolean;
}

export interface CatalogIssue {
  id: string;
  message: string;
}

export interface EnemyCatalog {
  enemies: Record<string, EnemyDef>;
  issues: CatalogIssue[];
}

export function enemyActiveSignals(enemies: readonly Pick<EnemyDef, 'activeSignal'>[]): string[] {
  return [...new Set(enemies.flatMap((enemy) => enemy.activeSignal ? [enemy.activeSignal] : []))];
}

type RawEnemy = Record<string, unknown>;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export interface CombatIds {
  /** Element ids from elements.json. When given, every enemy must declare a valid "element". */
  elements?: readonly string[];
  /** Status effect ids from status-effects.json. */
  statuses?: readonly string[];
}

/** Resolves `extends` chains (variants) and validates every field. Invalid enemies are left out. */
export function buildEnemyCatalog(raw: unknown, knownSprites: readonly string[], ids: CombatIds = {}): EnemyCatalog {
  const elements = ids.elements;
  const isElement = (e: string): boolean => (elements ? elements.includes(e) : true);
  const issues: CatalogIssue[] = [];
  const enemies: Record<string, EnemyDef> = {};
  if (!isRecord(raw)) return { enemies, issues: [{ id: '*', message: 'enemies.json debe ser un objeto { id: definición }' }] };

  const resolve = (id: string, seen: string[]): RawEnemy | null => {
    const entry = raw[id];
    if (!isRecord(entry)) return null;
    if (typeof entry.extends !== 'string') return entry;
    if (seen.includes(entry.extends)) {
      issues.push({ id, message: `herencia circular (${[...seen, entry.extends].join(' -> ')})` });
      return null;
    }
    const parent = resolve(entry.extends, [...seen, entry.extends]);
    if (!parent) {
      issues.push({ id, message: `"extends" apunta a un enemigo inexistente: ${entry.extends}` });
      return null;
    }
    const merged: RawEnemy = { ...parent, ...entry };
    for (const key of ['resist', 'formResist', 'patrol'])
      if (isRecord(parent[key]) || isRecord(entry[key])) merged[key] = { ...(parent[key] as object), ...(entry[key] as object) };
    if (isRecord(parent.attack) && isRecord(entry.attack)) merged.attack = { ...parent.attack, ...entry.attack };
    return merged;
  };

  for (const id of Object.keys(raw)) {
    const r = resolve(id, [id]);
    if (!r) continue;
    const errors: string[] = [];
    const num = (key: string, min: number, max: number, fallback?: number): number => {
      const value = r[key] ?? fallback;
      if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
        errors.push(`"${key}" debe ser un número entre ${min} y ${max}`);
        return min;
      }
      return value;
    };
    const oneOf = <T extends string>(key: string, options: readonly T[], fallback?: T): T => {
      const value = r[key] ?? fallback;
      if (typeof value !== 'string' || !options.includes(value as T)) {
        errors.push(`"${key}" debe ser uno de: ${options.join(', ')}`);
        return options[0];
      }
      return value as T;
    };

    const sprite = typeof r.sprite === 'string' ? r.sprite : '';
    if (!knownSprites.includes(sprite)) errors.push(`"sprite" debe ser uno de: ${knownSprites.join(', ')}`);
    let activeSignal: string | undefined;
    if (r.activeSignal !== undefined) {
      if (typeof r.activeSignal !== 'string' || !/^[a-z][a-z0-9-]*$/.test(r.activeSignal)) errors.push('"activeSignal" debe ser un id en minusculas, numeros y guiones');
      else activeSignal = r.activeSignal;
    }
    const maxHealth = num('maxHealth', 0.1, 999);
    let element: string | null = null;
    if (typeof r.element === 'string' && isElement(r.element)) element = r.element;
    else if (elements || r.element !== undefined) errors.push(`"element" debe ser uno de: ${(elements ?? []).join(', ')}`);

    const multipliers = (key: string, valid: (k: string) => boolean, what: string): Record<string, number> => {
      const out: Record<string, number> = {};
      const value = r[key];
      if (value === undefined) return out;
      if (!isRecord(value)) {
        errors.push(`"${key}" debe ser un objeto`);
        return out;
      }
      for (const [k, m] of Object.entries(value)) {
        if (!valid(k)) errors.push(`"${key}.${k}": ${what} desconocido`);
        else if (typeof m !== 'number' || m < 0 || m > 10) errors.push(`"${key}.${k}" debe estar entre 0 y 10`);
        else out[k] = m;
      }
      return out;
    };
    const resist = multipliers('resist', isElement, 'elemento');
    const formResist = multipliers('formResist', (k) => ATTACK_FORMS.includes(k as AttackForm), 'forma de ataque');
    const stringList = (key: string, valid: (k: string) => boolean, what: string): string[] => {
      const value = r[key];
      if (value === undefined) return [];
      if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
        errors.push(`"${key}" debe ser una lista de textos`);
        return [];
      }
      (value as string[]).filter((v) => !valid(v)).forEach((v) => errors.push(`"${key}": ${what} desconocido "${v}"`));
      return value as string[];
    };
    const immune = stringList('immune', (k) => isElement(k) || ATTACK_FORMS.includes(k as AttackForm), 'elemento o forma');
    const statusImmune = stringList('statusImmune', (k) => !ids.statuses || ids.statuses.includes(k), 'estado');
    let attack: EnemyAttack | undefined;
    if (r.attack !== undefined) {
      if (!isRecord(r.attack)) errors.push('"attack" debe ser un objeto');
      else {
        const a = r.attack;
        const kind = a.kind;
        if (typeof kind !== 'string' || !ATTACK_KINDS.includes(kind as EnemyAttack['kind'])) errors.push(`"attack.kind" debe ser uno de: ${ATTACK_KINDS.join(', ')}`);
        const n = (key: string, min: number, max: number, fallback: number): number => {
          const value = a[key] ?? fallback;
          if (typeof value !== 'number' || value < min || value > max) errors.push(`"attack.${key}" debe estar entre ${min} y ${max}`);
          return typeof value === 'number' ? value : fallback;
        };
        attack = {
          kind: kind as EnemyAttack['kind'],
          cooldown: n('cooldown', 0.2, 30, 2),
          range: n('range', 8, 400, 120),
          damage: n('damage', 0, 10, 1),
          power: n('power', 10, 600, 100),
          telegraph: n('telegraph', 0, 2, 0),
          recovery: n('recovery', 0, 3, 0),
          burstCount: n('burstCount', 1, 3, 1),
          burstInterval: n('burstInterval', 0.1, 1, 0.25),
          element: typeof a.element === 'string' ? a.element : element,
          projectile: a.projectile === 'energy' || a.projectile === 'spore' ? a.projectile : 'fireball',
        };
        if (!Number.isInteger(attack.burstCount)) errors.push('"attack.burstCount" debe ser entero');
        if (attack.burstCount! > 1 && kind !== 'shoot') errors.push('"attack.burstCount" solo se usa con shoot');
        if (a.projectile !== undefined && !['fireball', 'energy', 'spore'].includes(a.projectile as string)) errors.push('"attack.projectile" debe ser fireball, energy o spore');
        if (typeof a.element === 'string' && !isElement(a.element)) errors.push(`"attack.element" desconocido: ${a.element}`);
      }
    }
    const movement = oneOf('movement', MOVEMENTS, 'patrol');
    const facing = oneOf('facing', ['left', 'right'] as const, 'left');
    if (r.fixedFacing !== undefined && typeof r.fixedFacing !== 'boolean') errors.push('"fixedFacing" debe ser true o false');
    let patrol: PatrolZone | null = null;
    if (r.patrol !== undefined && movement !== 'hover') errors.push('"patrol" solo se usa con "movement": "hover"');
    else if (movement === 'hover') {
      const p = r.patrol === undefined ? {} : r.patrol;
      if (!isRecord(p)) errors.push('"patrol" debe ser un objeto { range, bob, leash }');
      else {
        const z = (key: string, min: number, max: number, fallback: number): number => {
          const value = p[key] ?? fallback;
          if (typeof value !== 'number' || value < min || value > max) errors.push(`"patrol.${key}" debe estar entre ${min} y ${max}`);
          return typeof value === 'number' ? value : fallback;
        };
        if (p.axis !== undefined && p.axis !== 'x' && p.axis !== 'y') errors.push('"patrol.axis" debe ser x o y');
        patrol = { range: z('range', 8, 400, 64), bob: z('bob', 0, 24, 6), leash: z('leash', 0, 200, 48), standoff: z('standoff', 0, 160, 0), axis: p.axis === 'y' ? 'y' : 'x' };
      }
    }
    const def: EnemyDef = {
      id,
      name: typeof r.name === 'string' ? r.name : id,
      sprite,
      scale: num('scale', 1, 4, 1),
      tint: typeof r.tint === 'string' && /^#[0-9a-f]{6}$/i.test(r.tint) ? r.tint : undefined,
      activeSignal,
      maxHealth,
      contactDamage: num('contactDamage', 0, 10, 1),
      speed: num('speed', 0, 200, 30),
      facing,
      fixedFacing: r.fixedFacing === true,
      patrolRange: r.patrolRange === undefined ? undefined : num('patrolRange', 8, 400),
      armor: num('armor', 0, 99, 0),
      element,
      resist,
      formResist,
      immune,
      statusImmune,
      stomp: oneOf('stomp', STOMP_RULES, 'kill'),
      stompDamage: num('stompDamage', 0, 99, 1),
      movement,
      detectRange: num('detectRange', 0, 600, 0),
      patrol,
      attack,
      guard: r.guard === undefined ? undefined : num('guard', 0, 1),
      reward: { energy: isRecord(r.reward) && typeof r.reward.energy === 'number' ? Math.max(0, r.reward.energy) : 0 },
      boss: r.boss === true,
      healthBar: typeof r.healthBar === 'boolean' ? r.healthBar : maxHealth > 1,
    };
    if (Number.isInteger(def.scale) === false) errors.push('"scale" debe ser entero');
    if (def.boss && (def.stomp === 'immune' || immune.includes('stomp') || formResist.stomp === 0)) errors.push('un jefe no puede ser inmune al salto (el nivel debe poder completarse sin habilidades)');
    if (errors.length) errors.forEach((message) => issues.push({ id, message }));
    else enemies[id] = def;
  }
  return { enemies, issues };
}
