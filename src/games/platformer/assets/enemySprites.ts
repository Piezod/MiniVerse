import type { AnimationDef } from '../../../core/animation/AnimationRegistry';
import { TEX } from './manifest';

/**
 * Visual families available to enemies.json ("sprite": "<id>"). Each one maps a spritesheet to
 * move/attack/death animations and a collision box (px, unscaled). Hurt is a runtime white flash.
 */
export interface EnemySpriteDef {
  texture: string;
  body: { width: number; height: number; offsetX: number; offsetY: number };
  /** True when the art faces left. */
  facesLeft: boolean;
  frameRate: number;
  anims: { move: number[]; attack?: number[]; death: number[] };
}

export const ENEMY_SPRITES: Readonly<Record<string, EnemySpriteDef>> = {
  walker: { texture: TEX.walker, body: { width: 12, height: 10, offsetX: 2, offsetY: 6 }, facesLeft: true, frameRate: 6, anims: { move: [0, 1], death: [2, 3] } },
  bat: { texture: TEX.bat, body: { width: 10, height: 8, offsetX: 3, offsetY: 5 }, facesLeft: true, frameRate: 10, anims: { move: [0, 1], death: [2] } },
  golem: {
    texture: TEX.golem,
    body: { width: 16, height: 18, offsetX: 4, offsetY: 6 },
    facesLeft: true,
    frameRate: 4,
    anims: { move: [0, 1], attack: [2], death: [3] },
  },
  spitter: { texture: TEX.spitter, body: { width: 10, height: 10, offsetX: 3, offsetY: 6 }, facesLeft: true, frameRate: 4, anims: { move: [0], attack: [1], death: [2] } },
};

export const enemyAnimKey = (sprite: string, anim: 'move' | 'attack' | 'death'): string => `platformer.enemy.${sprite}.${anim}`;

export const ENEMY_ANIMS: readonly AnimationDef[] = Object.entries(ENEMY_SPRITES).flatMap(([id, sprite]) =>
  (['move', 'attack', 'death'] as const)
    .filter((name) => sprite.anims[name])
    .map((name) => ({
      key: enemyAnimKey(id, name),
      texture: sprite.texture,
      frames: sprite.anims[name]!,
      frameRate: sprite.frameRate,
      repeat: name === 'move' ? -1 : 0,
    })),
);

export const PROJECTILE_ANIMS: readonly AnimationDef[] = [
  { key: 'platformer.projectile.beam', texture: TEX.projectiles, frames: [0, 1], frameRate: 12 },
  { key: 'platformer.projectile.fireball', texture: TEX.projectiles, frames: [2, 3], frameRate: 8 },
];
