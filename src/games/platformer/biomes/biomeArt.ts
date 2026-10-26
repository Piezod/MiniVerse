/**
 * Procedural pixel-art generator shared by every biome. A biome = palette + style options; all
 * output follows the tileset/decoration/background layouts documented in level/tileset.ts and
 * DECO below, so any texture can be replaced by a real PNG with the same layout.
 */
import { addOutline, bayer, type Ctx, ditherGradient, fillCircle, fillEllipse, hardenAlpha, px, seeded } from '../../../core/art/pixel';
import { ONE_WAY_PIECE, TILE_SIZE as T, TILESET } from '../level/tileset';

export interface BiomePalette {
  outline: string;
  white: string;
  /** Vertical sky gradient stops (0 = top, 1 = bottom). */
  sky: Array<[number, string]>;
  halo: string;
  star: string;
  moon: string;
  moonShade: string;
  peak: string;
  mountain: string;
  mountainLight: string;
  mist: string;
  hills: string;
  hillsLight: string;
  treesFar: string;
  treesFarLight: string;
  treesNear: string;
  treesNearLight: string;
  foreground: string;
  /** Top layer of the ground: grass, snow, ash crust... */
  surfaceLight: string;
  surface: string;
  surfaceDark: string;
  surfaceShadow: string;
  soilLight: string;
  soil: string;
  soilDark: string;
  soilDeep: string;
  rockLight: string;
  rock: string;
  rockDark: string;
  rockDeep: string;
  woodLight: string;
  wood: string;
  woodDark: string;
  rope: string;
  accent: string;
  accentLight: string;
  accent2: string;
  berry: string;
  glow: string;
  glowLight: string;
  stem: string;
  crystal: string;
  crystalDark: string;
  crystalAlt: string;
  vine: string;
}

export interface BiomeStyle {
  celestial: 'moon' | 'sun' | 'none';
  stars: number;
  peaks: 'mountains' | 'cave' | 'mesas';
  /** Peaks above this y get a cap in `peak` colour (null = none). */
  snowLine: number | null;
  hillProps: 'pines' | 'rocks' | 'columns';
  far: 'conifers' | 'stalagmites' | 'colonnade';
  near: 'trunks' | 'pines' | 'pillars' | 'arches';
  surface: 'grass' | 'snow' | 'ash';
  blocks: 'brick' | 'ice' | 'basalt' | 'carved';
  foreground: 'blades' | 'drifts' | 'spikes';
}

type Draw = (ctx: Ctx, w: number, h: number) => void;
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- Tileset

