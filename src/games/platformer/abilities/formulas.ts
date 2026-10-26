/** Pure formulas shared by ability modules and tests. */

/** Flamethrower damage per tick after holding it `heldTime` seconds (ramps up, capped). */
export function flameTickDamage(heldTime: number, base: number, rampPerSecond: number, max: number): number {
  return Math.min(max, base + rampPerSecond * heldTime);
}
