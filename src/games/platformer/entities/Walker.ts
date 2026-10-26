import Phaser from 'phaser';
import { ANIM } from '../assets/animations';
import { TEX } from '../assets/manifest';
import { WALKER_SPEED } from '../config';
import { DEPTH } from '../view/ParallaxBackground';

/** Patrol enemy: walks until it meets a wall or a ledge, then turns around. */
export class Walker extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;

  private direction = -1;
  private alive = true;
  private readonly terrain: Phaser.Tilemaps.TilemapLayer;

  constructor(scene: Phaser.Scene, x: number, y: number, terrain: Phaser.Tilemaps.TilemapLayer) {
    super(scene, x, y, TEX.walker, 0);
    this.terrain = terrain;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setSize(12, 10).setOffset(2, 6);
    this.setCollideWorldBounds(true);
    this.setDepth(DEPTH.enemies);
    this.play(ANIM.walker.walk);
  }

  get isAlive(): boolean {
    return this.alive;
  }

  update(): void {
    if (!this.alive) return;
    const body = this.body;
    if (body.blocked.left) this.direction = 1;
    else if (body.blocked.right) this.direction = -1;
    else if (body.blocked.down) {
      const aheadX = this.direction > 0 ? body.right + 1 : body.left - 1;
      const ground = this.terrain.getTileAtWorldXY(aheadX, body.bottom + 1);
      if (!ground || !ground.collideUp) this.direction *= -1;
    }
    body.setVelocityX(WALKER_SPEED * this.direction);
    this.setFlipX(this.direction > 0);
  }

  stomp(): void {
    if (!this.alive) return;
    this.alive = false;
    this.body.stop();
    this.body.enable = false;
    this.play(ANIM.walker.squash);
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      delay: 300,
      duration: 300,
      onComplete: () => this.destroy(),
    });
  }
}
