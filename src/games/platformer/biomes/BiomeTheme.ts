import type { AnimationDef } from '../../../core/animation/AnimationRegistry';
import type { AssetDef } from '../../../core/assets/AssetManifest';
import type { TerrainKind } from '../level/tileset';

export interface ParallaxLayerDef {
  key: string;
  /** 0 = fixed to the screen, 1 = moves with the world. */
  scrollX: number;
  scrollY: number;
  alpha?: number;
  /** Drawn in front of the gameplay layer. */
  front?: boolean;
}

export interface DecorationDef {
  frame: number;
  /** Animation key; when set, the decoration plays it with a random start frame. */
  anim?: string;
  placement: 'top' | 'bottom';
  on: readonly TerrainKind[];
  weight: number;
  /** Drawn in front of the player for depth. */
  foreground?: boolean;
  /** Tint of a soft additive light around the decoration. */
  glow?: number;
}

export interface AmbientParticlesDef {
  frame: number;
  tints: number[];
  /** Milliseconds between emissions. */
  frequency: number;
  lifespan: [number, number];
  speedX: [number, number];
  speedY: [number, number];
  additive?: boolean;
}

export interface BiomeLighting {
  /** Camera vignette strength (WebGL only). */
  vignette: number;
  /** Full-screen colour wash over the scene, e.g. warm lava light or cold haze. */
  overlay?: { color: number; alpha: number; blend: 'add' | 'multiply' };
}

/**
 * Everything that defines the look of a biome. Levels reference biomes by id; the layout
 * (level JSON) and the ambience (biome) are fully independent.
 */
export interface BiomeTheme {
  /** `biome` for base themes, `biome/variant` for variants. */
  id: string;
  /** Biome this theme belongs to (equals id for base themes). */
  baseId: string;
  variant: string | null;
  /** Variants of a base theme by id (always empty on variants themselves). */
  variants: Readonly<Record<string, BiomeTheme>>;
  name: string;
  accentColor: number;
  backgroundColor: string;
  tileset: string;
  decorations: string;
  signFrame: number;
  assets: readonly AssetDef[];
  anims: readonly AnimationDef[];
  parallax: readonly ParallaxLayerDef[];
  decorationDensity: { top: number; bottom: number };
  decorationTypes: readonly DecorationDef[];
  ambient: readonly AmbientParticlesDef[];
  lighting: BiomeLighting;
  fx: { dust: number[] };
}
