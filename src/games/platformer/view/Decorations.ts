import Phaser from 'phaser';
import { hash2, seeded } from '../../../core/art/pixel';
import { TEX } from '../assets/manifest';
import type { ParsedLevel, TilePoint } from '../level/LevelParser';
import { TILE_SIZE } from '../level/tileset';
import type { DecorationDef, BiomeTheme } from '../biomes/BiomeTheme';
import { DEPTH } from './ParallaxBackground';

function pick(defs: DecorationDef[], roll: number): DecorationDef | undefined {
  const total = defs.reduce((sum, d) => sum + d.weight, 0);
  let acc = roll * total;
  return defs.find((d) => (acc -= d.weight) < 0) ?? defs[defs.length - 1];
}

/** Scatters purely visual props (grass, flowers, rocks, vines...) over the level, deterministically. */
export function placeDecorations(scene: Phaser.Scene, level: ParsedLevel, world: BiomeTheme, reserved: readonly TilePoint[]): void {
  const blocked = new Set(reserved.map((p) => `${p.col},${p.row}`));
  const { terrain } = level;
  const top = world.decorationTypes.filter((d) => d.placement === 'top');
  const bottom = world.decorationTypes.filter((d) => d.placement === 'bottom');

  for (let row = 0; row < level.height; row++) {
    for (let col = 0; col < level.width; col++) {
      const kind = terrain[row][col];
      if (!kind) continue;
      const rand = seeded(hash2(col, row));
      const x = col * TILE_SIZE + TILE_SIZE / 2;

      const openAbove = row > 0 && !terrain[row - 1][col];
      if (openAbove && kind !== 'oneway' && !blocked.has(`${col},${row - 1}`) && rand() < world.decorationDensity.top) {
        const def = pick(top.filter((d) => d.on.includes(kind)), rand());
        if (def) addDecoration(scene, world, def, x + Math.round((rand() - 0.5) * 6), row * TILE_SIZE, rand);
      }

      const openBelow = row < level.height - 1 && !terrain[row + 1][col];
      if (openBelow && rand() < world.decorationDensity.bottom) {
        const def = pick(bottom.filter((d) => d.on.includes(kind)), rand());
        const y = (row + 1) * TILE_SIZE - (kind === 'oneway' ? 11 : 0);
        if (def) addDecoration(scene, world, def, x, y, rand);
      }
    }
  }
}

function addDecoration(scene: Phaser.Scene, world: BiomeTheme, def: DecorationDef, x: number, y: number, rand: () => number): void {
  const sprite = scene.add
    .sprite(x, y, world.decorations, def.frame)
    .setOrigin(0.5, def.placement === 'top' ? 1 : 0)
    .setFlipX(rand() < 0.5)
    .setDepth(def.foreground ? DEPTH.decorFront : DEPTH.decorBack);
  if (def.anim) sprite.play({ key: def.anim, startFrame: Math.floor(rand() * 2), delay: Math.floor(rand() * 600) });
  if (def.glow !== undefined) {
    const glow = scene.add
      .image(x, y - 6, TEX.glow)
      .setTint(def.glow)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.35)
      .setDepth(DEPTH.decorBack);
    scene.tweens.add({ targets: glow, alpha: 0.6, duration: 1400 + rand() * 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
}