function drawGround(ctx: Ctx, p: BiomePalette, s: BiomeStyle, ox: number, oy: number, mask: number, rand: () => number, variant = 0): void {
  const n = mask & 1;
  const e = mask & 2;
  const so = mask & 4;
  const w = mask & 8;

  px(ctx, p.soil, ox, oy, T, T);
  for (let i = 0; i < 10; i++) px(ctx, p.soilDark, ox + Math.floor(rand() * 15), oy + Math.floor(rand() * 15), rand() < 0.5 ? 2 : 1, 1);
  for (let i = 0; i < 5; i++) px(ctx, p.soilLight, ox + Math.floor(rand() * 15), oy + Math.floor(rand() * 15));
  if (variant === 1) {
    px(ctx, p.rockDark, ox + 4, oy + 9, 4, 3);
    px(ctx, p.rock, ox + 4, oy + 9, 3, 2);
    px(ctx, p.rockLight, ox + 5, oy + 9, 1, 1);
  } else if (variant === 2) {
    for (let k = 0; k < 7; k++) px(ctx, p.soilDeep, ox + 3 + k, oy + 4 + Math.floor(k / 2) + (k % 3 === 0 ? 1 : 0));
  } else if (variant === 3) {
    px(ctx, p.crystalDark, ox + 10, oy + 6, 2, 4);
    px(ctx, p.crystal, ox + 10, oy + 6, 1, 2);
  }
  if (s.surface === 'ash' && variant !== 0) {
    // Glowing magma veins inside volcanic rock.
    for (let k = 0; k < 5; k++) px(ctx, p.accent, ox + 2 + k * 2, oy + 12 - (k % 2), 2, 1);
  }

  if (!w) {
    px(ctx, p.soilDeep, ox, oy, 1, T);
    px(ctx, p.soilDark, ox + 1, oy, 1, T);
  }
  if (!e) {
    px(ctx, p.soilDeep, ox + 15, oy, 1, T);
    px(ctx, p.soilDark, ox + 14, oy, 1, T);
  }
  if (!so) {
    px(ctx, p.soilDark, ox, oy + 14, T, 1);
    px(ctx, p.soilDeep, ox, oy + 15, T, 1);
  }
  if (!n) {
    px(ctx, p.soilDeep, ox, oy + 4, T, 2);
    px(ctx, p.surface, ox, oy, T, 4);
    px(ctx, p.surfaceDark, ox, oy + 3, T, 1);
    px(ctx, p.surfaceLight, ox, oy, T, 1);
    for (let x = 0; x < T; x++) {
      if (rand() < 0.35) px(ctx, p.surfaceLight, ox + x, oy + 1);
      const d = rand();
      if (s.surface === 'snow') {
        // Icicles hanging from the snow cap.
        if (d < 0.5) px(ctx, p.surface, ox + x, oy + 4);
        if (d < 0.2) px(ctx, p.crystal, ox + x, oy + 5, 1, 2);
      } else if (s.surface === 'ash') {
        if (d < 0.4) px(ctx, p.surfaceDark, ox + x, oy + 4);
        if (d < 0.12) px(ctx, p.accent, ox + x, oy + 2);
      } else {
        if (d < 0.5) px(ctx, p.surfaceDark, ox + x, oy + 4);
        if (d < 0.18) px(ctx, p.surfaceShadow, ox + x, oy + 5);
      }
    }
    if (!w) {
      px(ctx, p.surface, ox, oy, 2, 6);
      px(ctx, p.surfaceDark, ox, oy + 6, 1, 2);
    }
    if (!e) {
      px(ctx, p.surface, ox + 14, oy, 2, 6);
      px(ctx, p.surfaceDark, ox + 15, oy + 6, 1, 2);
    }
  }
  if (!n && !w) ctx.clearRect(ox, oy, 1, 1);
  if (!n && !e) ctx.clearRect(ox + 15, oy, 1, 1);
  if (!so && !w) ctx.clearRect(ox, oy + 15, 1, 1);
  if (!so && !e) ctx.clearRect(ox + 15, oy + 15, 1, 1);
}

function drawBlock(ctx: Ctx, p: BiomePalette, s: BiomeStyle, ox: number, oy: number, mask: number, rand: () => number): void {
  const n = mask & 1;
  const e = mask & 2;
  const so = mask & 4;
  const w = mask & 8;

  px(ctx, p.rock, ox, oy, T, T);
  if (s.blocks === 'ice') {
    px(ctx, p.rockLight, ox, oy, T, 2);
    for (let k = 0; k < 6; k++) px(ctx, p.white, ox + 3 + k, oy + 10 - k, 1, 1);
    px(ctx, p.rockDark, ox, oy + 13, T, 2);
    px(ctx, p.rockLight, ox + 11, oy + 4, 2, 1);
  } else if (s.blocks === 'basalt') {
    px(ctx, p.rockDark, ox, oy + 7, T, 1);
    px(ctx, p.rockDark, ox + 5, oy, 1, 7);
    px(ctx, p.rockDark, ox + 10, oy + 8, 1, 8);
    px(ctx, p.accent, ox + 2, oy + 7, 2, 1);
    px(ctx, p.accent, ox + 10, oy + 11, 1, 2);
    px(ctx, p.rockLight, ox + 1, oy + 1, 3, 1);
    px(ctx, p.rockLight, ox + 7, oy + 9, 2, 1);
  } else {
    px(ctx, p.rockLight, ox, oy, T, 1);
    px(ctx, p.rockLight, ox, oy + 8, T, 1);
    px(ctx, p.rockDark, ox, oy + 6, T, 1);
    px(ctx, p.rockDark, ox, oy + 14, T, 1);
    px(ctx, p.rockDeep, ox, oy + 7, T, 1);
    px(ctx, p.rockDeep, ox, oy + 15, T, 1);
    px(ctx, p.rockDeep, ox + 7, oy, 1, 7);
    px(ctx, p.rockDeep, ox + 3, oy + 8, 1, 7);
    px(ctx, p.rockDeep, ox + 11, oy + 8, 1, 7);
    px(ctx, p.rockLight, ox + 8, oy + 1, 1, 5);
    px(ctx, p.rockLight, ox + 4, oy + 9, 1, 5);
    px(ctx, p.rockLight, ox + 12, oy + 9, 1, 5);
    if (s.blocks === 'carved') {
      // Ancient glyph.
      px(ctx, p.rockDeep, ox + 2, oy + 2, 3, 1);
      px(ctx, p.rockDeep, ox + 3, oy + 3, 1, 2);
      px(ctx, p.glow, ox + 10, oy + 10, 1, 3);
      px(ctx, p.glow, ox + 9, oy + 11, 3, 1);
    }
  }
  for (let i = 0; i < 4; i++) px(ctx, p.rockDark, ox + 1 + Math.floor(rand() * 13), oy + 1 + Math.floor(rand() * 13));

  if (!w) px(ctx, p.rockDeep, ox, oy, 1, T);
  if (!e) px(ctx, p.rockDeep, ox + 15, oy, 1, T);
  if (!so) px(ctx, p.outline, ox, oy + 15, T, 1);
  if (!n) {
    px(ctx, p.surface, ox, oy, T, 2);
    px(ctx, p.surfaceLight, ox + 1, oy, 6, 1);
    for (let x = 0; x < T; x++) {
      const d = rand();
      if (d < 0.45) px(ctx, p.surfaceDark, ox + x, oy + 2);
      if (d < 0.12) px(ctx, p.surfaceDark, ox + x, oy + 3, 1, 2);
    }
  }
  if (!n && !w) ctx.clearRect(ox, oy, 1, 1);
  if (!n && !e) ctx.clearRect(ox + 15, oy, 1, 1);
  if (!so && !w) ctx.clearRect(ox, oy + 15, 1, 1);
  if (!so && !e) ctx.clearRect(ox + 15, oy + 15, 1, 1);
}

