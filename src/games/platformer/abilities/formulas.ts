/** Pure formulas shared by ability modules and tests. */

/** Flamethrower damage per tick after holding it `heldTime` seconds (ramps up, capped). */
export function flameTickDamage(heldTime: number, base: number, rampPerSecond: number, max: number): number {
  return Math.min(max, base + rampPerSecond * heldTime);
}

/** Share of the energy cost paid by an uncharged shot; the rest scales with the charge. */
export const MIN_ENERGY_SHARE = 0.4;

/** Charge fraction (0..1) after holding `held` seconds. */
export function chargeFraction(held: number, chargeTime: number): number {
  return chargeTime <= 0 ? 1 : Math.min(1, Math.max(0, held / chargeTime));
}

/** Damage of a charged shot: linear between the uncharged and fully charged values. */
export function chargedDamage(fraction: number, min: number, max: number): number {
  return min + (Math.max(min, max) - min) * Math.min(1, Math.max(0, fraction));
}

/** Energy paid when releasing at `fraction`. */
export function chargeEnergyCost(fraction: number, fullCost: number): number {
  return fullCost * (MIN_ENERGY_SHARE + (1 - MIN_ENERGY_SHARE) * Math.min(1, Math.max(0, fraction)));
}

/** Highest charge the available energy can pay for (-1 when not even an uncharged shot is affordable). */
export function affordableCharge(energy: number, fullCost: number): number {
  if (fullCost <= 0) return 1;
  const fraction = (energy / fullCost - MIN_ENERGY_SHARE) / (1 - MIN_ENERGY_SHARE);
  return fraction < 0 ? -1 : Math.min(1, fraction);
}
