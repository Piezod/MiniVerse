/**
 * Procedural, original pixel art for actors, items, FX and UI (world-independent).
 * Frame layouts are documented in animations.ts; AI-generated sheets must follow them.
 */
import { addOutline, bayer, type Ctx, fillCircle, hardenAlpha, px } from '../../../core/art/pixel';
import { PALETTE as P } from './palette';

// ---------------------------------------------------------------- Hero (32x32, 20 frames)

type Arm = 'down' | 'fwd' | 'back' | 'up' | 'out';
type Eyes = 'open' | 'closed' | 'wince' | 'x';

interface HeroPose {
  bob?: number;
  front?: [number, number];
  back?: [number, number];
  arm?: Arm;
  eyes?: Eyes;
  lean?: number;
  /** Scarf tail points relative to the neck, drawn as 2x2 segments. */
  scarf: Array<[number, number]>;
}

function drawLeg(ctx: Ctx, x: number, lift: number, isFront: boolean): void {
  px(ctx, isFront ? P.pants : P.pantsDark, x, 25 - lift, 2, 3);
  px(ctx, P.boot, x, 28 - lift, 3, 2);
  px(ctx, isFront ? P.bootLight : P.boot, x + 1, 28 - lift, 2, 1);
  px(ctx, P.outline, x, 30 - lift, 3, 1);
}

function drawArm(ctx: Ctx, arm: Arm, b: number, isFront: boolean): void {
  const sleeve = isFront ? P.coat : P.coatDark;
  const hand = isFront ? P.skin : P.skinShade;
  const x = isFront ? 19 : 11;
  switch (arm) {
    case 'down':
      px(ctx, sleeve, x, 19 + b, 2, 4);
      px(ctx, hand, x, 23 + b, 2, 1);
      break;
    case 'fwd':
      px(ctx, sleeve, x + 1, 19 + b, 2, 3);
      px(ctx, hand, x + 2, 22 + b, 2, 1);
      break;
    case 'back':
      px(ctx, sleeve, x - 1, 19 + b, 2, 3);
      px(ctx, hand, x - 2, 22 + b, 2, 1);
      break;
    case 'up':
      px(ctx, sleeve, x, 14 + b, 2, 5);
      px(ctx, hand, x, 12 + b, 2, 2);
      break;
    case 'out':
      px(ctx, sleeve, isFront ? x + 1 : x - 3, 18 + b, 4, 2);
      px(ctx, hand, isFront ? x + 5 : x - 5, 18 + b, 2, 2);
      break;
  }
}

const OPPOSITE: Record<Arm, Arm> = { down: 'down', fwd: 'back', back: 'fwd', up: 'up', out: 'out' };