function drawBridge(ctx: Ctx, p: BiomePalette, ox: number, oy: number, piece: number): void {
  const hasLeftPost = piece === ONE_WAY_PIECE.single || piece === ONE_WAY_PIECE.left;
  const hasRightPost = piece === ONE_WAY_PIECE.single || piece === ONE_WAY_PIECE.right;
  for (let x = 0; x < T; x++) px(ctx, p.rope, ox + x, oy + 6 + Math.round(Math.sin((x / T) * Math.PI) * 2));
  for (const [has, x] of [[hasLeftPost, 1], [hasRightPost, 12]] as const) {
    if (!has) continue;
    px(ctx, p.woodDark, ox + x, oy, 3, 11);
    px(ctx, p.wood, ox + x + 1, oy, 1, 10);
    px(ctx, p.rope, ox + x, oy + 6, 3, 1);
  }
  px(ctx, p.woodDark, ox, oy + 4, T, 1);
  px(ctx, p.wood, ox, oy + 1, T, 3);
  px(ctx, p.woodLight, ox, oy, T, 1);
  px(ctx, p.woodDark, ox + 5, oy + 1, 1, 3);
  px(ctx, p.woodDark, ox + 11, oy + 1, 1, 3);
  px(ctx, p.woodLight, ox + 2, oy + 2, 1, 1);
  px(ctx, p.woodLight, ox + 8, oy + 2, 1, 1);
}

export function tilesetDrawer(p: BiomePalette, s: BiomeStyle, seed: number): Draw {
  return (ctx) => {
    const rand = seeded(seed);
    for (let mask = 0; mask < 16; mask++) {
      drawGround(ctx, p, s, mask * T, 0, mask, rand);
      drawBlock(ctx, p, s, mask * T, T, mask, rand);
    }
    for (let piece = 0; piece < 4; piece++) drawBridge(ctx, p, piece * T, 2 * T, piece);
    for (let v = 0; v < TILESET.groundFillVariants; v++) drawGround(ctx, p, s, v * T, 3 * T, 15, rand, v);
  };
}

// ---------------------------------------------------------------- Decorations (16x16 frames)

/**
 * 0-1 tuft | 2-3 tall foreground tuft | 4-5 flowers | 6 bells | 7 pebbles | 8 boulder
 * 9 glowing mushrooms | 10 fern | 11 crystals | 12 hanging vine/icicle | 13 roots | 14 sign | 15 bush.
 * Top decorations stand on the bottom row; hanging ones start at row 0.
 */
export const DECO = {
  tuft: 0,
  tallTuft: 2,
  flowers: 4,
  bells: 6,
  pebbles: 7,
  boulder: 8,
  mushrooms: 9,
  fern: 10,
  crystals: 11,
  hanging: 12,
  roots: 13,
  sign: 14,
  bush: 15,
  emergency: 16,
  console: 17,
  capsule: 18,
  container: 19,
  alienTech: 20,
  wallPanel: 21,
} as const;
export const DECO_FRAME_COUNT = 22;

