/** Runtime module ids that abilities.json may reference (kept Phaser-free for validation/tests). */
export const ABILITY_MODULE_IDS = ['jetpack', 'projectile', 'flamethrower'] as const;
export type AbilityModuleId = (typeof ABILITY_MODULE_IDS)[number];