function drawHero(ctx: Ctx, pose: HeroPose): void {
  const b = pose.bob ?? 0;
  const arm = pose.arm ?? 'down';
  const [fdx, flift] = pose.front ?? [0, 0];
  const [bdx, blift] = pose.back ?? [0, 0];
  const lx = pose.lean ?? 0;

  // Scarf tail (behind everything).
  pose.scarf.forEach(([dx, dy], i) => {
    px(ctx, i % 2 === 0 ? P.scarf : P.scarfDark, 11 + dx + lx, 18 + b + dy, 2, 2);
  });

  drawLeg(ctx, 13 + bdx, blift, false);
  drawArm(ctx, OPPOSITE[arm], b, false);

  // Coat.
  px(ctx, P.coat, 12 + lx, 18 + b, 8, 7);
  px(ctx, P.coatDark, 12 + lx, 18 + b, 1, 7);
  px(ctx, P.coatDark, 12 + lx, 24 + b, 8, 1);
  px(ctx, P.coatLight, 19 + lx, 19 + b, 1, 4);
  px(ctx, P.pants, 12 + lx, 23 + b, 8, 1);
  px(ctx, P.gold, 16 + lx, 23 + b, 1, 1);

  drawLeg(ctx, 17 + fdx, flift, true);

  // Head.
  const hx = lx;
  px(ctx, P.skin, 13 + hx, 11 + b, 7, 6);
  px(ctx, P.skinShade, 13 + hx, 16 + b, 7, 1);
  px(ctx, P.hair, 12 + hx, 11 + b, 2, 5);
  px(ctx, P.hair, 14 + hx, 12 + b, 2, 1);
  px(ctx, P.cap, 12 + hx, 8 + b, 9, 4);
  px(ctx, P.capLight, 14 + hx, 8 + b, 5, 1);
  px(ctx, P.capDark, 12 + hx, 11 + b, 7, 1);
  px(ctx, P.capDark, 19 + hx, 11 + b, 3, 1);
  px(ctx, P.capLight, 13 + hx, 7 + b, 4, 1);

  const ey = 13 + b;
  switch (pose.eyes ?? 'open') {
    case 'open':
      px(ctx, P.outline, 17 + hx, ey, 1, 2);
      px(ctx, P.outline, 19 + hx, ey, 1, 2);
      break;
    case 'closed':
      px(ctx, P.outline, 16 + hx, ey + 1, 2, 1);
      px(ctx, P.outline, 19 + hx, ey + 1, 1, 1);
      break;
    case 'wince':
      px(ctx, P.outline, 16 + hx, ey, 1, 1);
      px(ctx, P.outline, 17 + hx, ey + 1, 1, 1);
      px(ctx, P.outline, 16 + hx, ey + 2, 1, 1);
      px(ctx, P.outline, 19 + hx, ey, 1, 3);
      break;
    case 'x':
      for (const ex of [16, 19]) {
        px(ctx, P.outline, ex + hx - 1, ey, 1, 1);
        px(ctx, P.outline, ex + hx + 1, ey, 1, 1);
        px(ctx, P.outline, ex + hx, ey + 1, 1, 1);
        px(ctx, P.outline, ex + hx - 1, ey + 2, 1, 1);
        px(ctx, P.outline, ex + hx + 1, ey + 2, 1, 1);
      }
      break;
  }
  px(ctx, P.blush, 16 + hx, 15 + b, 1, 1);
  px(ctx, P.blush, 20 + hx, 15 + b, 1, 1);

  // Scarf wrap and knot.
  px(ctx, P.scarf, 12 + lx, 17 + b, 9, 2);
  px(ctx, P.scarfLight, 13 + lx, 17 + b, 6, 1);
  px(ctx, P.scarfDark, 12 + lx, 18 + b, 2, 1);

  drawArm(ctx, arm, b, true);
}

const IDLE_SCARF: Array<Array<[number, number]>> = [
  [[0, 0], [-1, 2], [-1, 4]],
  [[0, 0], [-1, 2], [-2, 4]],
  [[0, 0], [-2, 1], [-2, 3]],
  [[0, 0], [-1, 2], [-2, 4]],
];

const RUN: Array<{ front: [number, number]; back: [number, number]; bob: number; arm: Arm }> = [
  { front: [2, 0], back: [-2, 0], bob: 0, arm: 'back' },
  { front: [1, 1], back: [-1, 0], bob: 1, arm: 'down' },
  { front: [0, 2], back: [0, 0], bob: 1, arm: 'fwd' },
  { front: [-2, 0], back: [2, 0], bob: 0, arm: 'fwd' },
  { front: [-1, 0], back: [1, 1], bob: 1, arm: 'down' },
  { front: [0, 0], back: [0, 2], bob: 1, arm: 'back' },
];

