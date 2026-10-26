import type { AbilityModule } from '../Ability';
import type { AbilityModuleId } from '../moduleIds';
import { flamethrower } from './flamethrower';
import { jetpack } from './jetpack';
import { projectile } from './projectile';

/** Reusable ability behaviours. New abilities can reuse a module with different params in abilities.json. */
export const ABILITY_MODULES: Record<AbilityModuleId, AbilityModule> = { jetpack, projectile, flamethrower };
