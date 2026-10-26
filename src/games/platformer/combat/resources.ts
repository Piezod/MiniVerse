/** Time/energy resources for abilities and enemy attacks (Phaser-free). Times in seconds. */
export class Cooldown {
  private left = 0;

  constructor(public duration: number) {}

  get ready(): boolean {
    return this.left <= 0;
  }

  /** 1 right after triggering, 0 when ready. */
  get remaining(): number {
    return this.duration > 0 ? this.left / this.duration : 0;
  }

  /** Starts the cooldown if ready; returns whether the action may happen. */
  trigger(): boolean {
    if (!this.ready) return false;
    this.left = this.duration;
    return true;
  }

  update(dt: number): void {
    this.left = Math.max(0, this.left - dt);
  }

  reset(): void {
    this.left = 0;
  }
}

export class EnergyPool {
  private value: number;
  private sinceUse = Infinity;

  constructor(
    readonly max: number,
    readonly regenPerSecond: number,
    readonly regenDelay = 0.6,
  ) {
    this.value = max;
  }

  get current(): number {
    return this.value;
  }

  get fraction(): number {
    return this.max > 0 ? this.value / this.max : 0;
  }

  /** All-or-nothing spend, for discrete actions. */
  tryConsume(amount: number): boolean {
    if (amount < 0 || this.value < amount) return false;
    this.value -= amount;
    this.sinceUse = 0;
    return true;
  }

  /** Partial spend for continuous actions; returns how much was actually consumed. */
  drain(amount: number): number {
    const used = Math.min(this.value, Math.max(0, amount));
    this.value -= used;
    if (used > 0) this.sinceUse = 0;
    return used;
  }

  restore(amount: number): void {
    this.value = Math.min(this.max, this.value + Math.max(0, amount));
  }

  update(dt: number): void {
    this.sinceUse += dt;
    if (this.sinceUse >= this.regenDelay) this.restore(this.regenPerSecond * dt);
  }
}
