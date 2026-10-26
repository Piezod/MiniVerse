import { hex } from '../assets/palette';
import { FX_FRAME, PROCEDURAL } from '../assets/manifest';
import type { TerrainKind } from '../level/tileset';
import { TILESET } from '../level/tileset';
import {
  type BiomePalette,
  type BiomeStyle,
  DECO,
  DECO_FRAME_COUNT,
  decorationDrawer,
  farDrawer,
  foregroundDrawer,
  hillsDrawer,
  mistDrawer,
  mountainsDrawer,
  nearDrawer,
  skyDrawer,
  tilesetDrawer,
} from './biomeArt';
import type { AmbientParticlesDef, BiomeLighting, BiomeTheme, DecorationDef } from './BiomeTheme';

type DecoType = keyof typeof DECO;
export type BiomePart = 'tiles' | 'decorations' | 'sky' | 'mountains' | 'mist' | 'hills' | 'far' | 'near' | 'foreground';

export interface BiomeDecoration {
  type: Exclude<DecoType, 'sign'>;
  weight: number;
  on?: TerrainKind[];
  foreground?: boolean;
  /** Colour (#rrggbb) of a soft light around the prop. */
  glow?: string;
}

export interface BiomeAmbient {
  particle: keyof typeof FX_FRAME;
  colors: string[];
  frequency: number;
  lifespan: [number, number];
  speedX: [number, number];
  speedY: [number, number];
  additive?: boolean;
}

/**
 * Overrides of a biome variant (e.g. station/hangar). Everything omitted is inherited from the base
 * biome. Palette, style and lighting are merged field by field; lists (decorations, ambient, dust)
 * replace the base list.
 */
export interface BiomeVariantDef {
  name?: string;
  accentColor?: string;
  palette?: Partial<BiomePalette>;
  style?: Partial<BiomeStyle>;
  decorations?: BiomeDecoration[];
  decorationDensity?: { top: number; bottom: number };
  ambient?: BiomeAmbient[];
  lighting?: Partial<BiomeLighting>;
  dust?: string[];
  /** Real PNG files for this variant only; a part with a file always gets its own texture key. */
  files?: Partial<Record<BiomePart, string>>;
  seed?: number;
}

/** Declarative description of a biome; createBiome turns it into textures, layers and effects. */
export interface BiomeDefinition {
  id: string;
  name: string;
  accentColor: string;
  palette: BiomePalette;
  style: BiomeStyle;
  decorations: BiomeDecoration[];
  decorationDensity?: { top: number; bottom: number };
  ambient: BiomeAmbient[];
  lighting: BiomeLighting;
  dust: string[];
  /** Real image files (relative to /public) replacing generated textures, e.g. { tiles: 'assets/...png' }. */
  files?: Partial<Record<BiomePart, string>>;
  seed?: number;
  /** Visual variants of this biome, keyed by variant id (lowercase, digits and hyphens). */
  variants?: Record<string, BiomeVariantDef>;
}

const ANIMATED: Partial<Record<DecoType, true>> = { tuft: true, tallTuft: true, flowers: true };
const DEFAULT_ON: Record<string, TerrainKind[]> = {
  hanging: ['ground', 'stone', 'oneway'],
  roots: ['ground'],
  pebbles: ['ground', 'stone'],
  crystals: ['ground', 'stone'],
};
const PARTS: readonly BiomePart[] = ['tiles', 'decorations', 'sky', 'mountains', 'mist', 'hills', 'far', 'near', 'foreground'];
export const VARIANT_ID = /^[a-z][a-z0-9-]*$/;

/** Base definition + variant overrides (pure). */
export function resolveVariant(base: BiomeDefinition, variant: BiomeVariantDef): BiomeDefinition {
  return {
    ...base,
    name: variant.name ?? base.name,
    accentColor: variant.accentColor ?? base.accentColor,
    palette: { ...base.palette, ...variant.palette },
    style: { ...base.style, ...variant.style },
    decorations: variant.decorations ?? base.decorations,
    decorationDensity: variant.decorationDensity ?? base.decorationDensity,
    ambient: variant.ambient ?? base.ambient,
    lighting: { ...base.lighting, ...variant.lighting },
    dust: variant.dust ?? base.dust,
    files: variant.files,
    seed: variant.seed ?? base.seed,
    variants: undefined,
  };
}

/**
 * Parts of a variant that need their own texture. The rest reuses the base biome's textures, so
 * a variant that only changes lighting, particles or decorations costs no extra generation.
 */
export function ownedParts(base: BiomeDefinition, variant: BiomeVariantDef): ReadonlySet<BiomePart> {
  const resolved = resolveVariant(base, variant);
  const differs = (a: unknown, b: unknown): boolean => JSON.stringify(a) !== JSON.stringify(b);
  const palette = differs(base.palette, resolved.palette);
  const style = differs(base.style, resolved.style);
  const seed = differs(base.seed, resolved.seed);
  return new Set(
    PARTS.filter((part) => {
      if (variant.files?.[part]) return true;
      if (palette) return true;
      if (style && part !== 'mist') return true;
      return seed && part === 'tiles';
    }),
  );
}

