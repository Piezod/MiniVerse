import type Phaser from 'phaser';
import { PALETTE } from '../assets/palette';

export const OBJECT_TEXTURE_PREFIX = 'platformer.obj.';
export const TILE = 16;

type Ctx = CanvasRenderingContext2D;

/** Creates a procedural pixel-art texture once; later calls (level restarts) reuse it. */
function ensure(scene: Phaser.Scene, key: string, width: number, height: number, draw: (ctx: Ctx) => void): string {
  const full = OBJECT_TEXTURE_PREFIX + key;
  if (scene.textures.exists(full)) return full;
  const texture = scene.textures.createCanvas(full, width, height);
  if (!texture) throw new Error(`Could not create texture ${full}`);
  const ctx = texture.getContext();
  ctx.imageSmoothingEnabled = false;
  draw(ctx);
  texture.refresh();
  return full;
}

const rect = (ctx: Ctx, color: string, x: number, y: number, w: number, h: number): void => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
};

/** Metal slab of `tiles` tiles, 8 px tall: light top edge, rivets, dark underside with thrusters. */
export function platformTexture(scene: Phaser.Scene, tiles: number): string {
  return ensure(scene, `platform.${tiles}`, tiles * TILE, 8, (ctx) => {
    const w = tiles * TILE;
    rect(ctx, PALETTE.outline, 0, 0, w, 8);
    rect(ctx, PALETTE.metal, 1, 1, w - 2, 5);
    rect(ctx, PALETTE.metalLight, 1, 1, w - 2, 2);
    rect(ctx, PALETTE.metalDark, 1, 6, w - 2, 1);
    for (let x = 4; x < w - 2; x += 8) rect(ctx, PALETTE.metalDark, x, 4, 2, 1);
    for (let x = 4; x < w - 2; x += 16) rect(ctx, PALETTE.glow, x, 7, 4, 1);
  });
}

/** Wall emitter for lasers (the beam itself is drawn separately). */
export function emitterTexture(scene: Phaser.Scene): string {
  return ensure(scene, 'emitter', TILE, TILE, (ctx) => {
    rect(ctx, PALETTE.outline, 2, 2, 12, 12);
    rect(ctx, PALETTE.metalDark, 3, 3, 10, 10);
    rect(ctx, PALETTE.metal, 3, 3, 10, 2);
    rect(ctx, PALETTE.outline, 5, 5, 6, 6);
    rect(ctx, PALETTE.heart, 6, 6, 4, 4);
    rect(ctx, PALETTE.white, 7, 7, 1, 1);
  });
}

export type ElectricFrame = 'off' | 'warning' | 'on' | 'on2';

/** One tile of an electrified floor plate, drawn in the bottom 6 px of the tile. */
export function electricTexture(scene: Phaser.Scene, frame: ElectricFrame): string {
  return ensure(scene, `electric.${frame}`, TILE, TILE, (ctx) => {
    rect(ctx, PALETTE.outline, 0, 10, TILE, 6);
    rect(ctx, PALETTE.metalDark, 0, 11, TILE, 4);
    rect(ctx, PALETTE.metal, 1, 11, TILE - 2, 1);
    const contact = frame === 'off' ? PALETTE.metalLight : frame === 'warning' ? PALETTE.goldLight : PALETTE.white;
    for (const x of [2, 7, 12]) rect(ctx, contact, x, 9, 2, 2);
    if (frame === 'warning') {
      rect(ctx, PALETTE.gold, 4, 8, 1, 2);
      rect(ctx, PALETTE.gold, 10, 7, 1, 3);
    }
    if (frame === 'on' || frame === 'on2') {
      const glow = PALETTE.glow;
      const arcs = frame === 'on' ? [[3, 4], [5, 6], [4, 8], [8, 3], [9, 5], [8, 7], [13, 5], [12, 7]] : [[2, 6], [4, 4], [3, 8], [9, 6], [10, 4], [9, 8], [12, 3], [13, 6]];
      for (const [x, y] of arcs) rect(ctx, glow, x, y, 1, 3);
      for (const x of [2, 7, 12]) rect(ctx, PALETTE.glowDark, x, 8, 2, 1);
    }
  });
}

export function switchTexture(scene: Phaser.Scene, on: boolean): string {
  return ensure(scene, `switch.${on ? 'on' : 'off'}`, TILE, TILE, (ctx) => {
    rect(ctx, PALETTE.outline, 1, 10, 14, 6);
    rect(ctx, PALETTE.metalDark, 2, 11, 12, 4);
    rect(ctx, PALETTE.metalLight, 2, 11, 12, 1);
    if (on) {
      rect(ctx, PALETTE.outline, 4, 9, 8, 3);
      rect(ctx, PALETTE.moss, 5, 10, 6, 1);
      rect(ctx, PALETTE.mossLight, 6, 10, 2, 1);
    } else {
      rect(ctx, PALETTE.outline, 4, 6, 8, 5);
      rect(ctx, PALETTE.heart, 5, 7, 6, 3);
      rect(ctx, PALETTE.scarfLight, 6, 7, 2, 1);
    }
  });
}

/** One-tile-wide door of `tiles` tiles: metal panels with hazard stripes on the edges. */
export function doorTexture(scene: Phaser.Scene, tiles: number): string {
  return ensure(scene, `door.${tiles}`, TILE, tiles * TILE, (ctx) => {
    const h = tiles * TILE;
    rect(ctx, PALETTE.outline, 3, 0, 10, h);
    rect(ctx, PALETTE.metal, 4, 0, 8, h);
    rect(ctx, PALETTE.metalLight, 4, 0, 2, h);
    rect(ctx, PALETTE.metalDark, 10, 0, 2, h);
    for (let y = 4; y < h - 2; y += 16) {
      rect(ctx, PALETTE.outline, 4, y, 8, 1);
      rect(ctx, PALETTE.outline, 4, y + 7, 8, 1);
      rect(ctx, PALETTE.gold, 6, y + 2, 4, 3);
    }
    for (let y = 0; y < h; y += 4) rect(ctx, y % 8 === 0 ? PALETTE.gold : PALETTE.outline, 3, y, 1, 4);
  });
}

/** Removes every object texture (called when the minigame unloads). */
export function removeObjectTextures(game: Phaser.Game): void {
  for (const key of game.textures.getTextureKeys()) if (key.startsWith(OBJECT_TEXTURE_PREFIX)) game.textures.remove(key);
}
