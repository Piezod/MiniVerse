import Phaser from 'phaser';
import { playSound } from '../../../core/audio/Sfx';
import type { ActionInput } from '../../../core/input/ActionInput';
import { ANIM } from '../assets/animations';
import { getHeroSkin } from '../assets/heroSkin';
import { AUDIO, TEX } from '../assets/manifest';
import { PLAYER_BODY, PLAYER_TUNING as T, type PlatformerAction } from '../config';
import { DEPTH } from '../view/ParallaxBackground';

type PlayerMode = 'alive' | 'dead' | 'frozen';

export const PlayerEvent = {
  Jump: 'player-jump',
  Land: 'player-land',
  Step: 'player-step',
} as const;

/**
 * The physics sprite is invisible; `visual` renders the character anchored at the feet, so it can
 * squash/stretch (or use a differently sized AI spritesheet) without affecting collisions.
 */
export class Player extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  readonly visual: Phaser.GameObjects.Sprite;

  private mode: PlayerMode = 'alive';
  private coyote = 0;
  private jumpBuffer = 0;
  private invulnerable = 0;
  private wasOnGround = true;
  private airSpeed = 0;
  private stepTimer = 0;
  private landing = false;
  private jumped = false;
  private actionTime = 0;
  /** True when the art faces left, so flipping is inverted. */
  private readonly artFacesLeft: boolean;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TEX.player, 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setVisible(false);
    // Collision box fits the visible body inside the 32x32 frame (feet at the bottom edge).
    this.body.setSize(PLAYER_BODY.width, PLAYER_BODY.height).setOffset(PLAYER_BODY.offsetX, PLAYER_BODY.offsetY);
    this.body.setMaxVelocityY(T.maxFallSpeed);
    this.setCollideWorldBounds(true);

    const skin = getHeroSkin(scene);
    const originX = skin?.anchor ? skin.anchor.x / skin.frameWidth : 0.5;
    const originY = skin?.anchor ? skin.anchor.y / skin.frameHeight : 1;
    this.artFacesLeft = skin?.facing === 'left';
    this.visual = scene.add.sprite(x, y + 16, TEX.player, 0).setOrigin(originX, originY).setDepth(DEPTH.player);
    this.visual.play(ANIM.player.idle);

    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.syncVisual, this);
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.syncVisual, this);
      this.visual.destroy();
    });
  }

  get isAlive(): boolean {
    return this.mode === 'alive';
  }

  get isInvulnerable(): boolean {
    return this.invulnerable > 0;
  }

  get facing(): number {
    return this.visual.flipX !== this.artFacesLeft ? -1 : 1;
  }

  /** True during the frame in which the regular (ground/coyote) jump happened. */
  get jumpedThisFrame(): boolean {
    return this.jumped;
  }

  /** Whether the regular jump is still available (on ground or within coyote time). */
  get canGroundJump(): boolean {
    return this.coyote > 0;
  }

  /** Extra jump triggered by abilities (e.g. jetpack). */
  airJump(velocity: number): void {
    this.body.setVelocityY(-velocity);
    this.jumpBuffer = 0;
    this.squash(0.8, 1.2, 160);
  }

  /** Plays the first existing animation of `keys` for `ms`, overriding movement animations. */
  playAction(keys: readonly string[], ms: number): void {
    const key = keys.find((k) => this.scene.anims.exists(k));
    if (!key || this.mode !== 'alive') return;
    this.landing = false;
    this.actionTime = ms / 1000;
    this.visual.anims.timeScale = 1;
    this.visual.play(key, true);
  }

  /** Non-lethal hit: knockback, short hurt animation and temporary invulnerability. */
  hurt(fromX: number): void {
    if (this.mode !== 'alive') return;
    const dir = this.x < fromX ? -1 : 1;
    this.body.setVelocity(dir * 140, -180);
    this.invulnerable = T.invulnerableTime;
    this.playAction([ANIM.player.hurt], 300);
  }

  update(input: ActionInput<PlatformerAction>, delta: number): void {
    if (this.mode !== 'alive') return;
    const dt = delta / 1000;
    const body = this.body;
    const onGround = body.blocked.down;
    this.jumped = false;
    this.actionTime = Math.max(0, this.actionTime - dt);

    const dir = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
    const rate = dir === 0 && onGround ? T.groundDecel : onGround ? T.groundAccel : T.airAccel;
    const diff = dir * T.runSpeed - body.velocity.x;
    body.setVelocityX(body.velocity.x + Phaser.Math.Clamp(diff, -rate * dt, rate * dt));
    if (dir !== 0) this.visual.setFlipX(dir < 0 !== this.artFacesLeft);

    if (onGround && !this.wasOnGround && this.airSpeed > 90) {
      this.emit(PlayerEvent.Land, this.airSpeed);
      const k = Math.min(1, this.airSpeed / T.maxFallSpeed);
      this.squash(1 + 0.3 * k, 1 - 0.25 * k, 140);
      this.landing = this.scene.anims.exists(ANIM.player.land);
      if (this.landing) this.visual.play(ANIM.player.land);
    }
    this.wasOnGround = onGround;
    this.airSpeed = onGround ? 0 : Math.max(0, body.velocity.y);

    // Coyote time and jump buffering make jumps forgiving near ledges and on landing.
    this.coyote = onGround ? T.coyoteTime : Math.max(0, this.coyote - dt);
    this.jumpBuffer = input.justPressed('jump') ? T.jumpBuffer : Math.max(0, this.jumpBuffer - dt);
    if (this.jumpBuffer > 0 && this.coyote > 0) {
      body.setVelocityY(-T.jumpVelocity);
      this.jumpBuffer = 0;
      this.coyote = 0;
      this.jumped = true;
      playSound(this.scene, AUDIO.jump);
      this.emit(PlayerEvent.Jump);
      this.squash(0.75, 1.25, 180);
    }
    // Variable jump height: releasing early cuts the ascent.
    if (!input.isDown('jump') && body.velocity.y < -T.jumpCutVelocity) body.setVelocityY(-T.jumpCutVelocity);

    if (onGround && Math.abs(body.velocity.x) > 60) {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.stepTimer = 0.22;
        this.emit(PlayerEvent.Step);
      }
    }

    if (this.invulnerable > 0) {
      this.invulnerable = Math.max(0, this.invulnerable - dt);
      this.visual.setAlpha(this.invulnerable > 0 && Math.floor(this.invulnerable * 12) % 2 === 0 ? 0.35 : 1);
    }

    const anims = this.visual.anims;
    // The landing animation plays to the end unless the player jumps or starts running.
    if (this.landing && (!onGround || Math.abs(body.velocity.x) > 15 || !anims.isPlaying)) this.landing = false;
    if (this.landing) return;
    if (this.actionTime > 0) return;
    if (!onGround) {
      anims.play(body.velocity.y < 0 ? ANIM.player.jump : ANIM.player.fall, true);
      anims.timeScale = 1;
    } else if (Math.abs(body.velocity.x) > 15) {
      anims.play(ANIM.player.run, true);
      anims.timeScale = Phaser.Math.Clamp(Math.abs(body.velocity.x) / T.runSpeed, 0.5, 1);
    } else {
      anims.play(ANIM.player.idle, true);
      anims.timeScale = 1;
    }
  }

  bounce(): void {
    this.body.setVelocityY(-T.stompBounce);
    this.squash(0.8, 1.2, 160);
  }

  die(onDone: () => void): void {
    if (this.mode !== 'alive') return;
    this.mode = 'dead';
    this.landing = false;
    this.visual.setAlpha(1).setScale(1);
    this.visual.anims.timeScale = 1;
    this.body.setVelocity(0, 0);
    this.body.setAllowGravity(false);
    this.visual.play(ANIM.player.hurt);
    this.scene.time.delayedCall(350, () => {
      this.visual.play(ANIM.player.death);
      this.body.setAllowGravity(true);
      this.body.setVelocity(0, -220);
    });
    this.scene.time.delayedCall(1500, onDone);
  }

  respawnAt(x: number, y: number): void {
    this.mode = 'alive';
    this.body.reset(x, y);
    this.body.setAllowGravity(true);
    this.visual.setFlipX(this.artFacesLeft);
    this.invulnerable = T.invulnerableTime;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.wasOnGround = true;
    this.airSpeed = 0;
    this.visual.play(ANIM.player.idle);
    this.syncVisual();
  }

  freeze(): void {
    this.mode = 'frozen';
    this.visual.setAlpha(1);
    this.body.setVelocity(0, 0);
    this.visual.play(ANIM.player.idle);
  }

  private squash(scaleX: number, scaleY: number, duration: number): void {
    this.scene.tweens.killTweensOf(this.visual);
    this.visual.setScale(scaleX, scaleY);
    this.scene.tweens.add({ targets: this.visual, scaleX: 1, scaleY: 1, duration, ease: 'Quad.easeOut' });
  }

  private syncVisual(): void {
    this.visual.setPosition(Math.round(this.body.center.x), Math.round(this.body.bottom));
  }
}
