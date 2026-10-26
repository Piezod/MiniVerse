import type { BiomeTheme } from './BiomeTheme';
import { FOREST } from './definitions/forest';
import { ICE } from './definitions/ice';
import { RUINS } from './definitions/ruins';
import { VOLCANO } from './definitions/volcano';

/** Biomes available to level files ("biome": "<id>"). Add new definitions here. */
export const BIOMES: Readonly<Record<string, BiomeTheme>> = Object.fromEntries(
  [FOREST, ICE, VOLCANO, RUINS].map((biome) => [biome.id, biome]),
);

export function getBiome(id: string): BiomeTheme {
  const biome = BIOMES[id];
  if (!biome) throw new Error(`Unknown biome "${id}"`);
  return biome;
}
