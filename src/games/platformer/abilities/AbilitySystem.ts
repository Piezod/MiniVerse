import { EnergyPool } from '../combat/resources';
import type { AbilityButton } from '../controls';
import type { LoadoutEntry } from '../progression/Profile';
import type { AbilityContext, AbilityInstance } from './Ability';
import { ABILITY_MODULES } from './modules';
import type { AbilityModuleId } from './moduleIds';

export const ENERGY_MAX = 100;
export const ENERGY_REGEN = 20;

/** Runs the equipped abilities: passives every frame, weapons on the button they are equipped on (F / R). */
export class AbilitySystem {
  readonly energy = new EnergyPool(ENERGY_MAX, ENERGY_REGEN);
  readonly passives: AbilityInstance[] = [];
  readonly actives: AbilityInstance[] = [];
  private readonly bindings = new Map<AbilityButton, AbilityInstance>();

  constructor(ctx: Omit<AbilityContext, 'energy'>, loadout: readonly LoadoutEntry[]) {
    const full: AbilityContext = { ...ctx, energy: this.energy };
    for (const { def, level, button } of loadout) {
      const module = ABILITY_MODULES[def.module as AbilityModuleId];
      const stats = def.levels[Math.min(level, def.levels.length) - 1];
      if (!module || !stats) continue;
      const instance = module(full, def, level, stats);
      if (def.slot === 'passive') this.passives.push(instance);
      else if (button && !this.bindings.has(button)) {
        this.actives.push(instance);
        this.bindings.set(button, instance);
      }
    }
  }

  /** Weapon equipped on a button, if any. */
  on(button: AbilityButton): AbilityInstance | undefined {
    return this.bindings.get(button);
  }

  /** Cancels charges in progress; a new press is needed to start again. */
  cancelAll(): void {
    for (const ability of this.actives) ability.cancel?.();
  }

  update(dt: number, input: AbilityContext['input']): void {
    this.energy.update(dt);
    for (const ability of this.passives) ability.update(dt, false, false);
    for (const [button, ability] of this.bindings) ability.update(dt, input.isDown(button), input.justPressed(button));
  }
}
