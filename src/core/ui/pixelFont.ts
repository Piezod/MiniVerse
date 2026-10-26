import Phaser from 'phaser';

/** Original 3x5 pixel font with a baked 1px outline, rendered as a RetroFont for crisp text. */
export const PIXEL_FONT = 'core.pixel-font';
const OUTLINE = '#141327';
const CELL_W = 5;
const CELL_H = 7;
const PER_ROW = 16;

const GLYPHS: Record<string, string> = {
  ' ': '...|...|...|...|...',
  A: '.#.|#.#|###|#.#|#.#',
  B: '##.|#.#|##.|#.#|##.',
  C: '.##|#..|#..|#..|.##',
  D: '##.|#.#|#.#|#.#|##.',
  E: '###|#..|##.|#..|###',
  F: '###|#..|##.|#..|#..',
  G: '.##|#..|#.#|#.#|.##',
  H: '#.#|#.#|###|#.#|#.#',
  I: '###|.#.|.#.|.#.|###',
  J: '..#|..#|..#|#.#|.#.',
  K: '#.#|#.#|##.|#.#|#.#',
  L: '#..|#..|#..|#..|###',
  M: '#.#|###|###|#.#|#.#',
  N: '##.|#.#|#.#|#.#|#.#',
  O: '.#.|#.#|#.#|#.#|.#.',
  P: '##.|#.#|##.|#..|#..',
  Q: '.#.|#.#|#.#|##.|.##',
  R: '##.|#.#|##.|#.#|#.#',
  S: '.##|#..|.#.|..#|##.',
  T: '###|.#.|.#.|.#.|.#.',
  U: '#.#|#.#|#.#|#.#|###',
  V: '#.#|#.#|#.#|#.#|.#.',
  W: '#.#|#.#|###|###|#.#',
  X: '#.#|#.#|.#.|#.#|#.#',
  Y: '#.#|#.#|.#.|.#.|.#.',
  Z: '###|..#|.#.|#..|###',
  '0': '###|#.#|#.#|#.#|###',
  '1': '.#.|##.|.#.|.#.|###',
  '2': '##.|..#|.#.|#..|###',
  '3': '##.|..#|.#.|..#|##.',
  '4': '#.#|#.#|###|..#|..#',
  '5': '###|#..|##.|..#|##.',
  '6': '.##|#..|###|#.#|###',
  '7': '###|..#|.#.|.#.|.#.',
  '8': '###|#.#|###|#.#|###',
  '9': '###|#.#|###|..#|##.',
  '!': '.#.|.#.|.#.|...|.#.',
  '¡': '.#.|...|.#.|.#.|.#.',
  '?': '##.|..#|.#.|...|.#.',
  '¿': '.#.|...|.#.|#..|.##',
  '.': '...|...|...|...|.#.',
  ',': '...|...|...|.#.|#..',
  ':': '...|.#.|...|.#.|...',
  '-': '...|...|###|...|...',
  '+': '...|.#.|###|.#.|...',
  '/': '..#|..#|.#.|#..|#..',
  '<': '..#|.#.|#..|.#.|..#',
  '>': '#..|.#.|..#|.#.|#..',
  '^': '.#.|#.#|...|...|...',
  '(': '.#.|#..|#..|#..|.#.',
  ')': '.#.|..#|..#|..#|.#.',
  "'": '.#.|.#.|...|...|...',
};

export function ensurePixelFont(scene: Phaser.Scene): void {
  if (scene.cache.bitmapFont.exists(PIXEL_FONT)) return;
  const chars = Object.keys(GLYPHS).join('');
  const texture = scene.textures.createCanvas(PIXEL_FONT, PER_ROW * CELL_W, Math.ceil(chars.length / PER_ROW) * CELL_H);
  if (!texture) return;
  const ctx = texture.getContext();

  [...chars].forEach((ch, i) => {
    const ox = (i % PER_ROW) * CELL_W + 1;
    const oy = Math.floor(i / PER_ROW) * CELL_H + 1;
    const rows = GLYPHS[ch].split('|');
    for (const [color, grow] of [[OUTLINE, 1], ['#ffffff', 0]] as const) {
      ctx.fillStyle = color;
      rows.forEach((row, y) =>
        [...row].forEach((cell, x) => {
          if (cell === '#') ctx.fillRect(ox + x - grow, oy + y - grow, 1 + grow * 2, 1 + grow * 2);
        }),
      );
    }
  });
  texture.refresh();

  const entry = Phaser.GameObjects.RetroFont.Parse(scene, {
    image: PIXEL_FONT,
    width: CELL_W,
    height: CELL_H,
    chars,
    charsPerRow: PER_ROW,
    'offset.x': 0,
    'offset.y': 0,
    'spacing.x': 0,
    'spacing.y': 0,
    lineSpacing: 2,
  });
  // Typings declare BitmapFontData, but at runtime Parse returns the full cache entry.
  scene.cache.bitmapFont.add(PIXEL_FONT, entry);
}

/** Uppercases and strips accents (the font only has basic glyphs). */
export function toPixelText(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
}

export function pixelText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  color = 0xffffff,
  scale = 1,
): Phaser.GameObjects.BitmapText {
  ensurePixelFont(scene);
  return scene.add.bitmapText(x, y, PIXEL_FONT, toPixelText(text)).setLetterSpacing(-1).setTint(color).setScale(scale);
}
