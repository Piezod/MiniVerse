/** Runtime module ids that abilities.json may reference (kept Phaser-free for validation/tests). */
export const ABILITY_MODULE_IDS = ['jetpack', 'projectile', 'flamethrower', 'charged-shot'] as const;
export type AbilityModuleId = (typeof ABILITY_MODULE_IDS)[number];

/**
 * Modules reserved for planned weapons. An ability using one of these must be `"available": false`
 * (it is shown nowhere and can't be bought) until the module is implemented and moved above.
 */
export const PLANNED_MODULE_IDS = ['cryo-spray', 'plasma-projector'] as const;

