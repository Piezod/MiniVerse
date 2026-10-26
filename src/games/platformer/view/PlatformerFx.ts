import Phaser from 'phaser';
import { FX_FRAME, TEX } from '../assets/manifest';
import { hex, PALETTE } from '../assets/palette';
import type { AmbientParticlesDef, BiomeTheme } from '../biomes/BiomeTheme';
import { DEPTH } from './ParallaxBackground';

type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;
type EmitterConfig = Phaser.Types.GameObjects.Particles.ParticleEmitterConfig;

const fade = { start: 1, end: 0 };

/** All particle effects of a level. Particles never scale, so they stay pixel-perfect. */
export class PlatformerFx {
  private readonly dust: Emitter;
  private readonly sparkle: Emitter;
  private readonly debris: Emitter;
  private readonly burst: Emitter;
  private readonly rising: Emitter;
  private readonly jetEmitter: Emitter;
  private readonly flames: Record<-1 | 1, Emitter>;
  private readonly zap: Emitter;
  private readonly embers: Emitter;
  private readonly ambient: Emitter[];

  constructor(
    private readonly scene: Phaser.Scene,
    world: BiomeTheme,
  ) {
    const make = (config: EmitterConfig, depth: number = DEPTH.particles): Emitter =>
      scene.add.particles(0, 0, TEX.fx, { emitting: false, ...config }).setDepth(depth);

    this.dust = make({
      frame: [FX_FRAME.dust, FX_FRAME.square, FX_FRAME.pixel],
      tint: world.fx.dust,
      lifespan: { min: 250, max: 450 },
      speed: { min: 12, max: 40 },
      angle: [175, 185, 195, 345, 355, 5],
      gravityY: -20,
      alpha: fade,
    });
    this.sparkle = make({
      frame: [FX_FRAME.sparkle, FX_FRAME.square, FX_FRAME.pixel],
      tint: [hex(PALETTE.gold), hex(PALETTE.goldLight), hex(PALETTE.white)],
      lifespan: { min: 350, max: 650 },
      speed: { min: 25, max: 75 },
      angle: { min: 0, max: 360 },
      gravityY: 60,
      alpha: fade,
      blendMode: Phaser.BlendModes.ADD,
    });
    this.debris = make({
      frame: [FX_FRAME.square, FX_FRAME.pixel],
      tint: [hex(PALETTE.metal), hex(PALETTE.metalLight), hex(PALETTE.moss), hex(PALETTE.glow)],
      lifespan: { min: 450, max: 800 },
      speed: { min: 40, max: 100 },
      angle: { min: 210, max: 330 },
      gravityY: 380,
      alpha: fade,
    });
    this.burst = make({
      frame: [FX_FRAME.square, FX_FRAME.pixel, FX_FRAME.sparkle],
      tint: [hex(PALETTE.scarf), hex(PALETTE.scarfLight), hex(PALETTE.white), hex(PALETTE.coatLight)],
      lifespan: { min: 500, max: 900 },
      speed: { min: 30, max: 110 },
      angle: { min: 0, max: 360 },
      gravityY: 80,
      alpha: fade,
    });
    this.rising = make({
      frame: [FX_FRAME.square, FX_FRAME.pixel],
      tint: [hex(PALETTE.glow), hex(PALETTE.white)],
      lifespan: { min: 700, max: 1200 },
      speedX: { min: -14, max: 14 },
      speedY: { min: -55, max: -20 },
      alpha: fade,
      blendMode: Phaser.BlendModes.ADD,
    });
    this.ambient = world.ambient.map((def) => this.createAmbient(def));

    const fire = [0xff7a45, 0xffd56b, 0xfff3c4, 0xc84a3a];
    this.jetEmitter = make({
      frame: [FX_FRAME.dust, FX_FRAME.square, FX_FRAME.pixel],
      tint: fire,
      lifespan: { min: 180, max: 320 },
      speed: { min: 50, max: 90 },
      angle: { min: 75, max: 105 },
      alpha: fade,
      blendMode: Phaser.BlendModes.ADD,
    });
    const flame = (dir: -1 | 1): Emitter =>
      make({
        frame: [FX_FRAME.dust, FX_FRAME.square],
        tint: fire,
        lifespan: { min: 160, max: 280 },
        speed: { min: 90, max: 140 },
        angle: dir > 0 ? { min: -14, max: 14 } : { min: 166, max: 194 },
        gravityY: -60,
        alpha: fade,
        blendMode: Phaser.BlendModes.ADD,
      });
    this.flames = { [-1]: flame(-1), 1: flame(1) } as Record<-1 | 1, Emitter>;
    this.zap = make({
      frame: [FX_FRAME.square, FX_FRAME.pixel, FX_FRAME.sparkle],
      tint: [hex(PALETTE.glow), hex(PALETTE.white)],
      lifespan: { min: 150, max: 300 },
      speed: { min: 30, max: 80 },
      angle: { min: 0, max: 360 },
      alpha: fade,
      blendMode: Phaser.BlendModes.ADD,
    });
    this.embers = make({
      frame: [FX_FRAME.square, FX_FRAME.pixel],
      tint: fire,
      lifespan: { min: 200, max: 400 },
      speed: { min: 30, max: 80 },
      angle: { min: 0, max: 360 },
      gravityY: 120,
      alpha: fade,
      blendMode: Phaser.BlendModes.ADD,
    });
  }

