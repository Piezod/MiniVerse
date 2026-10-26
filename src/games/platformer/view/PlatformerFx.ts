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

  private flash(x: number, y: number, tint: number, scale: number): void {
    const glow = this.scene.add.image(x, y, TEX.glow).setTint(tint).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.particles).setScale(scale * 0.4);
    this.scene.tweens.add({ targets: glow, scale, alpha: 0, duration: 350, ease: 'Quad.easeOut', onComplete: () => glow.destroy() });
  }
}