function blade(ctx: Ctx, x: number, height: number, lean: number, base: string, tip: string): void {
  for (let i = 0; i < height; i++) {
    const shift = Math.round((lean * i * i) / (height * height));
    px(ctx, i > height - 3 ? tip : base, x + shift, 15 - i);
  }
}

export function decorationDrawer(p: BiomePalette, s: BiomeStyle) {
  return (ctx: Ctx, frame: number, w: number, h: number): void => {
    const rand = seeded(100 + Math.floor(frame / 2) * 7);
    const sway = frame % 2 === 1 ? 1 : 0;
    switch (frame) {
      case 0:
      case 1:
        for (const x of [3, 5, 6, 8, 10, 11, 13]) blade(ctx, x, 3 + Math.floor(rand() * 5), sway + (x < 8 ? -1 : 1), p.surfaceDark, p.surfaceLight);
        return;
      case 2:
      case 3:
        for (let x = 1; x < 15; x += 2) blade(ctx, x, 7 + Math.floor(rand() * 9), sway * 2 - 1 + (rand() < 0.5 ? 0 : 1), p.surfaceShadow, p.surfaceDark);
        return;
      case 4:
      case 5:
        for (const [x, hgt] of [[4, 7], [8, 10], [12, 6]]) {
          blade(ctx, x, hgt, sway, p.surfaceDark, p.surfaceDark);
          const fx = x + sway;
          const fy = 15 - hgt;
          px(ctx, p.accent, fx - 1, fy, 3, 1);
          px(ctx, p.accent, fx, fy - 1, 1, 3);
          px(ctx, p.accentLight, fx, fy, 1, 1);
        }
        return;
      case 6:
        for (const [x, hgt] of [[5, 8], [10, 6]]) {
          blade(ctx, x, hgt, 1, p.surfaceDark, p.surfaceDark);
          px(ctx, p.accent2, x, 15 - hgt, 2, 2);
          px(ctx, p.accent2, x + 1, 17 - hgt, 2, 1);
          px(ctx, p.white, x, 15 - hgt, 1, 1);
        }
        return;
      case 7:
        fillEllipse(ctx, 5, 14, 2, 1, p.rock);
        fillEllipse(ctx, 10, 14, 3, 2, p.rockDark);
        px(ctx, p.rockLight, 9, 12, 2, 1);
        px(ctx, p.rockLight, 4, 13, 1, 1);
        break;
      case 8:
        fillEllipse(ctx, 8, 11, 6, 4, p.rockDark);
        fillEllipse(ctx, 7, 10, 5, 3, p.rock);
        px(ctx, p.rockLight, 5, 8, 4, 1);
        px(ctx, p.rockLight, 4, 9, 2, 1);
        px(ctx, p.surface, 6, 7, 4, 1);
        px(ctx, p.surfaceLight, 7, 7, 2, 1);
        px(ctx, p.rockDeep, 2, 14, 13, 2);
        break;
      case 9:
        for (const [x, hgt, r] of [[5, 6, 3], [11, 4, 2]]) {
          px(ctx, p.stem, x, 16 - hgt, 1, hgt);
          fillEllipse(ctx, x, 15 - hgt, r, 1, p.glow);
          px(ctx, p.glowLight, x - 1, 14 - hgt, 2, 1);
        }
        break;
      case 10:
        for (const dir of [-1, 1]) {
          for (let i = 0; i < 8; i++) {
            const x = 8 + dir * i;
            const y = 15 - Math.round(Math.sin((i / 8) * Math.PI) * 6) - Math.floor(i / 3);
            px(ctx, p.surface, x, y);
            if (i % 2 === 0) px(ctx, p.surfaceDark, x, y + 1);
          }
        }
        px(ctx, p.surfaceDark, 8, 9, 1, 7);
        return;
      case 11:
        for (const [x, hgt, color] of [[5, 7, p.crystalAlt], [9, 10, p.crystal], [12, 5, p.crystal]] as const) {
          for (let y = 0; y < hgt; y++) px(ctx, color, x - (y < hgt - 2 ? 1 : 0), 15 - y, y < hgt - 2 ? 3 : 1, 1);
          px(ctx, p.white, x - 1, 14 - Math.floor(hgt / 2), 1, 2);
          px(ctx, p.crystalDark, x + 1, 15 - Math.floor(hgt / 3), 1, 2);
        }
        break;
      case 12: {
        const len = 9 + Math.floor(rand() * 5);
        if (s.surface === 'snow') {
          for (const [x, l] of [[5, len - 4], [9, len], [12, len - 6]]) {
            for (let y = 0; y < l; y++) px(ctx, y < l - 3 ? p.crystal : p.white, x, y, y < l / 2 ? 2 : 1, 1);
          }
          return;
        }
        for (let y = 0; y < len; y++) {
          const x = 8 + Math.round(Math.sin(y * 0.6));
          px(ctx, p.vine, x, y);
          if (y % 3 === 1) px(ctx, p.surface, x + (y % 2 === 0 ? 1 : -1), y, 2, 1);
        }
        px(ctx, p.accent, 8, len, 1, 1);
        return;
      }
      case 13:
        for (const [x, len] of [[4, 6], [7, 9], [11, 5]]) {
          for (let y = 0; y < len; y++) px(ctx, p.soilDark, x + (y > len / 2 ? 1 : 0), y);
        }
        return;
      case 14:
        px(ctx, p.woodDark, 7, 8, 2, 8);
        px(ctx, p.wood, 2, 2, 12, 7);
        px(ctx, p.woodLight, 2, 2, 12, 1);
        px(ctx, p.woodDark, 2, 8, 12, 1);
        px(ctx, p.woodDark, 4, 4, 6, 1);
        px(ctx, p.woodDark, 4, 6, 8, 1);
        break;
      case 15:
        fillCircle(ctx, 5, 12, 4, p.surfaceDark);
        fillCircle(ctx, 10, 11, 5, p.surface);
        fillCircle(ctx, 9, 10, 2, p.surfaceLight);
        px(ctx, p.berry, 4, 11, 1, 1);
        px(ctx, p.berry, 12, 13, 1, 1);
        px(ctx, p.berry, 7, 13, 1, 1);
        px(ctx, p.surfaceShadow, 1, 15, 14, 1);
        break;
      case 16:
        px(ctx, p.rockDeep, 2, 2, 12, 14);
        px(ctx, '#fb6258', 3, 3, 10, 2);
        px(ctx, p.accent2, 7, 7, 2, 4);
        px(ctx, p.accent2, 7, 13, 2, 1);
        px(ctx, p.rockLight, 3, 15, 10, 1);
        break;
      case 17:
        px(ctx, p.rockDark, 2, 3, 12, 9);
        px(ctx, p.rockLight, 2, 3, 12, 1);
        px(ctx, p.rockDeep, 4, 5, 8, 4);
        px(ctx, p.accent, 5, 6, 5, 1);
        px(ctx, p.accent, 5, 8, 3, 1);
        px(ctx, p.accent2, 11, 10, 1, 1);
        px(ctx, p.rock, 6, 12, 4, 4);
        px(ctx, p.rockLight, 3, 15, 10, 1);
        break;
      case 18:
        px(ctx, p.rockLight, 3, 1, 9, 15);
        px(ctx, p.rockDark, 4, 2, 7, 13);
        px(ctx, p.rockDeep, 5, 3, 5, 10);
        px(ctx, p.accent, 4, 3, 1, 8);
        px(ctx, p.rock, 5, 13, 6, 2);
        px(ctx, p.rockLight, 12, 7, 2, 9);
        px(ctx, '#fb6258', 7, 1, 2, 1);
        break;
      case 19:
        px(ctx, p.rockDark, 1, 5, 14, 11);
        px(ctx, p.rockLight, 1, 5, 14, 2);
        px(ctx, p.rock, 3, 8, 10, 6);
        px(ctx, p.rockDeep, 7, 8, 2, 6);
        for (let stripe = 0; stripe < 4; stripe++) px(ctx, stripe % 2 ? p.rockDeep : p.accent2, 2 + stripe * 3, 14, 3, 2);
        break;
      case 20:
        px(ctx, p.rockDeep, 2, 13, 12, 3);
        px(ctx, '#58d89c', 4, 9, 3, 5);
        px(ctx, '#a5f5bc', 5, 5, 1, 7);
        px(ctx, '#58d89c', 9, 6, 3, 8);
        px(ctx, '#a5f5bc', 10, 3, 1, 7);
        px(ctx, '#071c21', 6, 10, 4, 2);
        px(ctx, '#fb6258', 12, 14, 2, 1);
        break;
      case 21:
        px(ctx, p.rockDark, 1, 2, 14, 14);
        px(ctx, p.rockLight, 1, 2, 14, 1);
        px(ctx, p.rockDeep, 3, 5, 10, 7);
        for (let vent = 0; vent < 3; vent++) px(ctx, p.rock, 4, 6 + vent * 2, 6, 1);
        px(ctx, '#fb6258', 3, 14, 2, 1);
        px(ctx, p.accent, 11, 14, 2, 1);
        break;
    }
    hardenAlpha(ctx, w, h);
    addOutline(ctx, w, h, p.outline);
  };
}

