import Phaser from 'phaser';
import { KEY_BINDINGS, type PlatformerAction } from './controls';

export type { AbilityButton, PlatformerAction } from './controls';

export const PlatformerScenes = {
  Preload: 'Platformer.Preload',
  LevelSelect: 'Platformer.LevelSelect',
  Shop: 'Platformer.Shop',
  Affinity: 'Platformer.Affinity',
  Level: 'Platformer.Level',
  Hud: 'Platformer.Hud',
} as const;

const K = Phaser.Input.Keyboard.KeyCodes as unknown as Record<string, number>;
export const PLATFORMER_BINDINGS = Object.fromEntries(
  Object.entries(KEY_BINDINGS).map(([action, keys]) => [action, keys.map((name) => K[name])]),
) as Record<PlatformerAction, number[]>;

export { GRAVITY, PLAYER_BODY, PLAYER_TUNING, WALKER_SPEED } from './physics';
export const START_LIVES = 3;
export const PLAYER_MAX_HP = 3;

export const LevelEvent = {
  Stars: 'stars',
  Lives: 'lives',
  Health: 'health',
  Victory: 'victory',
  GameOver: 'gameover',
} as const;
