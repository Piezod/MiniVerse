/** Pixel-art drawing helpers for procedural textures. Everything is drawn crisp (no anti-aliasing). */
export type Ctx = CanvasRenderingContext2D;

export function px(ctx: Ctx, color: string, x: number, y: number, w = 1, h = 1): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

/** Deterministic PRNG so generated art is identical on every run. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

export function hash2(a: number, b: number): number {
  return (((a * 73856093) ^ (b * 19349663)) >>> 0) % 1000003;
}

export function fillCircle(ctx: Ctx, cx: number, cy: number, r: number, color: string): void {
  fillEllipse(ctx, cx, cy, r, r, color);
}

export function fillEllipse(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, color: string): void {
  ctx.fillStyle = color;
  for (let y = -ry; y <= ry; y++) {
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
    ctx.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2 + 1, 1);
  }
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Ordered-dither threshold in [0, 1) for a pixel. */
export function bayer(x: number, y: number): number {
  return (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Vertical gradient using only the given palette colors, blended with ordered dithering. */
export function ditherGradient(ctx: Ctx, x: number, y: number, w: number, h: number, stops: Array<[number, string]>): void {
  const image = ctx.getImageData(x, y, w, h);
  const rgb = stops.map(([, c]) => hexToRgb(c));
  for (let row = 0; row < h; row++) {
    const t = row / Math.max(1, h - 1);
    let i = 0;
    while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
    const [t0] = stops[i];
    const [t1] = stops[i + 1];
    const f = clamp01((t - t0) / Math.max(0.0001, t1 - t0));
    for (let col = 0; col < w; col++) {
      const c = f > bayer(col + x, row + y) ? rgb[i + 1] : rgb[i];
      const o = (row * w + col) * 4;
      image.data[o] = c[0];
      image.data[o + 1] = c[1];
      image.data[o + 2] = c[2];
      image.data[o + 3] = 255;
    }
  }
  ctx.putImageData(image, x, y);
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/** Snaps alpha to fully opaque/transparent so shapes keep hard pixel edges. */
export function hardenAlpha(ctx: Ctx, w: number, h: number): void {
  const image = ctx.getImageData(0, 0, w, h);
  for (let i = 3; i < image.data.length; i += 4) image.data[i] = image.data[i] >= 128 ? 255 : 0;
  ctx.putImageData(image, 0, 0);
}

/** Adds a 1px outline around every opaque pixel (4-neighbourhood). */
export function addOutline(ctx: Ctx, w: number, h: number, color: string): void {
  const image = ctx.getImageData(0, 0, w, h);
  const d = image.data;
  const [r, g, b] = hexToRgb(color);
  const solid = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0;
  const marks: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (solid(x, y)) continue;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) marks.push((y * w + x) * 4);
    }
  }
  for (const o of marks) {
    d[o] = r;
    d[o + 1] = g;
    d[o + 2] = b;
    d[o + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
}
