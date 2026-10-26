import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../../../core/config';
import type { ParallaxLayerDef } from '../biomes/BiomeTheme';

export const DEPTH = {
  background: -100,
  terrain: 0,
  decorBack: 1,
  props: 3,
  enemies: 6,
  player: 10,
  particles: 12,
  decorFront: 14,
  foreground: 20,
} as const;

/** Screen-anchored tile sprites scrolled at fractions of the camera position. */
export class ParallaxBackground {
  private readonly layers: Array<{ sprite: Phaser.GameObjects.TileSprite; def: ParallaxLayerDef }>;

  constructor(
    scene: Phaser.Scene,
    defs: readonly ParallaxLayerDef[],
    private readonly maxScrollY: number,
  ) {
    this.layers = defs.map((def, i) => ({
      def,
      sprite: scene.add
        .tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, def.key)
        .setOrigin(0)
        .setScrollFactor(0)
        .setAlpha(def.alpha ?? 1)
        .setDepth(def.front ? DEPTH.foreground : DEPTH.background + i),
    }));
  }

  update(camera: Phaser.Cameras.Scene2D.Camera): void {
    for (const { sprite, def } of this.layers) {
      sprite.tilePositionX = Math.round(camera.scrollX * def.scrollX);
      // Anchored to the lowest camera position so layers never reveal a gap at the bottom.
      sprite.y = Math.round((this.maxScrollY - camera.scrollY) * def.scrollY);
    }
  }
}
