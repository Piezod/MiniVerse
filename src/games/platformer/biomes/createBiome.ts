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
type Part = 'tiles' | 'decorations' | 'sky' | 'mountains' | 'mist' | 'hills' | 'far' | 'near' | 'foreground';

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
  files?: Partial<Record<Part, string>>;
  seed?: number;
}

const ANIMATED: Partial<Record<DecoType, true>> = { tuft: true, tallTuft: true, flowers: true };
const DEFAULT_ON: Record<string, TerrainKind[]> = {
  hanging: ['ground', 'stone', 'oneway'],
  roots: ['ground'],
  pebbles: ['ground', 'stone'],
  crystals: ['ground', 'stone'],
};

export function createBiome(def: BiomeDefinition): BiomeTheme {
  const { palette: p, style: s } = def;
  const key = (part: string): string => `platformer.biome.${def.id}.${part}`;
  const animKey = (type: string): string => `platformer.biome.${def.id}.deco.${type}`;
  const image = (part: Part, width: number, height: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) =>
    ({ kind: 'image', key: key(part), url: def.files?.[part], width, height, credit: PROCEDURAL, drawPlaceholder: draw }) as const;

  const decorationTypes: DecorationDef[] = def.decorations.map((d) => ({
    frame: DECO[d.type],
    anim: ANIMATED[d.type] ? animKey(d.type) : undefined,
    placement: d.type === 'hanging' || d.type === 'roots' ? 'bottom' : 'top',
    on: d.on ?? DEFAULT_ON[d.type] ?? ['ground'],
    weight: d.weight,
    foreground: d.foreground ?? d.type === 'tallTuft',
    glow: d.glow ? hex(d.glow) : undefined,
  }));

  const ambient: AmbientParticlesDef[] = def.ambient.map((a) => ({
    frame: FX_FRAME[a.particle],
    tints: a.colors.map(hex),
    frequency: a.frequency,
    lifespan: a.lifespan,
    speedX: a.speedX,
    speedY: a.speedY,
    additive: a.additive,
  }));

  return {
    id: def.id,
    name: def.name,
    accentColor: hex(def.accentColor),
    backgroundColor: p.sky[0][1],
    tileset: key('tiles'),
    decorations: key('decorations'),
    signFrame: DECO.sign,
    assets: [
      image('tiles', TILESET.width, TILESET.height, tilesetDrawer(p, s, def.seed ?? 11)),
      {
        kind: 'spritesheet',
        key: key('decorations'),
        url: def.files?.decorations,
        frameWidth: 16,
        frameHeight: 16,
        frameCount: DECO_FRAME_COUNT,
        credit: PROCEDURAL,
        drawPlaceholder: decorationDrawer(p, s),
      },
      image('sky', 320, 180, skyDrawer(p, s)),
      image('mountains', 320, 180, mountainsDrawer(p, s)),
      image('mist', 320, 180, mistDrawer(p)),
      image('hills', 320, 180, hillsDrawer(p, s)),
      image('far', 320, 180, farDrawer(p, s)),
      image('near', 320, 180, nearDrawer(p, s)),
      image('foreground', 320, 180, foregroundDrawer(p, s)),
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
    decorationDensity: def.decorationDensity ?? { top: 0.6, bottom: 0.3 },
    decorationTypes,
    ambient,
    lighting: def.lighting,
    fx: { dust: def.dust.map(hex) },
  };
}
