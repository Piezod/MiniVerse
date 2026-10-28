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
  anims: { move: number[]; attack?: number[]; recover?: number[]; death: number[] };
}

export const ENEMY_SPRITES: Readonly<Record<string, EnemySpriteDef>> = {
  walker: { texture: TEX.walker, body: { width: 12, height: 10, offsetX: 2, offsetY: 6 }, facesLeft: true, frameRate: 6, anims: { move: [0, 1], death: [2, 3] } },
  bat: { texture: TEX.bat, body: { width: 10, height: 8, offsetX: 3, offsetY: 5 }, facesLeft: true, frameRate: 10, anims: { move: [0, 1], death: [2] } },
  'nexar-bat': { texture: TEX.nexarBat, body: { width: 12, height: 9, offsetX: 2, offsetY: 4 }, facesLeft: true, frameRate: 9, anims: { move: [0, 1], attack: [2], death: [3] } },
  golem: {
    texture: TEX.golem,
    body: { width: 16, height: 18, offsetX: 4, offsetY: 6 },
    facesLeft: true,
    frameRate: 4,
    anims: { move: [0, 1], attack: [2], death: [3] },
  },
  drone: { texture: TEX.drone, body: { width: 10, height: 8, offsetX: 3, offsetY: 5 }, facesLeft: true, frameRate: 12, anims: { move: [0, 1], attack: [2], death: [3] } },
  sentinel: { texture: TEX.sentinel, body: { width: 16, height: 12, offsetX: 4, offsetY: 5 }, facesLeft: true, frameRate: 6, anims: { move: [0, 1], attack: [2], death: [3] } },
  spitter: { texture: TEX.spitter, body: { width: 10, height: 10, offsetX: 3, offsetY: 6 }, facesLeft: true, frameRate: 4, anims: { move: [0], attack: [1], death: [2] } },
  turret: { texture: TEX.turret, body: { width: 18, height: 18, offsetX: 3, offsetY: 6 }, facesLeft: true, frameRate: 4, anims: { move: [0, 1], attack: [2], death: [3] } },
  guardian: { texture: TEX.guardian, body: { width: 16, height: 26, offsetX: 4, offsetY: 6 }, facesLeft: true, frameRate: 4, anims: { move: [0, 1], attack: [2], recover: [4], death: [3] } },
  'organic-guardian': { texture: TEX.organicGuardian, body: { width: 16, height: 26, offsetX: 4, offsetY: 6 }, facesLeft: true, frameRate: 4, anims: { move: [0, 1], attack: [2], recover: [4], death: [3] } },
  'electric-drone': { texture: TEX.electricDrone, body: { width: 12, height: 12, offsetX: 6, offsetY: 6 }, facesLeft: true, frameRate: 6, anims: { move: [0, 1], attack: [2], recover: [4], death: [3] } },
  technician: { texture: TEX.technician, body: { width: 12, height: 24, offsetX: 6, offsetY: 8 }, facesLeft: true, frameRate: 5, anims: { move: [0, 1], attack: [2], recover: [4], death: [3] } },
  'bio-technician': { texture: TEX.bioTechnician, body: { width: 12, height: 24, offsetX: 6, offsetY: 8 }, facesLeft: true, frameRate: 5, anims: { move: [0, 1], attack: [2], recover: [4], death: [3] } },
  stalker: { texture: TEX.stalker, body: { width: 18, height: 14, offsetX: 3, offsetY: 8 }, facesLeft: true, frameRate: 7, anims: { move: [0, 1], attack: [2], recover: [3], death: [4] } },
  'spore-spitter': { texture: TEX.sporeSpitter, body: { width: 18, height: 16, offsetX: 3, offsetY: 6 }, facesLeft: true, frameRate: 4, anims: { move: [0], attack: [1], death: [2] } },
  omega: { texture: TEX.omega, body: { width: 32, height: 40, offsetX: 8, offsetY: 8 }, facesLeft: true, frameRate: 4, anims: { move: [0, 1], attack: [2], recover: [4], death: [3] } },
  'swarm-queen': { texture: TEX.swarmQueen, body: { width: 30, height: 34, offsetX: 9, offsetY: 12 }, facesLeft: true, frameRate: 5, anims: { move: [0, 1], attack: [2], recover: [4], death: [3] } },
  'sentenio-001': {
  texture: TEX.sentenio001,
  body: {
    width: 64,
    height: 100,
    offsetX: 16,
    offsetY: 14
  },
  facesLeft: true,
  frameRate: 5,
  anims: {
    move: [0, 1],
    attack: [2],
    death: [3],
    recover: [4]
  }
},
};

export const enemyAnimKey = (sprite: string, anim: 'move' | 'attack' | 'recover' | 'death'): string => `platformer.enemy.${sprite}.${anim}`;

export const ENEMY_ANIMS: readonly AnimationDef[] = Object.entries(ENEMY_SPRITES).flatMap(([id, sprite]) =>
  (['move', 'attack', 'recover', 'death'] as const)
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
  { key: 'platformer.projectile.spore', texture: TEX.spore, frames: [0, 1], frameRate: 6 },
];
