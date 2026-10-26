import type Phaser from 'phaser';
import type { Hit } from '../combat/damage';
import type { Player } from '../entities/Player';
import type { PlatformerFx } from '../view/PlatformerFx';

/** What object views need from the level scene (the objects never reach into the scene itself). */
export interface SceneHost {
  scene: Phaser.Scene;
  player: Player;
  fx: PlatformerFx;
  /** Same entry point as enemies: applies health loss, knockback and invulnerability. */
  damagePlayer(hit: Hit & { fromX: number }): void;
}
