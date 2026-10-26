import { EnergyPool } from '../combat/resources';
import type { AbilityDef } from './AbilityCatalog';
import type { AbilityContext, AbilityInstance } from './Ability';
import { ABILITY_MODULES } from './modules';
import type { AbilityModuleId } from './moduleIds';

export const ENERGY_MAX = 100;
export const ENERGY_REGEN = 20;

/** Runs the equipped abilities: passives every frame, actives bound to the skill1/skill2 buttons. */
export class AbilitySystem {
  readonly energy = new EnergyPool(ENERGY_MAX, ENERGY_REGEN);
  readonly passives: AbilityInstance[] = [];
  readonly actives: AbilityInstance[] = [];

  constructor(ctx: Omit<AbilityContext, 'energy'>, loadout: ReadonlyArray<{ def: AbilityDef; level: number }>) {
    const full: AbilityContext = { ...ctx, energy: this.energy };
    for (const { def, level } of loadout) {
      const module = ABILITY_MODULES[def.module as AbilityModuleId];
      const stats = def.levels[Math.min(level, def.levels.length) - 1];
      if (!module || !stats) continue;
      const instance = module(full, def, level, stats);
      (def.slot === 'active' ? this.actives : this.passives).push(instance);
    }
  }

  update(dt: number, input: AbilityContext['input']): void {
    this.energy.update(dt);
    for (const ability of this.passives) ability.update(dt, false, false);
    this.actives.forEach((ability, i) => {
      const action = i === 0 ? 'skill1' : 'skill2';
      ability.update(dt, input.isDown(action), input.justPressed(action));
    });
  }
}
