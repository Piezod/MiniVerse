import Phaser from 'phaser';
import { ENEMY_SPRITES, enemyAnimKey, type EnemySpriteDef } from '../assets/enemySprites';
import { hex } from '../assets/palette';
import { type Defense, Health, type Hit, type HitResult } from '../combat/damage';
import type { ElementChart } from '../combat/elements';
import { Cooldown } from '../combat/resources';
import { rollEffects, type StatusDef, StatusEffects } from '../combat/status';
import { type AiState, nextAiState } from '../enemies/ai';
import { type EnemyDef, isFlying } from '../enemies/EnemyCatalog';
import { hoverPatrol, leashedChase, lungeVelocity, telegraphOn } from '../enemies/flight';
import { DEPTH } from '../view/ParallaxBackground';

/** What an enemy needs from the level, without depending on the scene class. */
export interface EnemyHost {
  readonly terrain: Phaser.Tilemaps.TilemapLayer;
  /** Elemental affinity chart (elements.json). */
  readonly chart: ElementChart;
  /** Status effect definitions (status-effects.json). */
  readonly statusCatalog: Readonly<Record<string, StatusDef>>;
  target(): { x: number; y: number; alive: boolean };
  enemyShoot(enemy: Enemy, vx: number, vy: number, damage: number): void;
  enemyDied(enemy: Enemy): void;
}

const HURT_TIME = 0.25;
const ATTACK_TIME = 0.45;
/** How long a lunge keeps its dash velocity (s). */
const LUNGE_TIME = 0.35;
/** Bouncing repeatedly on a big enemy only counts one stomp per this window (s). */
const STOMP_IMMUNITY = 0.7;

