/** Enemy definitions loaded from enemies.json (Phaser-free so they can be validated in tests). */
import { DAMAGE_TYPES, type DamageType } from '../combat/damage';

export const MOVEMENTS = ['patrol', 'chase', 'fly', 'stationary'] as const;
export const STOMP_RULES = ['kill', 'damage', 'immune'] as const;
export const ATTACK_KINDS = ['shoot', 'hop'] as const;

export type Movement = (typeof MOVEMENTS)[number];
export type StompRule = (typeof STOMP_RULES)[number];

export interface EnemyAttack {
  kind: (typeof ATTACK_KINDS)[number];
  cooldown: number;
  /** Distance (px) to the player at which the attack starts. */
  range: number;
  damage: number;
  /** Projectile speed (shoot) or jump velocity (hop), px/s. */
  power: number;
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
  maxHealth: number;
  contactDamage: number;
  speed: number;
  armor: number;
  resist: Partial<Record<DamageType, number>>;
  /** What happens when the player lands on it. */
  stomp: StompRule;
  stompDamage: number;
  movement: Movement;
  /** Distance (px) at which it notices the player. */
  detectRange: number;
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

type RawEnemy = Record<string, unknown>;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Resolves `extends` chains (variants) and validates every field. Invalid enemies are left out. */
export function buildEnemyCatalog(raw: unknown, knownSprites: readonly string[]): EnemyCatalog {
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
    if (isRecord(parent.resist) || isRecord(entry.resist)) merged.resist = { ...(parent.resist as object), ...(entry.resist as object) };
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
    const maxHealth = num('maxHealth', 0.1, 999);
    const resist: Partial<Record<DamageType, number>> = {};
    if (r.resist !== undefined) {
      if (!isRecord(r.resist)) errors.push('"resist" debe ser un objeto');
      else
        for (const [type, value] of Object.entries(r.resist)) {
          if (!DAMAGE_TYPES.includes(type as DamageType)) errors.push(`"resist.${type}": tipo de daño desconocido`);
          else if (typeof value !== 'number' || value < 0 || value > 10) errors.push(`"resist.${type}" debe estar entre 0 y 10`);
          else resist[type as DamageType] = value;
        }
    }
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
        };
      }
    }
    const def: EnemyDef = {
      id,
      name: typeof r.name === 'string' ? r.name : id,
      sprite,
      scale: num('scale', 1, 4, 1),
      tint: typeof r.tint === 'string' && /^#[0-9a-f]{6}$/i.test(r.tint) ? r.tint : undefined,
      maxHealth,
      contactDamage: num('contactDamage', 0, 10, 1),
      speed: num('speed', 0, 200, 30),
      armor: num('armor', 0, 99, 0),
      resist,
      stomp: oneOf('stomp', STOMP_RULES, 'kill'),
      stompDamage: num('stompDamage', 0, 99, 1),
      movement: oneOf('movement', MOVEMENTS, 'patrol'),
      detectRange: num('detectRange', 0, 600, 0),
      attack,
      guard: r.guard === undefined ? undefined : num('guard', 0, 1),
      reward: { energy: isRecord(r.reward) && typeof r.reward.energy === 'number' ? Math.max(0, r.reward.energy) : 0 },
      boss: r.boss === true,
      healthBar: typeof r.healthBar === 'boolean' ? r.healthBar : maxHealth > 1,
    };
    if (Number.isInteger(def.scale) === false) errors.push('"scale" debe ser entero');
    if (def.boss && def.stomp === 'immune') errors.push('un jefe no puede ser inmune al salto (el nivel debe poder completarse sin habilidades)');
    if (errors.length) errors.forEach((message) => issues.push({ id, message }));
    else enemies[id] = def;
  }
  return { enemies, issues };
}
