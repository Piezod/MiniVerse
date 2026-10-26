/** Shared damage model for player attacks, projectiles, stomps and contact (Phaser-free). */
export const DAMAGE_TYPES = ['contact', 'stomp', 'beam', 'fire', 'projectile'] as const;
export type DamageType = (typeof DAMAGE_TYPES)[number];

export interface Hit {
  amount: number;
  type: DamageType;
  /** World x of the attacker, used for knockback and shields. */
  fromX?: number;
}

export interface Defense {
  /** Flat reduction applied to every hit after resistances. */
  armor: number;
  /** Multiplier per damage type (1 = normal, 0.5 = resistant, 0 = immune, 2 = weak). */
  resist: Partial<Record<DamageType, number>>;
}

export const NO_DEFENSE: Defense = { armor: 0, resist: {} };

export function computeDamage(hit: Hit, defense: Defense): number {
  const multiplier = defense.resist[hit.type] ?? 1;
  if (multiplier <= 0 || hit.amount <= 0) return 0;
  return Math.max(0, hit.amount * multiplier - defense.armor);
}

export interface HitResult {
  damage: number;
  killed: boolean;
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

  apply(hit: Hit, defense: Defense = NO_DEFENSE): HitResult {
    if (this.isDead) return { damage: 0, killed: false };
    const damage = Math.min(this.value, computeDamage(hit, defense));
    this.value -= damage;
    return { damage, killed: this.value <= 0 };
  }

  heal(amount: number): void {
    if (!this.isDead) this.value = Math.min(this.max, this.value + Math.max(0, amount));
  }

  reset(): void {
    this.value = this.max;
  }
}