/** Data-driven enemy: stats and behaviour come from its EnemyDef (enemies.json). */
export class Enemy extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  readonly health: Health;
  readonly status: StatusEffects;
  private readonly defense: Defense;
  private readonly sprite: EnemySpriteDef;
  private readonly attackCooldown: Cooldown;
  private ai: AiState = 'patrol';
  private direction = -1;
  private hurtTime = 0;
  private attackTime = 0;
  private stompImmunity = 0;
  private attacked = false;
  /** Seconds of attack warning left (the enemy holds still and flashes). */
  private windup = 0;
  private windupClock = 0;
  private attackTarget = { x: 0, y: 0 };
  private patrolDir: 1 | -1 = 1;
  private readonly homeX: number;
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
    this.defense = { element: def.element, armor: def.armor, resist: def.resist, formResist: def.formResist, immune: def.immune };
    this.status = new StatusEffects(host.statusCatalog, { element: def.element, immune: def.statusImmune });
    this.attackCooldown = new Cooldown(def.attack?.cooldown ?? 1);
    this.homeX = x;
    this.homeY = y;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const { width, height, offsetX, offsetY } = sprite.body;
    this.setScale(def.scale).setOrigin(0.5, 1);
    this.body.setSize(width, height).setOffset(offsetX, offsetY);
    this.setCollideWorldBounds(true);
    this.setDepth(DEPTH.enemies);
    if (def.tint) this.setTint(hex(def.tint));
    if (isFlying(def)) this.body.setAllowGravity(false);
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

  /**
   * Applies a hit through the shared damage model. Situational modifiers added here: the frontal
   * guard and status vulnerability (Sobrecarga). Status effects of the hit are rolled afterwards.
   */
  applyHit(hit: Hit): HitResult {
    if (!this.isAlive) return { damage: 0, killed: false, immune: false };
    if (hit.form === 'stomp') {
      if (this.stompImmunity > 0) return { damage: 0, killed: false, immune: false };
      this.stompImmunity = STOMP_IMMUNITY;
    }
    let situational = (hit.situational ?? 1) * this.status.damageTakenMultiplier;
    if (this.def.guard !== undefined && hit.form !== 'stomp' && hit.form !== 'status' && hit.fromX !== undefined && Math.sign(hit.fromX - this.x) === this.direction) {
      situational *= this.def.guard;
    }
    const result = this.health.apply({ ...hit, situational }, this.defense, this.host.chart);
    if (result.damage > 0 && hit.form !== 'status') {
      this.hurtTime = HURT_TIME;
      this.setTintFill(0xffffff);
      this.scene.time.delayedCall(80, () => this.restoreTint());
      if (hit.fromX !== undefined && this.def.movement !== 'stationary') this.body.setVelocityX(Math.sign(this.x - hit.fromX) * 60);
    }
    if (result.killed) this.die();
    else if (!result.immune && hit.effects?.length) {
      for (const id of rollEffects(hit.effects, Math.random)) this.status.apply(id);
      this.restoreTint();
    }
    return result;
  }

  /** Instant kill (stomp rule "kill"). */
  kill(): void {
    if (!this.isAlive) return;
    this.health.apply({ amount: this.health.current, form: 'stomp', ignoreArmor: true });
    this.die();
  }

  update(_time: number, delta: number): void {
    if (!this.isAlive) return;
    const dt = delta / 1000;
    const hadStatus = this.status.ids.length > 0;
    for (const tick of this.status.update(dt)) {
      this.applyHit({ amount: tick.amount, form: 'status', element: tick.element, ignoreArmor: true });
      if (!this.isAlive) return;
    }
    if (hadStatus && this.status.ids.length === 0) this.restoreTint();
    const body = this.body;
    if (this.status.stunned) {
      body.setVelocityX(0);
      if (isFlying(this.def)) body.setVelocityY(0);
      this.anims.pause();
      this.drawHealthBar();
      return;
    }
    if (this.anims.isPaused) this.anims.resume();
    const slow = this.status.speedMultiplier;
    const step = dt * slow;
    this.elapsed += step;
    this.attackCooldown.update(step);
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
      const telegraph = this.def.attack?.telegraph ?? 0;
      this.windup = telegraph;
      this.windupClock = 0;
      this.attackTarget = { x: target.x, y: target.y };
      this.attackTime = telegraph + (this.def.attack?.kind === 'lunge' ? LUNGE_TIME : ATTACK_TIME);
      this.attacked = false;
    }

    const speed = this.def.speed * slow;
    const toward = Math.sign(target.x - this.x) || this.direction;
    switch (this.ai) {
      case 'hurt':
        body.setVelocityX(body.velocity.x * 0.9);
        if (isFlying(this.def)) body.setVelocityY(0);
        break;
      case 'attack':
        this.direction = toward;
        if (this.windup > 0) {
          // Warning phase: hold still and flash red so the player can read the attack.
          this.windup = Math.max(0, this.windup - step);
          this.windupClock += dt;
          body.setVelocity(0, isFlying(this.def) ? 0 : body.velocity.y);
          if (telegraphOn(this.windupClock)) this.setTintFill(0xff4a4a);
          else this.restoreTint();
          if (this.windup > 0) break;
          this.restoreTint();
        }
        this.performAttack(this.def.movement === 'hover' ? this.attackTarget : target, slow);
        break;
      case 'chase':
        this.direction = toward;
        if (this.def.movement === 'hover' && this.def.patrol) {
          const v = leashedChase({ x: this.x, y: this.y }, { x: target.x, y: target.y }, { x: this.homeX, y: this.homeY }, this.def.patrol, speed);
          body.setVelocity(v.vx, v.vy);
        } else if (isFlying(this.def)) {
          const angle = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
          body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
        } else {
          body.setVelocityX(this.groundAhead() ? speed * toward : 0);
        }
        break;
      case 'patrol':
        if (this.def.movement === 'hover' && this.def.patrol) {
          const v = hoverPatrol({ x: this.x, y: this.y }, { x: this.homeX, y: this.homeY }, this.def.patrol, speed, this.patrolDir, this.elapsed);
          this.patrolDir = v.dir;
          this.direction = v.dir;
          body.setVelocity(v.vx, v.vy);
        } else this.patrol(speed);
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

  private patrol(speed: number): void {
    const body = this.body;
    if (body.blocked.left) this.direction = 1;
    else if (body.blocked.right) this.direction = -1;
    else if (body.blocked.down && !this.groundAhead()) this.direction *= -1;
    body.setVelocityX(speed * this.direction);
  }

  /** Definition tint, overridden by the most recent status effect tint. */
  private restoreTint(): void {
    if (!this.active) return;
    const tint = this.status.tint ?? this.def.tint;
    if (tint) this.setTint(hex(tint));
    else this.clearTint();
  }

  private groundAhead(): boolean {
    const body = this.body;
    if (!body.blocked.down) return true;
    const aheadX = this.direction > 0 ? body.right + 1 : body.left - 1;
    const tile = this.host.terrain.getTileAtWorldXY(aheadX, body.bottom + 1);
    return !!tile && tile.collideUp;
  }

  private performAttack(target: { x: number; y: number }, slow: number): void {
    const attack = this.def.attack;
    if (!attack || this.attacked) return;
    const body = this.body;
    if (attack.kind === 'hop') {
      if (!body.blocked.down) return;
      body.setVelocity(this.direction * Math.max(this.def.speed, 40) * slow, -attack.power * Math.sqrt(slow));
    } else if (attack.kind === 'lunge') {
      // Dash through the player's position; contact damage does the rest.
      const v = lungeVelocity({ x: this.x, y: this.y }, { x: target.x, y: target.y }, attack.power * slow);
      body.setVelocity(v.vx, v.vy);
    } else {
      body.setVelocityX(0);
      const angle = isFlying(this.def) ? Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y) : this.direction > 0 ? 0 : Math.PI;
      this.host.enemyShoot(this, Math.cos(angle) * attack.power, Math.sin(angle) * attack.power, attack.damage);
    }
    this.attacked = true;
    this.attackCooldown.trigger();
  }

  private die(): void {
    this.ai = 'death';
    this.status.clear();
    if (this.anims.isPaused) this.anims.resume();
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
