import type { BiomeTheme } from './BiomeTheme';
import { FOREST } from './definitions/forest';
import { ICE } from './definitions/ice';
import { RUINS } from './definitions/ruins';
import { STATION } from './definitions/station';
import { VOLCANO } from './definitions/volcano';
import { ALIEN } from './definitions/alien';

const FAMILIES: readonly BiomeTheme[] = [FOREST, ICE, VOLCANO, RUINS, STATION, ALIEN];

/** Base biomes available to level files ("biome": "<id>"). Add new definitions to FAMILIES. */
export const BIOMES: Readonly<Record<string, BiomeTheme>> = Object.fromEntries(FAMILIES.map((biome) => [biome.id, biome]));

/** Every theme (bases and variants), for asset queueing and unloading. */
export const BIOME_THEMES: readonly BiomeTheme[] = FAMILIES.flatMap((biome) => [biome, ...Object.values(biome.variants)]);

/** Variant ids per biome, used to validate "variant" in level files. */
export const BIOME_VARIANTS: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
  FAMILIES.map((biome) => [biome.id, Object.keys(biome.variants)]),
);

/** Theme for a level: the base biome, or its variant when one is given. */
export function getBiome(id: string, variant?: string | null): BiomeTheme {
  const biome = BIOMES[id];
  if (!biome) throw new Error(`Unknown biome "${id}"`);
  if (!variant) return biome;
  const theme = biome.variants[variant];
  if (!theme) throw new Error(`Unknown variant "${variant}" of biome "${id}"`);
  return theme;
}