export function createBiome(def: BiomeDefinition): BiomeTheme {
  const variants: Record<string, BiomeTheme> = {};
  for (const [variantId, variant] of Object.entries(def.variants ?? {})) {
    if (!VARIANT_ID.test(variantId)) throw new Error(`Biome "${def.id}": invalid variant id "${variantId}"`);
    variants[variantId] = buildTheme(def, resolveVariant(def, variant), variantId, ownedParts(def, variant));
  }
  return { ...buildTheme(def, def, null, null), variants };
}

/**
 * `source` is what the theme looks like; `base` the biome it belongs to. For a variant, parts not in
 * `owned` point to the base biome's texture keys and are generated from the base definition.
 */
function buildTheme(base: BiomeDefinition, source: BiomeDefinition, variantId: string | null, owned: ReadonlySet<BiomePart> | null): BiomeTheme {
  const isOwn = (part: BiomePart): boolean => owned === null || owned.has(part);
  const prefix = variantId ? `${base.id}.${variantId}` : base.id;
  const key = (part: BiomePart): string => `platformer.biome.${isOwn(part) ? prefix : base.id}.${part}`;
  const animKey = (type: string): string => `platformer.biome.${isOwn('decorations') ? prefix : base.id}.deco.${type}`;
  const origin = (part: BiomePart): BiomeDefinition => (isOwn(part) ? source : base);
  const image = (part: BiomePart, width: number, height: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) =>
    ({ kind: 'image', key: key(part), url: origin(part).files?.[part], width, height, credit: PROCEDURAL, drawPlaceholder: draw }) as const;
  const art = (part: BiomePart): { p: BiomePalette; s: BiomeStyle } => ({ p: origin(part).palette, s: origin(part).style });

  const decorationTypes: DecorationDef[] = source.decorations.map((d) => ({
    frame: DECO[d.type],
    anim: ANIMATED[d.type] ? animKey(d.type) : undefined,
    placement: d.type === 'hanging' || d.type === 'roots' ? 'bottom' : 'top',
    on: d.on ?? DEFAULT_ON[d.type] ?? ['ground'],
    weight: d.weight,
    foreground: d.foreground ?? d.type === 'tallTuft',
    glow: d.glow ? hex(d.glow) : undefined,
  }));

  const ambient: AmbientParticlesDef[] = source.ambient.map((a) => ({
    frame: FX_FRAME[a.particle],
    tints: a.colors.map(hex),
    frequency: a.frequency,
    lifespan: a.lifespan,
    speedX: a.speedX,
    speedY: a.speedY,
    additive: a.additive,
  }));

  const sky = art('sky');
  const mountains = art('mountains');
  const hills = art('hills');
  const far = art('far');
  const near = art('near');
  const foreground = art('foreground');
  const tiles = art('tiles');
  const decorations = art('decorations');

  return {
    id: variantId ? `${base.id}/${variantId}` : base.id,
    baseId: base.id,
    variant: variantId,
    variants: {},
    name: source.name,
    accentColor: hex(source.accentColor),
    backgroundColor: source.palette.sky[0][1],
    tileset: key('tiles'),
    decorations: key('decorations'),
    signFrame: DECO.sign,
    assets: [
      image('tiles', TILESET.width, TILESET.height, tilesetDrawer(tiles.p, tiles.s, origin('tiles').seed ?? 11)),
      {
        kind: 'spritesheet',
        key: key('decorations'),
        url: origin('decorations').files?.decorations,
        frameWidth: 16,
        frameHeight: 16,
        frameCount: DECO_FRAME_COUNT,
        credit: PROCEDURAL,
        drawPlaceholder: decorationDrawer(decorations.p, decorations.s),
      },
      image('sky', 320, 180, skyDrawer(sky.p, sky.s)),
      image('mountains', 320, 180, mountainsDrawer(mountains.p, mountains.s)),
      image('mist', 320, 180, mistDrawer(art('mist').p)),
      image('hills', 320, 180, hillsDrawer(hills.p, hills.s)),
      image('far', 320, 180, farDrawer(far.p, far.s)),
      image('near', 320, 180, nearDrawer(near.p, near.s)),
      image('foreground', 320, 180, foregroundDrawer(foreground.p, foreground.s)),
    ],
    anims: (['tuft', 'tallTuft', 'flowers'] as const).map((type) => ({
      key: animKey(type),
      texture: key('decorations'),
      frames: [DECO[type], DECO[type] + 1],
      frameRate: 2,
    })),
    parallax: [
      { key: key('sky'), scrollX: 0, scrollY: 0 },
      { key: key('mountains'), scrollX: 0.05, scrollY: 0.04 },
      { key: key('mist'), scrollX: 0.1, scrollY: 0.08, alpha: 0.35 },
      { key: key('hills'), scrollX: 0.18, scrollY: 0.12 },
      { key: key('far'), scrollX: 0.32, scrollY: 0.2 },
      { key: key('mist'), scrollX: 0.42, scrollY: 0.26, alpha: 0.22 },
      { key: key('near'), scrollX: 0.55, scrollY: 0.35 },
      { key: key('foreground'), scrollX: 1.25, scrollY: 1, front: true },
    ],
    decorationDensity: source.decorationDensity ?? { top: 0.6, bottom: 0.3 },
    decorationTypes,
    ambient,
    lighting: source.lighting,
    fx: { dust: source.dust.map(hex) },
  };
}
