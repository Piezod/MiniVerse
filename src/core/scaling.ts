import type Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './config';

/** Integer zoom for crisp pixels, falling back to fractional zoom when integer would waste too much screen. */
export function computeZoom(): number {
  const fit = Math.min(window.innerWidth / GAME_WIDTH, window.innerHeight / GAME_HEIGHT);
  const integer = Math.floor(fit);
  return integer >= 1 && integer / fit >= 0.75 ? integer : Math.max(fit, 0.5);
}

export function enableResponsiveZoom(game: Phaser.Game): void {
  window.addEventListener('resize', () => game.scale.setZoom(computeZoom()));
}
