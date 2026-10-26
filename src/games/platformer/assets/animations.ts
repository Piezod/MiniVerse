import type { AnimationDef } from '../../../core/animation/AnimationRegistry';
import { TEX } from './manifest';

/**
 * The hero's real art comes from public/assets/platformer/spritesheets/hero/ (see heroSkin.ts);
 * the procedural layout below is only the fallback when that skin is missing:
 *   hero 32x32 (feet on the bottom pixel row, facing right):
 *     idle 0-3 | run 4-9 | jump 10-11 | fall 12-13 | hurt 14-15 | death 16-19
 *   walker 16x16 (facing left): walk 0-1 | squash 2-3
 *   star 16x16: spin 0-3        checkpoint 16x32: off 0 | on 1        portal 32x32: swirl 0-3
 */
export const ANIM = {
  player: {
    idle: 'platformer.player.idle',
    run: 'platformer.player.run',
    jump: 'platformer.player.jump',
    fall: 'platformer.player.fall',
    land: 'platformer.player.land',
    hurt: 'platformer.player.hurt',
    death: 'platformer.player.death',
    /** Provided by the skin for future mechanics; not used yet. */
    attack: 'platformer.player.attack',
    dash: 'platformer.player.dash',
  },
  walker: {
    walk: 'platformer.walker.walk',
    squash: 'platformer.walker.squash',
  },
  star: 'platformer.star.spin',
  portal: 'platformer.portal.swirl',
} as const;

export const PLATFORMER_ANIMS: readonly AnimationDef[] = [
  { key: ANIM.player.idle, texture: TEX.player, frames: [0, 1, 2, 3], frameRate: 5 },
  { key: ANIM.player.run, texture: TEX.player, frames: [4, 5, 6, 7, 8, 9], frameRate: 14 },
  { key: ANIM.player.jump, texture: TEX.player, frames: [10, 11], frameRate: 10 },
  { key: ANIM.player.fall, texture: TEX.player, frames: [12, 13], frameRate: 10 },
  { key: ANIM.player.hurt, texture: TEX.player, frames: [14, 15], frameRate: 16 },
  { key: ANIM.player.death, texture: TEX.player, frames: [16, 17, 18, 19], frameRate: 6, repeat: 0 },
  { key: ANIM.walker.walk, texture: TEX.walker, frames: [0, 1], frameRate: 6 },
  { key: ANIM.walker.squash, texture: TEX.walker, frames: [2, 3], frameRate: 10, repeat: 0 },
  { key: ANIM.star, texture: TEX.star, frames: [0, 1, 2, 3], frameRate: 8 },
  { key: ANIM.portal, texture: TEX.portal, frames: [0, 1, 2, 3], frameRate: 8 },
];
