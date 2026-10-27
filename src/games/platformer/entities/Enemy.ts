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
import { OmegaController } from '../enemies/OmegaController';

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
  bossEngaged?(enemy: Enemy): boolean;
  bossHazards?(enemy: Enemy, active: boolean): void;
  clearBossShots?(enemy: Enemy): void;
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
  readonly omega: OmegaController | null;
  private readonly defense: Defense;
  private readonly sprite: EnemySpriteDef;
  private readonly attackCooldown: Cooldown;
  private ai: AiState = 'patrol';
  private direction = -1;
  private hurtTime = 0;
  private attackTime = 0;
  private recoveryTime = 0;
  private stompImmunity = 0;
  private attacked = false;
  private shotsRemaining = 0;
  private shotDelay = 0;
  /** Seconds of attack warning left (the enemy holds still and flashes). */
  private windup = 0;
  private windupClock = 0;
  private attackTarget = { x: 0, y: 0 };
  private patrolDir: 1 | -1 = 1;
  private readonly homeX: number;
  private readonly homeY: number;
  private readonly bar: Phaser.GameObjects.Graphics | null;
  private hurtFlash: Phaser.Time.TimerEvent | null = null;
  private deathTween: Phaser.Tweens.Tween | null = null;
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
    this.omega = def.id === 'omega-7' ? new OmegaController() : null;
    this.defense = { element: def.element, armor: def.armor, resist: def.resist, formResist: def.formResist, immune: def.immune };
    this.status = new StatusEffects(host.statusCatalog, { element: def.element, immune: def.statusImmune });
    this.attackCooldown = new Cooldown(def.attack?.cooldown ?? 1);
    this.homeX = x;
    this.homeY = y;
    this.direction = def.facing === 'right' ? 1 : -1;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const { width, height, offsetX, offsetY } = sprite.body;
    this.setScale(def.scale).setOrigin(0.5, 1);
    this.body.setSize(width, height).setOffset(offsetX, offsetY);
    this.setCollideWorldBounds(true);
    this.setDepth(DEPTH.enemies);
    this.setFlipX(this.direction > 0 === sprite.facesLeft);
    if (def.tint) this.setTint(hex(def.tint));
    if (isFlying(def)) this.body.setAllowGravity(false);
    if (def.movement === 'stationary') this.body.setImmovable(true);
    this.bar = def.healthBar ? scene.add.graphics().setDepth(DEPTH.enemies + 1) : null;
    if (this.omega) this.bar?.setScrollFactor(0);
    this.play(enemyAnimKey(def.sprite, 'move'));
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      this.host.clearBossShots?.(this);
      if (this.omega) {
        this.host.bossHazards?.(this, false);
      }
      this.hurtFlash?.remove(false);
      this.deathTween?.stop();
      this.bar?.destroy();
    });
  }

  get isAlive(): boolean {
    return !this.health.isDead;
  }

  get aiState(): AiState {
    return this.ai;
  }

  get contactActive(): boolean {
    return this.omega ? this.omega.contactActive : true;
  }

  suspendOmega(reset = false): void {
    if (!this.omega || !this.isAlive) return;
    this.omega.suspend();
    this.body.stop();
    this.host.bossHazards?.(this, false);
    this.host.clearBossShots?.(this);
    if (reset) {
      this.health.reset();
      this.status.clear();
      this.omega.phase = 1;
      this.body.reset(this.homeX, this.homeY);
      this.stompImmunity = 0;
      this.hurtTime = 0;
    }
    this.restoreTint();
    this.drawHealthBar();
  }

  /**
   * Applies a hit through the shared damage model. Situational modifiers added here: the frontal
   * guard and status vulnerability (Sobrecarga). Status effects of the hit are rolled afterwards.
   */
  applyHit(hit: Hit): HitResult {
    if (!this.isAlive) return { damage: 0, killed: false, immune: false };
    if (this.omega && !this.omega.vulnerable) return { damage: 0, killed: false, immune: true };
    if (this.def.guard === 0 && hit.form !== 'status' && (hit.fromX === undefined || (hit.fromX - this.x) * this.direction >= 0)) {
      return { damage: 0, killed: false, immune: true };
    }
    if (hit.form === 'stomp') {
      if (this.stompImmunity > 0) return { damage: 0, killed: false, immune: false };
      this.stompImmunity = STOMP_IMMUNITY;
    }
    let situational = (hit.situational ?? 1) * this.status.damageTakenMultiplier;
    if (this.def.guard !== undefined && this.recoveryTime <= 0 && hit.form !== 'stomp' && hit.form !== 'status' && hit.fromX !== undefined && Math.sign(hit.fromX - this.x) === this.direction) {
      situational *= this.def.guard;
    }
    const result = this.health.apply({ ...hit, situational }, this.defense, this.host.chart);
    if (result.damage > 0 && hit.form !== 'status') {
      this.hurtTime = HURT_TIME;
      if ((this.def.attack?.recovery ?? 0) > 0) {
        this.windup = 0;
        this.shotsRemaining = 0;
        this.attackTime = 0;
        this.recoveryTime = this.def.attack!.recovery!;
        this.attacked = false;
        this.attackCooldown.trigger();
      }
      this.setTintFill(0xffffff);
      this.hurtFlash?.remove(false);
      this.hurtFlash = this.scene.time.delayedCall(80, () => {
        this.hurtFlash = null;
        this.restoreTint();
      });
      if (!this.omega && hit.fromX !== undefined && this.def.movement !== 'stationary') this.body.setVelocityX(Math.sign(this.x - hit.fromX) * 60);
    }
    if (result.killed) this.die();
    else if (!result.immune && hit.effects?.length) {
      for (const id of rollEffects(hit.effects, Math.random)) this.status.apply(id);
      this.restoreTint();
    }
    if (this.omega && !result.killed) {
      const previous = this.omega.state;
      this.omega.update(0, this.health.fraction, this.host.bossEngaged?.(this) ?? true);
      if (previous !== this.omega.state) {
        this.body.stop();
        this.host.bossHazards?.(this, false);
        this.host.clearBossShots?.(this);
      }
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
    if (this.omega) {
      this.stompImmunity = Math.max(0, this.stompImmunity - dt);
      this.updateOmega(dt);
      return;
    }
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
    this.shotDelay = Math.max(0, this.shotDelay - step);
    this.recoveryTime = Math.max(0, this.recoveryTime - step);
    this.stompImmunity = Math.max(0, this.stompImmunity - dt);

    const target = this.host.target();
    const distance = target.alive ? Phaser.Math.Distance.Between(this.x, this.y - this.displayHeight / 2, target.x, target.y) : Infinity;
    const previous = this.ai;
    if (previous === 'attack' && this.shotsRemaining > 0) this.attackTime = Math.max(this.attackTime, 0.01);
    if (!target.alive && previous === 'attack') {
      this.shotsRemaining = 0;
      this.attackTime = 0;
      this.attacked = true;
    }
    if (previous === 'attack' && this.attackTime <= 0 && this.attacked && (this.def.attack?.recovery ?? 0) > 0) {
      this.recoveryTime = this.def.attack!.recovery!;
      this.attacked = false;
    }
    this.ai = nextAiState(this.def, {
      dead: false,
      hurtTime: this.hurtTime,
      attackTime: this.attackTime,
      distance,
      attackReady: this.attackCooldown.ready,
      recoveryTime: this.recoveryTime,
      targetInFront: !this.def.fixedFacing || (target.x - this.x) * this.direction >= 0,
    });
    if (this.ai === 'attack' && previous !== 'attack') {
      if (!this.def.fixedFacing) this.direction = Math.sign(target.x - this.x) || this.direction;
      const telegraph = this.def.attack?.telegraph ?? 0;
      this.windup = telegraph;
      this.windupClock = 0;
      this.attackTarget = { x: target.x, y: target.y };
      this.attackTime = telegraph + (this.def.attack?.kind === 'lunge' ? LUNGE_TIME : ATTACK_TIME);
      this.shotsRemaining = this.def.attack?.kind === 'shoot' ? this.def.attack.burstCount ?? 1 : 0;
      this.shotDelay = 0;
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
        if (!this.def.fixedFacing && !(this.def.attack?.recovery ?? 0)) this.direction = toward;
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
        if (!isFlying(this.def) && this.def.attack?.kind === 'lunge' && (!this.groundAhead() || body.blocked.left || body.blocked.right)) body.setVelocityX(0);
        break;
      case 'recover':
        body.setVelocityX(0);
        if (isFlying(this.def)) body.setVelocityY(0);
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
    const anim = this.ai === 'recover' && this.sprite.anims.recover ? 'recover' : this.ai === 'attack' && this.sprite.anims.attack ? 'attack' : 'move';
    this.play(enemyAnimKey(this.def.sprite, anim), true);
    this.drawHealthBar();
  }

  private updateOmega(dt: number): void {
    const omega = this.omega!;
    const target = this.host.target();
    const engaged = target.alive && !this.status.stunned && (this.host.bossEngaged?.(this) ?? true);
    const previous = omega.state;
    const attack = omega.update(dt, this.health.fraction, engaged);
    if ((omega.state === 'transition' || omega.state === 'dormant') && previous !== omega.state) this.host.clearBossShots?.(this);
    this.host.bossHazards?.(this, omega.hazardsActive);
    this.body.setVelocityX(0);
    if (omega.state === 'telegraph') {
      this.direction = Math.sign(target.x - this.x) || this.direction;
      this.attackTarget = { x: target.x, y: target.y };
      if (telegraphOn(this.scene.time.now / 1000)) this.setTintFill(0xff4a4a);
      else this.restoreTint();
    } else this.restoreTint();
    if (attack === 'shot' || attack === 'combo') {
      const speed = omega.phase === 3 ? 110 : omega.phase === 2 ? 96 : 82;
      const angle = Math.atan2(this.attackTarget.y - (this.y - this.displayHeight / 2), this.attackTarget.x - this.x);
      this.host.enemyShoot(this, Math.cos(angle) * speed, Math.sin(angle) * speed, this.def.attack?.damage ?? 1);
    }
    if (omega.contactActive && this.groundAhead()) {
      const velocity = this.direction * (omega.phase === 3 ? 118 : 88);
      const range = this.def.patrolRange ?? 112;
      const bounded = velocity < 0 ? this.x > this.homeX - range : this.x < this.homeX + range;
      if (bounded && !(velocity < 0 && this.body.blocked.left) && !(velocity > 0 && this.body.blocked.right)) this.body.setVelocityX(velocity);
    }
    this.ai = omega.state === 'attack' || omega.state === 'telegraph' ? 'attack' : omega.state === 'recover' ? 'recover' : 'idle';
    this.setFlipX(this.direction > 0 === this.sprite.facesLeft);
    this.play(enemyAnimKey(this.def.sprite, omega.vulnerable ? 'recover' : this.ai === 'attack' ? 'attack' : 'move'), true);
    this.drawHealthBar();
  }

  private patrol(speed: number): void {
    const body = this.body;
    if (body.blocked.left) this.direction = 1;
    else if (body.blocked.right) this.direction = -1;
    else if (body.blocked.down && !this.groundAhead()) this.direction *= -1;
    if (this.def.patrolRange !== undefined) {
      if (this.x >= this.homeX + this.def.patrolRange) this.direction = -1;
      else if (this.x <= this.homeX - this.def.patrolRange) this.direction = 1;
    }
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
      if (isFlying(this.def)) {
        const velocity = lungeVelocity({ x: this.x, y: this.y }, { x: target.x, y: target.y }, attack.power * slow);
        body.setVelocity(velocity.vx, velocity.vy);
      } else {
        body.setVelocityX(this.groundAhead() ? this.direction * attack.power * slow : 0);
      }
    } else {
      body.setVelocityX(0);
      if (this.shotDelay > 1e-9) return;
      const originY = attack.projectile === 'energy' ? this.y - this.displayHeight / 2 : this.y;
      const angle = isFlying(this.def) ? Phaser.Math.Angle.Between(this.x, originY, target.x, target.y) : this.direction > 0 ? 0 : Math.PI;
      this.host.enemyShoot(this, Math.cos(angle) * attack.power, Math.sin(angle) * attack.power, attack.damage);
      this.shotsRemaining--;
      if (this.shotsRemaining > 0) {
        this.shotDelay = attack.burstInterval ?? 0.25;
        return;
      }
      if ((attack.burstCount ?? 1) > 1) this.attackTime = 0;
    }
    this.attacked = true;
    this.attackCooldown.trigger();
  }

  private die(): void {
    this.shotsRemaining = 0;
    this.host.clearBossShots?.(this);
    this.omega?.defeat();
    if (this.omega) {
      this.host.bossHazards?.(this, false);
    }
    this.ai = 'death';
    this.status.clear();
    if (this.anims.isPaused) this.anims.resume();
    this.body.stop();
    this.body.enable = false;
    this.bar?.clear();
    this.play(enemyAnimKey(this.def.sprite, 'death'));
    this.host.enemyDied(this);
    this.deathTween = this.scene.tweens.add({ targets: this, alpha: 0, delay: 350, duration: 350, onComplete: () => this.destroy() });
  }

  private drawHealthBar(): void {
    if (!this.bar) return;
    this.bar.clear();
    if (this.omega?.state === 'dormant') return;
    if (!this.def.boss && this.health.fraction >= 1) return;
    const width = this.omega ? 96 : Math.max(12, Math.round(this.displayWidth * 0.8));
    const x = this.omega ? 112 : Math.round(this.x - width / 2);
    const y = this.omega ? 160 : Math.round(this.y - this.displayHeight - 4);
    this.bar.fillStyle(0x141327).fillRect(x - 1, y - 1, width + 2, 4);
    this.bar.fillStyle(this.def.boss ? 0xff7a45 : 0xff5a7a).fillRect(x, y, Math.ceil(width * this.health.fraction), 2);
    if (this.omega) {
      this.bar.fillStyle(0xfff8ec).fillRect(x + Math.round(width * 0.7), y - 1, 1, 4);
      this.bar.fillRect(x + Math.round(width * 0.35), y - 1, 1, 4);
    }
  }
}
