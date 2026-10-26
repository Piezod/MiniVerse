/**
 * Keyboard layout of the platformer (Phaser-free so tests can check for conflicts).
 * Key names are Phaser KeyCodes names. Touch buttons map to the same actions.
 */
export type AbilityButton = 'primary' | 'secondary';
export type PlatformerAction = 'left' | 'right' | 'jump' | AbilityButton;

export const ABILITY_BUTTONS: readonly AbilityButton[] = ['primary', 'secondary'];

export const KEY_BINDINGS: Readonly<Record<PlatformerAction, readonly string[]>> = {
  left: ['LEFT', 'A'],
  right: ['RIGHT', 'D'],
  jump: ['SPACE', 'UP', 'W'],
  /** Weapon equipped on the primary slot (Rayo de energía by default). */
  primary: ['F'],
  /** Weapon equipped on the secondary slot (Lanzallamas by default). */
  secondary: ['R'],
};

/** Scene shortcuts handled outside the action input (HUD). */
export const SHORTCUT_KEYS: Readonly<Record<'pause' | 'mute' | 'confirm', readonly string[]>> = {
  pause: ['ESC', 'P'],
  mute: ['M'],
  confirm: ['ENTER'],
};

/** Main key label shown in the HUD and help texts. */
export const keyLabel = (action: PlatformerAction): string => KEY_BINDINGS[action][0];