// ---------------------------------------------------------------- Parallax layers (320x180, tile horizontally)

/** Periodic ridge from integer-frequency sines so the layer tiles seamlessly. */
function ridge(x: number, w: number, base: number, waves: Array<[number, number, number]>): number {
  return Math.round(waves.reduce((y, [amp, freq, phase]) => y + amp * Math.sin((x / w) * TAU * freq + phase), base));
}

function wrapped(width: number, x: number, draw: (x: number) => void): void {
  for (const dx of [-width, 0, width]) draw(x + dx);
}

function conifer(ctx: Ctx, cx: number, base: number, height: number, body: string, light: string): void {
  px(ctx, body, cx - 1, base - 4, 3, 4);
  for (let k = 0; k < height; k++) {
    const half = Math.floor(k * 0.28) + (k % 5 === 4 ? 0 : 1);
    px(ctx, body, cx - half, base - 4 - height + k, half * 2 + 1, 1);
    if (k % 5 !== 4) px(ctx, light, cx + half, base - 4 - height + k, 1, 1);
  }
}

function spike(ctx: Ctx, cx: number, baseY: number, height: number, width: number, body: string, light: string, down = false): void {
  for (let k = 0; k < height; k++) {
    const half = Math.max(0, Math.round(((height - k) / height) * width));
    const y = down ? baseY + k : baseY - k;
    px(ctx, body, cx - half, y, half * 2 + 1, 1);
    px(ctx, light, cx + half, y, 1, 1);
  }
}

