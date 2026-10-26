/**
 * Unified damage model (Phaser-free). Every hit — player weapons, stomps, contact, projectiles and
 * status ticks — goes through `computeDamage`.
 *
 * Calculation order (each factor is applied exactly once):
 *   1. base amount (decimals allowed)
 *   2. immunity: defender immune to the hit's element or form -> 0
 *   3. affinity: chart.multiplier(hit.element, defender.element)  (type vs type, elements.json)
 *   4. personal elemental resistance/vulnerability: defense.resist[hit.element]  (this enemy only)
 *   5. form resistance: defense.formResist[hit.form]  (e.g. resistant to stomps)
 *   6. situational modifiers: hit.situational (frontal guard, status vulnerability, charge bonus...)
 *   7. flat armor (skipped when hit.ignoreArmor, e.g. damage over time), never below 0
 */
import { type ElementChart, NEUTRAL_CHART } from './elements';

/** How the hit is delivered. Independent from its elemental affinity. */
export const ATTACK_FORMS = ['contact', 'stomp', 'projectile', 'area', 'status'] as const;
export type AttackForm = (typeof ATTACK_FORMS)[number];

/** Status effect applied by a hit (ids from status-effects.json). */
export interface EffectApplication {
  id: string;
  /** 0..1, default 1. */
  chance?: number;
}

export interface Hit {
  amount: number;
  form: AttackForm;
  /** Elemental affinity (elements.json id); null/undefined = untyped. */
  element?: string | null;
  /** World x of the attacker, used for knockback and shields. */
  fromX?: number;
  /** Product of situational modifiers (guard, vulnerability...). Default 1. */
  situational?: number;
  ignoreArmor?: boolean;
  effects?: readonly EffectApplication[];
}

export interface Defense {
  /** Main elemental type of the defender. */
  element?: string | null;
  /** Flat reduction applied after all multipliers. */
  armor: number;
  /** Personal multipliers per element (1 normal, 0.5 resistant, 2 vulnerable). */
  resist: Readonly<Record<string, number>>;
  /** Multipliers per attack form. */
  formResist?: Readonly<Record<string, number>>;
  /** Elements and/or forms that deal no damage at all. */
  immune?: readonly string[];
}

export const NO_DEFENSE: Defense = { armor: 0, resist: {} };

export interface DamageBreakdown {
  base: number;
  immune: boolean;
  affinity: number;
  personal: number;
  form: number;
  situational: number;
  armor: number;
  total: number;
}

export function damageBreakdown(hit: Hit, defense: Defense, chart: ElementChart = NEUTRAL_CHART): DamageBreakdown {
  const base = Math.max(0, hit.amount);
  const element = hit.element ?? null;
  const immune = !!defense.immune?.some((id) => id === hit.form || (element !== null && id === element));
  const affinity = chart.multiplier(element, defense.element ?? null);
  const personal = element !== null ? (defense.resist[element] ?? 1) : 1;
  const form = defense.formResist?.[hit.form] ?? 1;
  const situational = hit.situational ?? 1;
  const armor = hit.ignoreArmor ? 0 : defense.armor;
  const scaled = base * affinity * personal * form * situational;
  const total = immune || scaled <= 0 ? 0 : Math.max(0, scaled - armor);
  return { base, immune, affinity, personal, form, situational, armor, total };
}

export function computeDamage(hit: Hit, defense: Defense, chart: ElementChart = NEUTRAL_CHART): number {
  return damageBreakdown(hit, defense, chart).total;
}

export interface HitResult {
  damage: number;
  killed: boolean;
  /** True when the defender was immune (no damage and no status effects). */
  immune: boolean;
}

export class Health {
  private value: number;

  constructor(
    readonly max: number,
    current = max,
  ) {
    this.value = Math.min(max, Math.max(0, current));
  }

  get current(): number {
    return this.value;
  }

  get isDead(): boolean {
    return this.value <= 0;
  }

  get fraction(): number {
    return this.max > 0 ? this.value / this.max : 0;
  }

  apply(hit: Hit, defense: Defense = NO_DEFENSE, chart: ElementChart = NEUTRAL_CHART): HitResult {
    if (this.isDead) return { damage: 0, killed: false, immune: false };
    const breakdown = damageBreakdown(hit, defense, chart);
    const damage = Math.min(this.value, breakdown.total);
    this.value -= damage;
    return { damage, killed: this.value <= 0, immune: breakdown.immune };
  }

  heal(amount: number): void {
    if (!this.isDead) this.value = Math.min(this.max, this.value + Math.max(0, amount));
  }

  reset(): void {
    this.value = this.max;
  }
}
