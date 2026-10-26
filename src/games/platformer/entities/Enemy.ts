import Phaser from 'phaser';
import { ENEMY_SPRITES, enemyAnimKey, type EnemySpriteDef } from '../assets/enemySprites';
import { hex } from '../assets/palette';
import { Health, type Hit, type HitResult } from '../combat/damage';
import { Cooldown } from '../combat/resources';
import { type AiState, nextAiState } from '../enemies/ai';
import type { EnemyDef } from '../enemies/EnemyCatalog';
import { DEPTH } from '../view/ParallaxBackground';

/** What an enemy needs from the level, without depending on the scene class. */
export interface EnemyHost {
  readonly terrain: Phaser.Tilemaps.TilemapLayer;
  target(): { x: number; y: number; alive: boolean };
  enemyShoot(enemy: Enemy, vx: number, vy: number, damage: number): void;
  enemyDied(enemy: Enemy): void;
}

const HURT_TIME = 0.25;
const ATTACK_TIME = 0.45;
/** Bouncing repeatedly on a big enemy only counts one stomp per this window (s). */
const STOMP_IMMUNITY = 0.7;

/** Data-driven enemy: stats and behaviour come from its EnemyDef (enemies.json). */
export class Enemy extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  readonly health: Health;
  private readonly sprite: EnemySpriteDef;
  private readonly attackCooldown: Cooldown;
  private ai: AiState = 'patrol';
  private direction = -1;
  private hurtTime = 0;
  private attackTime = 0;
  private stompImmunity = 0;
  private attacked = false;
  private readonly homeY: number;
  private readonly bar: Phaser.GameObjects.Graphics | null;
  private elapsed = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly def: EnemyDef,
    private readonly host: EnemyHost,
  ) {
    const sprite = ENEMY_SPRITES[def.sprite];
    super(scene, x, y, sprite.texture, sprite.anims.move[0]);
    this.sprite = sprite;
    this.health = new Health(def.maxHealth);
    this.attackCooldown = new Cooldown(def.attack?.cooldown ?? 1);
    this.homeY = y;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const { width, height, offsetX, offsetY } = sprite.body;
    this.setScale(def.scale).setOrigin(0.5, 1);
    this.body.setSize(width, height).setOffset(offsetX, offsetY);
    this.setCollideWorldBounds(true);
    this.setDepth(DEPTH.enemies);
    if (def.tint) this.setTint(hex(def.tint));
    if (def.movement === 'fly') this.body.setAllowGravity(false);
    if (def.movement === 'stationary') this.body.setImmovable(true);
    this.bar = def.healthBar ? scene.add.graphics().setDepth(DEPTH.enemies + 1) : null;
    this.play(enemyAnimKey(def.sprite, 'move'));
    this.once(Phaser.GameObjects.Events.DESTROY, () => this.bar?.destroy());
  }

  get isAlive(): boolean {
    return !this.health.isDead;
  }

  get aiState(): AiState {
    return this.ai;
  }

  /** Applies a hit through the shared damage model, including the frontal guard. */
  applyHit(hit: Hit): HitResult {
    if (!this.isAlive) return { damage: 0, killed: false };
    if (hit.type === 'stomp') {
      if (this.stompImmunity > 0) return { damage: 0, killed: false };
      this.stompImmunity = STOMP_IMMUNITY;
    }
    let amount = hit.amount;
    if (this.def.guard !== undefined && hit.type !== 'stomp' && hit.fromX !== undefined && Math.sign(hit.fromX - this.x) === this.direction) amount *= this.def.guard;
    const result = this.health.apply({ ...hit, amount }, { armor: this.def.armor, resist: this.def.resist });
    if (result.damage > 0) {
      this.hurtTime = HURT_TIME;
      this.setTintFill(0xffffff);
      this.scene.time.delayedCall(80, () => (this.def.tint ? this.setTint(hex(this.def.tint)) : this.clearTint()));
      if (hit.fromX !== undefined && this.def.movement !== 'stationary') this.body.setVelocityX(Math.sign(this.x - hit.fromX) * 60);
    }
    if (result.killed) this.die();
    return result;
  }

  /** Instant kill (stomp rule "kill"). */
  kill(): void {
    if (!this.isAlive) return;
    this.health.apply({ amount: this.health.current, type: 'stomp' });
    this.die();
  }

  update(_time: number, delta: number): void {
    if (!this.isAlive) return;
    const dt = delta / 1000;
    this.elapsed += dt;
    this.attackCooldown.update(dt);
    this.hurtTime = Math.max(0, this.hurtTime - dt);
    this.attackTime = Math.max(0, this.attackTime - dt);
    this.stompImmunity = Math.max(0, this.stompImmunity - dt);

    const target = this.host.target();
    const distance = target.alive ? Phaser.Math.Distance.Between(this.x, this.y - this.displayHeight / 2, target.x, target.y) : Infinity;
    const previous = this.ai;
    this.ai = nextAiState(this.def, {
      dead: false,
      hurtTime: this.hurtTime,
      attackTime: this.attackTime,
      distance,
      attackReady: this.attackCooldown.ready,
    });
    if (this.ai === 'attack' && previous !== 'attack') {
      this.attackTime = ATTACK_TIME;
      this.attacked = false;
    }

    const body = this.body;
    const speed = this.def.speed;
    const toward = Math.sign(target.x - this.x) || this.direction;
    switch (this.ai) {
      case 'hurt':
        body.setVelocityX(body.velocity.x * 0.9);
        if (this.def.movement === 'fly') body.setVelocityY(0);
        break;
      case 'attack':
        this.direction = toward;
        this.performAttack(target);
        break;
      case 'chase':
        this.direction = toward;
        if (this.def.movement === 'fly') {
          const angle = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
          body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
        } else {
          body.setVelocityX(this.groundAhead() ? speed * toward : 0);
        }
        break;
      case 'patrol':
        this.patrol();
        break;
      case 'idle':
        body.setVelocityX(0);
        // Flying enemies hover around their spawn height while waiting.
        if (this.def.movement === 'fly') body.setVelocityY((this.homeY + Math.sin(this.elapsed * 2) * 6 - this.y) * 2);
        break;
      case 'death':
        break;
    }
    this.setFlipX(this.direction > 0 === this.sprite.facesLeft);
    const anim = this.ai === 'attack' && this.sprite.anims.attack ? 'attack' : 'move';
    this.play(enemyAnimKey(this.def.sprite, anim), true);
    this.drawHealthBar();
  }

  private patrol(): void {
    const body = this.body;
    if (body.blocked.left) this.direction = 1;
    else if (body.blocked.right) this.direction = -1;
    else if (body.blocked.down && !this.groundAhead()) this.direction *= -1;
    body.setVelocityX(this.def.speed * this.direction);
  }

  private groundAhead(): boolean {
    const body = this.body;
    if (!body.blocked.down) return true;
    const aheadX = this.direction > 0 ? body.right + 1 : body.left - 1;
    const tile = this.host.terrain.getTileAtWorldXY(aheadX, body.bottom + 1);
    return !!tile && tile.collideUp;
  }

  private performAttack(target: { x: number; y: number }): void {
    const attack = this.def.attack;
    if (!attack || this.attacked) return;
    const body = this.body;
    if (attack.kind === 'hop') {
      if (!body.blocked.down) return;
      body.setVelocity(this.direction * Math.max(this.def.speed, 40), -attack.power);
    } else {
      body.setVelocityX(0);
      const angle = this.def.movement === 'fly' ? Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y) : this.direction > 0 ? 0 : Math.PI;
      this.host.enemyShoot(this, Math.cos(angle) * attack.power, Math.sin(angle) * attack.power, attack.damage);
    }
    this.attacked = true;
    this.attackCooldown.trigger();
  }

  private die(): void {
    this.ai = 'death';
    this.body.stop();
    this.body.enable = false;
    this.bar?.clear();
    this.play(enemyAnimKey(this.def.sprite, 'death'));
    this.host.enemyDied(this);
    this.scene.tweens.add({ targets: this, alpha: 0, delay: 350, duration: 350, onComplete: () => this.destroy() });
  }

  private drawHealthBar(): void {
    if (!this.bar) return;
    this.bar.clear();
    if (!this.def.boss && this.health.fraction >= 1) return;
    const width = Math.max(12, Math.round(this.displayWidth * 0.8));
    const x = Math.round(this.x - width / 2);
    const y = Math.round(this.y - this.displayHeight - 4);
    this.bar.fillStyle(0x141327).fillRect(x - 1, y - 1, width + 2, 4);
    this.bar.fillStyle(this.def.boss ? 0xff7a45 : 0xff5a7a).fillRect(x, y, Math.ceil(width * this.health.fraction), 2);
  }
}