function column(ctx: Ctx, cx: number, top: number, bottom: number, width: number, body: string, light: string, broken: boolean): void {
  px(ctx, body, cx - Math.floor(width / 2), top, width, bottom - top);
  px(ctx, light, cx + Math.ceil(width / 2) - 1, top, 1, bottom - top);
  px(ctx, body, cx - Math.floor(width / 2) - 2, bottom - 4, width + 4, 4);
  if (!broken) {
    px(ctx, body, cx - Math.floor(width / 2) - 2, top - 3, width + 4, 3);
  } else {
    for (let x = 0; x < width; x++) if ((x * 7) % 3 === 0) px(ctx, body, cx - Math.floor(width / 2) + x, top - 2 - (x % 3), 1, 3);
  }
}

export function skyDrawer(p: BiomePalette, s: BiomeStyle): Draw {
  return (ctx, w, h) => {
    ditherGradient(ctx, 0, 0, w, h, p.sky);
    const rand = seeded(5);
    for (let i = 0; i < s.stars; i++) {
      const x = Math.floor(rand() * w);
      const y = Math.floor(rand() * rand() * 110);
      if (rand() < 0.12) {
        px(ctx, p.star, x - 1, y, 3, 1);
        px(ctx, p.star, x, y - 1, 1, 3);
      } else {
        px(ctx, rand() < 0.5 ? p.star : p.peak, x, y);
      }
    }
    if (s.celestial === 'none') return;
    const isSun = s.celestial === 'sun';
    const [mx, my, r] = isSun ? [220, 92, 20] : [238, 46, 13];
    for (let y = -r * 2; y <= r * 2; y++) {
      for (let x = -r * 2; x <= r * 2; x++) {
        const d = Math.sqrt(x * x + y * y);
        if (d > r + 1 && d < r * 1.9 && bayer(mx + x, my + y) < (1 - (d - r) / (r * 0.9)) * 0.55) px(ctx, p.halo, mx + x, my + y);
      }
    }
    fillCircle(ctx, mx, my, r, p.moonShade);
    fillCircle(ctx, mx - (isSun ? 1 : 2), my - (isSun ? 1 : 2), r - 2, p.moon);
    if (!isSun) {
      px(ctx, p.moonShade, mx - 5, my - 4, 3, 2);
      px(ctx, p.moonShade, mx + 3, my + 2, 2, 2);
      px(ctx, p.moonShade, mx - 1, my + 5, 2, 1);
    }
  };
}

