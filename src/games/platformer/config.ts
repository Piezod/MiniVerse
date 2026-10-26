import Phaser from 'phaser';

export const PlatformerScenes = {
  Preload: 'Platformer.Preload',
  LevelSelect: 'Platformer.LevelSelect',
  Level: 'Platformer.Level',
  Hud: 'Platformer.Hud',
} as const;

export type PlatformerAction = 'left' | 'right' | 'jump';

const K = Phaser.Input.Keyboard.KeyCodes;
export const PLATFORMER_BINDINGS: Record<PlatformerAction, number[]> = {
  left: [K.LEFT, K.A],
  right: [K.RIGHT, K.D],
  jump: [K.SPACE, K.UP, K.W],
};

export { GRAVITY, PLAYER_BODY, PLAYER_TUNING, WALKER_SPEED } from './physics';
export const START_LIVES = 3;

export const LevelEvent = {
  Stars: 'stars',
  Lives: 'lives',
  Victory: 'victory',
  GameOver: 'gameover',
} as const;
