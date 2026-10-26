import { hash2 } from '../../../core/art/pixel';

export const TILE_SIZE = 16;

export type TerrainKind = 'ground' | 'stone' | 'oneway';
export type Terrain = TerrainKind | null;

/**
 * Tileset layout shared by every world (16 columns x 4 rows of 16px tiles, 256x64 px):
 *   row 0 (0-15):  ground autotile, index = neighbour mask (N=1, E=2, S=4, W=8)
 *   row 1 (16-31): stone block autotile, same mask
 *   row 2 (32-35): one-way platform: single, left end, middle, right end
 *   row 3 (48-51): fully surrounded ground variants (to break repetition)
 */
export const TILESET = {
  width: 256,
  height: 64,
  ground: 0,
  stone: 16,
  oneWay: 32,
  groundFill: 48,
  groundFillVariants: 4,
} as const;

export const ONE_WAY_PIECE = { single: 0, left: 1, middle: 2, right: 3 } as const;

export function isSolidTile(index: number): boolean {
  return (index >= TILESET.ground && index < TILESET.oneWay) || (index >= TILESET.groundFill && index < TILESET.groundFill + 16);
}

export function isOneWayTile(index: number): boolean {
  return index >= TILESET.oneWay && index < TILESET.oneWay + 4;
}

/** Converts a terrain grid into tileset indices, picking edges/corners from neighbours. */
export function autotile(terrain: Terrain[][]): number[][] {
  const rows = terrain.length;
  const cols = terrain[0]?.length ?? 0;
  // Outside the map counts as the same material sideways and below, and as air above.
  const same = (r: number, c: number, kind: TerrainKind): boolean => {
    if (r < 0) return false;
    if (r >= rows || c < 0 || c >= cols) return true;
    return terrain[r][c] === kind;
  };

  return terrain.map((row, r) =>
    row.map((kind, c) => {
      if (!kind) return -1;
      if (kind === 'oneway') {
        const left = c > 0 && row[c - 1] === 'oneway';
        const right = c < cols - 1 && row[c + 1] === 'oneway';
        const piece = left && right ? 'middle' : left ? 'right' : right ? 'left' : 'single';
        return TILESET.oneWay + ONE_WAY_PIECE[piece];
      }
      const mask =
        (same(r - 1, c, kind) ? 1 : 0) | (same(r, c + 1, kind) ? 2 : 0) | (same(r + 1, c, kind) ? 4 : 0) | (same(r, c - 1, kind) ? 8 : 0);
      if (kind === 'stone') return TILESET.stone + mask;
      if (mask === 15) return TILESET.groundFill + (hash2(r, c) % TILESET.groundFillVariants);
      return TILESET.ground + mask;
    }),
  );
}