export function mountainsDrawer(p: BiomePalette, s: BiomeStyle): Draw {
  return (ctx, w, h) => {
    const flat = s.peaks === 'mesas';
    const top = (x: number): number => {
      const y = ridge(x, w, 96, [[14, 2, 0.5], [8, 5, 1.3], [3, 13, 0.2]]) + ((x * 7) % 3 === 0 ? 1 : 0);
      return flat ? Math.round(y / 10) * 10 : y;
    };
    for (let x = 0; x < w; x++) {
      const y0 = top(x);
      px(ctx, p.mountain, x, y0, 1, h - y0);
      if (top(x + 1) > y0 || (flat && top(x + 1) !== y0)) px(ctx, p.mountainLight, x, y0, 1, 3 + (x % 2));
      if (s.snowLine !== null) for (let y = y0; y < y0 + 4 && y < s.snowLine; y++) if (bayer(x, y) < 0.7) px(ctx, p.peak, x, y);
      for (let y = 140; y < h; y++) if (bayer(x, y) < (y - 140) / 40) px(ctx, p.mist, x, y);
    }
    if (s.peaks === 'cave') {
      // Rock ceiling with stalactites.
      for (let x = 0; x < w; x++) {
        const y1 = ridge(x, w, 22, [[10, 3, 1.1], [5, 8, 0.3]]);
        px(ctx, p.mountain, x, 0, 1, y1);
        if (x % 2 === 0) px(ctx, p.mountainLight, x, y1 - 1, 1, 1);
      }
      const rand = seeded(9);
      for (let x = 6; x < w; x += 10 + Math.floor(rand() * 16)) {
        const len = 10 + Math.floor(rand() * 26);
        wrapped(w, x, (cx) => spike(ctx, cx, ridge(cx, w, 22, [[10, 3, 1.1], [5, 8, 0.3]]) - 1, len, 3, p.mountain, p.mountainLight, true));
      }
    }
  };
}

export function mistDrawer(p: BiomePalette): Draw {
  return (ctx, w, h) => {
    for (let y = 100; y < Math.min(h, 165); y++) {
      for (let x = 0; x < w; x++) {
        const density = (1 - Math.abs(y - 132) / 32) * (0.6 + 0.4 * Math.sin((x / w) * TAU * 3 + y * 0.05));
        if (bayer(x, y) < density * 0.75) px(ctx, p.mist, x, y);
      }
    }
  };
}

export function hillsDrawer(p: BiomePalette, s: BiomeStyle): Draw {
  return (ctx, w, h) => {
    const top = (x: number): number => ridge(x, w, 132, [[8, 3, 2], [4, 7, 0.4]]);
    for (let x = 0; x < w; x++) {
      const y0 = top(x);
      px(ctx, p.hills, x, y0, 1, h - y0);
      if (top(x + 1) > y0 || top(x - 1) > y0) px(ctx, p.hillsLight, x, y0, 1, 1);
    }
    const rand = seeded(21);
    for (let x = 4; x < w; x += 12 + Math.floor(rand() * 14)) {
      const height = 12 + Math.floor(rand() * 14);
      const base = top(x) + 2;
      wrapped(w, x, (cx) => {
        if (s.hillProps === 'pines') {
          for (let k = 0; k < height; k++) {
            const half = Math.floor(k * 0.32) + (k % 4 === 3 ? 0 : 1);
            px(ctx, p.hills, cx - half, base - height + k, half * 2 + 1, 1);
            px(ctx, p.hillsLight, cx + half, base - height + k, 1, 1);
          }
        } else if (s.hillProps === 'rocks') {
          spike(ctx, cx, base, Math.floor(height * 0.8), 4, p.hills, p.hillsLight);
        } else {
          column(ctx, cx, base - height, base, 4, p.hills, p.hillsLight, rand() < 0.5);
        }
      });
    }
  };
}

export function farDrawer(p: BiomePalette, s: BiomeStyle): Draw {
  return (ctx, w, h) => {
    const ground = 152;
    px(ctx, p.treesFar, 0, ground, w, h - ground);
    const rand = seeded(33);
    for (let x = 6; x < w; x += 14 + Math.floor(rand() * 12)) {
      const height = 40 + Math.floor(rand() * 34);
      wrapped(w, x, (cx) => {
        if (s.far === 'conifers') {
          conifer(ctx, cx, ground + 2, height, p.treesFar, p.treesFarLight);
        } else if (s.far === 'stalagmites') {
          spike(ctx, cx, ground + 2, Math.floor(height * 0.8), 5, p.treesFar, p.treesFarLight);
          spike(ctx, cx + 7, 0, Math.floor(height * 0.5), 3, p.treesFar, p.treesFarLight, true);
        } else {
          column(ctx, cx, ground - height, ground + 2, 7, p.treesFar, p.treesFarLight, rand() < 0.4);
        }
      });
    }
  };
}