  private createAmbient(def: AmbientParticlesDef): Emitter {
    return this.scene.add
      .particles(0, 0, TEX.fx, {
        frame: def.frame,
        tint: def.tints,
        frequency: def.frequency,
        lifespan: { min: def.lifespan[0], max: def.lifespan[1] },
        x: { min: -20, max: this.scene.scale.width + 20 },
        y: { min: -10, max: this.scene.scale.height },
        speedX: { min: def.speedX[0], max: def.speedX[1] },
        speedY: { min: def.speedY[0], max: def.speedY[1] },
        alpha: { onEmit: () => 0, onUpdate: (_p, _k, t) => Math.sin(t * Math.PI) * (0.6 + 0.4 * Math.sin(t * 40)) },
        blendMode: def.additive ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL,
      })
      .setDepth(DEPTH.particles);
  }

  /** Keeps ambient emitters spawning around the visible area. */
  update(camera: Phaser.Cameras.Scene2D.Camera): void {
    for (const emitter of this.ambient) emitter.setPosition(camera.scrollX, camera.scrollY);
  }

  jump(x: number, y: number): void {
    this.dust.explode(6, x, y);
  }

  land(x: number, y: number, impact: number): void {
    this.dust.explode(Phaser.Math.Clamp(Math.round(impact / 40), 3, 10), x, y);
  }

  step(x: number, y: number): void {
    this.dust.explode(1, x, y);
  }

  collect(x: number, y: number): void {
    this.sparkle.explode(12, x, y);
    this.flash(x, y, hex(PALETTE.gold), 0.9);
  }

  enemyDefeated(x: number, y: number): void {
    this.debris.explode(10, x, y);
    this.dust.explode(5, x, y + 4);
  }

  playerDeath(x: number, y: number): void {
    this.burst.explode(22, x, y);
  }

  checkpoint(x: number, y: number): void {
    this.rising.explode(18, x, y);
    this.flash(x, y, hex(PALETTE.glow), 1.6);
  }

  victory(x: number, y: number): void {
    this.rising.explode(30, x, y);
    this.sparkle.explode(24, x, y);
  }

  /** Jetpack thrust under the feet. */
  jet(x: number, y: number, amount = 6): void {
    this.jetEmitter.explode(amount, x, y);
  }

  /** One frame of flamethrower stream in front of the player. */
  flame(x: number, y: number, dir: -1 | 1): void {
    this.flames[dir].explode(3, x, y);
  }

  impact(x: number, y: number, kind: 'beam' | 'fire'): void {
    (kind === 'beam' ? this.zap : this.embers).explode(6, x, y);
  }

  private chargeGlow: Phaser.GameObjects.Image | null = null;

  /** Charging glow on the armor: pulsing halo plus sparks pulled toward the chest. Call every frame. */
  setCharge(x: number, y: number, fraction: number, color: string): void {
    const tint = hex(color);
    this.chargeGlow ??= this.scene.add.image(x, y, TEX.glow).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.particles);
    const pulse = 1 + 0.15 * Math.sin(this.scene.time.now / 40);
    this.chargeGlow.setPosition(x, y).setTint(tint).setAlpha(0.35 + 0.6 * fraction).setScale((0.25 + 0.55 * fraction) * pulse);
    if (Math.random() < 0.3 + fraction * 0.6) {
      const angle = Math.random() * Math.PI * 2;
      const r = 14;
      const spark = this.scene.add.rectangle(x + Math.cos(angle) * r, y + Math.sin(angle) * r, 1, 1, fraction >= 1 ? 0xffffff : tint).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.particles);
      this.scene.tweens.add({ targets: spark, x, y, alpha: 0, duration: 200, onComplete: () => spark.destroy() });
    }
  }

  endCharge(): void {
    this.chargeGlow?.destroy();
    this.chargeGlow = null;
  }

  /** Muzzle flash plus a short-lived beam (colored halo, bright core) from x0 to x1. */
  laser(x0: number, x1: number, y: number, height: number, fraction: number, color: string): void {
    this.flash(x0, y, hex(color), 0.8 + fraction);
    const left = Math.min(x0, x1);
    const width = Math.max(2, Math.abs(x1 - x0));
    const add = (h: number, fill: number, alpha: number): Phaser.GameObjects.Rectangle =>
      this.scene.add.rectangle(left, y, width, h, fill, alpha).setOrigin(0, 0.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.particles);
    const parts = [add(height + 2, hex(color), 0.55), add(height, hex(color), 0.9), add(Math.max(1, Math.round(height / 3)), 0xffffff, 1)];
    this.scene.tweens.add({ targets: parts, alpha: 0, scaleY: 0.3, duration: 180 + fraction * 120, ease: 'Quad.easeOut', onComplete: () => parts.forEach((p) => p.destroy()) });
    this.zap.explode(4 + Math.round(fraction * 8), x1, y);
  }

  private flash(x: number, y: number, tint: number, scale: number): void {
    const glow = this.scene.add.image(x, y, TEX.glow).setTint(tint).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.particles).setScale(scale * 0.4);
    this.scene.tweens.add({ targets: glow, scale, alpha: 0, duration: 350, ease: 'Quad.easeOut', onComplete: () => glow.destroy() });
  }
}