export function drawHeroFrame(ctx: Ctx, frame: number, w: number, h: number): void {
  if (frame <= 3) {
    drawHero(ctx, { bob: [0, 0, 1, 1][frame], scarf: IDLE_SCARF[frame] });
  } else if (frame <= 9) {
    const i = frame - 4;
    const wave = i % 2;
    drawHero(ctx, { ...RUN[i], scarf: [[0, 0], [-2, wave], [-4, 1 - wave], [-6, wave]] });
  } else if (frame <= 11) {
    const w2 = frame - 10;
    drawHero(ctx, { front: [1, 2], back: [-1, 1], arm: 'up', scarf: [[0, 1], [-1, 3 + w2], [-2 - w2, 5]] });
  } else if (frame <= 13) {
    const w2 = frame - 12;
    drawHero(ctx, { front: [1, 0], back: [-1, 0], arm: 'out', scarf: [[0, -1], [-1, -3], [-2 + w2, -5]] });
  } else if (frame <= 15) {
    drawHero(ctx, { lean: -1, arm: 'out', eyes: 'wince', front: [1, 1], scarf: [[0, -1], [-2, -2], [-4, -2]] });
    if (frame === 15) {
      hardenAlpha(ctx, w, h);
      ctx.globalCompositeOperation = 'source-atop';
      px(ctx, P.white, 0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
    }
  } else {
    const i = frame - 16;
    drawHero(ctx, { arm: 'up', eyes: 'x', bob: Math.min(i, 2), scarf: [[0, -1], [-1, -3], [-2, -5]] });
    hardenAlpha(ctx, w, h);
    addOutline(ctx, w, h, P.outline);
    // Dissolve with an ordered-dither pattern instead of soft alpha.
    const image = ctx.getImageData(0, 0, w, h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) if (bayer(x, y) < i * 0.25) image.data[(y * w + x) * 4 + 3] = 0;
    ctx.putImageData(image, 0, 0);
    return;
  }
  hardenAlpha(ctx, w, h);
  addOutline(ctx, w, h, P.outline);
}

// ---------------------------------------------------------------- Mossbot walker (16x16, 4 frames)

export function drawWalkerFrame(ctx: Ctx, frame: number, w: number, h: number): void {
  if (frame >= 2) {
    const flat = frame - 2;
    px(ctx, P.metalDark, 2, 12 + flat, 12, 3 - flat);
    px(ctx, P.metal, 3, 11 + flat, 10, 2);
    px(ctx, P.moss, 4, 10 + flat, 7, 1);
    px(ctx, P.outline, 3, 12 + flat, 2, 1);
  } else {
    const s = frame;
    for (const [x, d] of [[3, s], [7, -s], [11, s]]) px(ctx, P.outline, x + d, 13, 2, 2);
    px(ctx, P.metalDark, 2, 8, 12, 5);
    px(ctx, P.metal, 3, 6, 10, 6);
    px(ctx, P.metalLight, 9, 7, 3, 2);
    px(ctx, P.metalDark, 3, 11, 10, 1);
    // Moss cap with a sprout that sways.
    px(ctx, P.moss, 4, 5, 8, 2);
    px(ctx, P.mossLight, 6, 5, 3, 1);
    px(ctx, P.moss, 3, 6, 2, 1);
    px(ctx, P.moss, 10 + s, 3, 1, 2);
    px(ctx, P.mossLight, 9 + s * 2, 2, 2, 1);
    // Glowing eye (faces left).
    px(ctx, P.glowDark, 2, 8, 3, 3);
    px(ctx, P.glow, 2, 9, 2, 1);
    px(ctx, P.white, 2, 9, 1, 1);
  }
  hardenAlpha(ctx, w, h);
  addOutline(ctx, w, h, P.outline);
}

// ---------------------------------------------------------------- Star shard (16x16, 4 frames)

export function drawStarFrame(ctx: Ctx, frame: number, w: number, h: number): void {
  const scaleX = [1, 0.62, 0.22, 0.62][frame] ?? 1;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 6.5 : 2.8;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push([7.5 + Math.cos(a) * r * scaleX, 7.5 + Math.sin(a) * r]);
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!inside(pts, x + 0.5, y + 0.5)) continue;
      const shade = x + y < 13 ? P.goldLight : x + y > 17 ? P.goldDark : P.gold;
      px(ctx, frame === 2 ? P.goldLight : shade, x, y);
    }
  }
  addOutline(ctx, w, h, P.outline);
}

function inside(poly: Array<[number, number]>, x: number, y: number): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

// ---------------------------------------------------------------- Crystal lantern checkpoint (16x32, 2 frames)

export function drawCheckpointFrame(ctx: Ctx, frame: number, w: number, h: number): void {
  const lit = frame === 1;
  px(ctx, P.stoneDark, 3, 28, 10, 4);
  px(ctx, P.stone, 4, 27, 8, 2);
  px(ctx, P.stoneLight, 5, 27, 4, 1);
  px(ctx, P.stoneDark, 6, 16, 4, 11);
  px(ctx, P.stone, 7, 16, 2, 11);
  px(ctx, P.stone, 4, 14, 8, 2);
  // Crystal.
  const body = lit ? P.glow : P.metalDark;
  const light = lit ? P.white : P.metal;
  for (let y = 0; y < 10; y++) {
    const half = y < 5 ? Math.floor(y / 1.4) + 1 : Math.floor((10 - y) / 1.4) + 1;
    px(ctx, body, 8 - half, 3 + y, half * 2, 1);
  }
  px(ctx, light, 7, 5, 1, 5);
  if (lit) px(ctx, P.glowDark, 9, 8, 1, 4);
  hardenAlpha(ctx, w, h);
  addOutline(ctx, w, h, P.outline);
}

// ---------------------------------------------------------------- Rune portal (32x32, 4 frames)