export function nearDrawer(p: BiomePalette, s: BiomeStyle): Draw {
  return (ctx, w, h) => {
    const rand = seeded(47);
    for (const tx of [42, 150, 262]) {
      const width = 10 + Math.floor(rand() * 5);
      wrapped(w, tx, (cx) => {
        if (s.near === 'pines') {
          conifer(ctx, cx, h + 4, 150, p.treesNear, p.treesNearLight);
          for (let k = 0; k < 150; k += 5) px(ctx, p.peak, cx - Math.floor(k * 0.28), h - 150 + k, 3, 1);
          return;
        }
        if (s.near === 'arches') {
          column(ctx, cx, 30, h, width, p.treesNear, p.treesNearLight, false);
          for (let a = 0; a <= 20; a++) {
            const t = a / 20;
            const ax = Math.round(cx + t * 60);
            const ay = Math.round(30 - Math.sin(t * Math.PI) * 22);
            if (t < 0.7) px(ctx, p.treesNear, ax - 2, ay - 4, 5, 6);
          }
          return;
        }
        px(ctx, p.treesNear, cx - Math.floor(width / 2), 0, width, h);
        px(ctx, p.treesNearLight, cx + Math.ceil(width / 2) - 1, 14, 1, h - 14);
        for (let r = 0; r < 6; r++) {
          px(ctx, p.treesNear, cx - Math.floor(width / 2) - r - 1, h - 6 + r, 2, 6 - r);
          px(ctx, p.treesNear, cx + Math.ceil(width / 2) + r - 1, h - 6 + r, 2, 6 - r);
        }
        px(ctx, p.treesNearLight, cx - 2, 60, 1, 5);
        px(ctx, p.treesNearLight, cx + 1, 110, 1, 4);
      });
    }
    if (s.near === 'trunks') {
      // Canopy framing the top of the screen.
      for (let x = 0; x < w; x += 9) {
        const r = 8 + Math.floor(rand() * 9);
        const y = -4 + Math.floor(rand() * 10);
        wrapped(w, x, (cx) => {
          fillCircle(ctx, cx, y, r, p.treesNear);
          px(ctx, p.treesNearLight, cx + r - 3, y + r - 3, 2, 1);
        });
        if (rand() < 0.4) {
          const len = 10 + Math.floor(rand() * 26);
          wrapped(w, x + 3, (cx) => {
            for (let k = 0; k < len; k++) px(ctx, p.treesNear, cx + Math.round(Math.sin(k * 0.3)), y + r + k - 2);
          });
        }
      }
    } else if (s.near === 'pillars') {
      for (let x = 0; x < w; x += 7) {
        const len = 6 + Math.floor(rand() * 22);
        wrapped(w, x, (cx) => spike(ctx, cx, 0, len, 3, p.treesNear, p.treesNearLight, true));
      }
    }
  };
}

export function foregroundDrawer(p: BiomePalette, s: BiomeStyle): Draw {
  return (ctx, w, h) => {
    const rand = seeded(61);
    for (let x = 10; x < w; x += 55 + Math.floor(rand() * 40)) {
      if (s.foreground === 'drifts') {
        const r = 10 + Math.floor(rand() * 10);
        wrapped(w, x, (cx) => fillEllipse(ctx, cx, h + 2, r * 2, r * 0.6, p.foreground));
        continue;
      }
      if (s.foreground === 'spikes') {
        for (let i = 0; i < 4; i++) {
          const height = 6 + Math.floor(rand() * 14);
          wrapped(w, x + i * 6, (cx) => spike(ctx, cx, h - 1, height, 3, p.foreground, p.foreground));
        }
        continue;
      }
      const blades = 6 + Math.floor(rand() * 6);
      for (let i = 0; i < blades; i++) {
        const bx = x + i * 2 + Math.floor(rand() * 2);
        const height = 6 + Math.floor(rand() * 14);
        const lean = rand() < 0.5 ? -2 : 2;
        wrapped(w, bx, (cx) => {
          for (let k = 0; k < height; k++) px(ctx, p.foreground, cx + Math.round((lean * k * k) / (height * height)), h - 1 - k, k < height / 2 ? 2 : 1, 1);
        });
      }
    }
  };
}