export function drawPortalFrame(ctx: Ctx, frame: number, w: number, h: number): void {
  const cx = 15.5;
  const cy = 17;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x - cx) / 10;
      const dy = (y - cy) / 13;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 1 || y > 28) continue;
      const angle = Math.atan2(dy, dx) + d * 5 - (frame * Math.PI) / 2;
      const swirl = (Math.sin(angle * 2) + 1) / 2;
      const color = swirl * (1 - d) > 0.35 ? P.glow : swirl > bayer(x, y) ? P.voidLight : P.void;
      px(ctx, color, x, y);
    }
  }
  // Stone arch.
  for (let a = Math.PI; a <= Math.PI * 2 + 0.01; a += 0.05) {
    const x = Math.round(cx + Math.cos(a) * 12);
    const y = Math.round(cy + Math.sin(a) * 15);
    px(ctx, P.stone, x - 1, y - 1, 3, 3);
    px(ctx, P.stoneLight, x, y - 1, 1, 1);
  }
  px(ctx, P.stoneDark, 2, 17, 4, 12);
  px(ctx, P.stoneDark, 26, 17, 4, 12);
  px(ctx, P.stone, 3, 17, 2, 12);
  px(ctx, P.stone, 27, 17, 2, 12);
  px(ctx, P.stoneDark, 1, 29, 30, 3);
  px(ctx, P.stone, 2, 29, 28, 1);
  px(ctx, P.glow, 15, 2, 2, 2);
  hardenAlpha(ctx, w, h);
  addOutline(ctx, w, h, P.outline);
}

// ---------------------------------------------------------------- FX particles (8x8, white, tinted at runtime)

/** 0 pixel | 1 square 2x2 | 2 sparkle | 3 dust puff | 4 ring */
export function drawFxFrame(ctx: Ctx, frame: number): void {
  const c = '#ffffff';
  switch (frame) {
    case 0:
      px(ctx, c, 3, 3, 1, 1);
      break;
    case 1:
      px(ctx, c, 3, 3, 2, 2);
      break;
    case 2:
      px(ctx, c, 3, 1, 1, 5);
      px(ctx, c, 1, 3, 5, 1);
      break;
    case 3:
      fillCircle(ctx, 3.5, 3.5, 2, c);
      break;
    case 4:
      fillCircle(ctx, 3.5, 3.5, 3, c);
      ctx.clearRect(2, 2, 3, 3);
      break;
  }
}

/** Soft radial light used with additive blending. */
export function drawGlow(ctx: Ctx, w: number, h: number): void {
  const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,0.9)');
  gradient.addColorStop(0.4, 'rgba(255,255,255,0.35)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
}

// ---------------------------------------------------------------- UI icons (8x8)

/** 0 star | 1 heart | 2 empty heart | 3 pause | 4 sound on | 5 sound off */
export function drawUiFrame(ctx: Ctx, frame: number, w: number, h: number): void {
  switch (frame) {
    case 0:
      px(ctx, P.gold, 3, 0, 1, 2);
      px(ctx, P.gold, 0, 2, 7, 2);
      px(ctx, P.gold, 1, 4, 5, 1);
      px(ctx, P.gold, 1, 5, 2, 1);
      px(ctx, P.gold, 4, 5, 2, 1);
      px(ctx, P.goldLight, 2, 2, 2, 1);
      break;
    case 1:
    case 2: {
      const fill = frame === 1 ? P.heart : P.metalDark;
      px(ctx, fill, 0, 1, 3, 3);
      px(ctx, fill, 4, 1, 3, 3);
      px(ctx, fill, 1, 4, 5, 1);
      px(ctx, fill, 2, 5, 3, 1);
      px(ctx, fill, 3, 6, 1, 1);
      px(ctx, fill, 3, 2, 1, 2);
      if (frame === 1) {
        px(ctx, P.white, 1, 1, 1, 1);
        px(ctx, P.heartDark, 4, 4, 2, 1);
      }
      break;
    }
    case 3:
      px(ctx, P.white, 1, 1, 2, 6);
      px(ctx, P.white, 5, 1, 2, 6);
      break;
    case 4:
    case 5:
      px(ctx, P.white, 0, 3, 2, 2);
      px(ctx, P.white, 2, 2, 1, 4);
      px(ctx, P.white, 3, 1, 1, 6);
      if (frame === 4) {
        px(ctx, P.white, 5, 2, 1, 1);
        px(ctx, P.white, 6, 3, 1, 2);
        px(ctx, P.white, 5, 5, 1, 1);
      } else {
        px(ctx, P.heart, 5, 2, 1, 1);
        px(ctx, P.heart, 6, 3, 1, 1);
        px(ctx, P.heart, 5, 4, 1, 1);
        px(ctx, P.heart, 6, 5, 1, 1);
      }
      break;
  }
  addOutline(ctx, w, h, P.outline);
}
