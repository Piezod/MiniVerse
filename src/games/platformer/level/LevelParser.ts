import type { Terrain } from './tileset';

export interface TilePoint {
  col: number;
  row: number;
}

export interface SignText {
  keyboard: string;
  touch: string;
}

export interface LevelSection {
  name?: string;
  rows: readonly string[];
}

/**
 * Level file format (JSON). Sections are concatenated left to right; inside a section, rows are
 * aligned to the bottom of the level and short rows are padded with '.'.
 *   .  empty        #  ground                          X  block         =  one-way platform
 *   P  player       S  star                            E  enemy (walker by default)  K  checkpoint
 *   O  exit portal  1-9 sign (text in `signs`)          other letters: enemies declared in `enemies`
 */
export interface LevelData {
  id: string;
  name: string;
  /** Visual ambience id (see biomes/index.ts). */
  biome: string;
  /** Optional visual variant of the biome (biomes/index.ts BIOME_VARIANTS). */
  variant?: string;
  height: number;
  sections: readonly LevelSection[];
  signs?: Readonly<Record<string, SignText>>;
  /** Map letter -> enemy type id (enemies.json). Overrides the default { "E": "walker" }. */
  enemies?: Readonly<Record<string, string>>;
  /** Interactive objects (moving platforms, lasers, switches, doors...). Validated by objects/validate.ts. */
  objects?: unknown;
  /** Dialogue and narrative beats (story/validate.ts). */
  story?: unknown;
}

export const DEFAULT_ENEMY_LEGEND: Readonly<Record<string, string>> = { E: 'walker' };

export function enemyLegend(level: LevelData): Record<string, string> {
  return { ...DEFAULT_ENEMY_LEGEND, ...(level.enemies ?? {}) };
}

export interface ParsedLevel {
  id: string;
  biome: string;
  variant?: string;
  width: number;
  height: number;
  terrain: Terrain[][];
  spawn: TilePoint | null;
  stars: TilePoint[];
  enemies: Array<TilePoint & { type: string }>;
  checkpoints: TilePoint[];
  portals: TilePoint[];
  signs: Array<TilePoint & { text: SignText }>;
}

export const LEVEL_CHARS = '.#X=PSKO';

/** Builds the full character grid (rows top to bottom). */
export function buildGrid(level: LevelData): string[] {
  const grid: string[] = Array.from({ length: level.height }, () => '');
  for (const section of level.sections) {
    const width = Math.max(0, ...section.rows.map((row) => row.length));
    const offset = level.height - section.rows.length;
    for (let r = 0; r < level.height; r++) grid[r] += (section.rows[r - offset] ?? '').padEnd(width, '.');
  }
  return grid;
}

export function parseLevel(level: LevelData): ParsedLevel {
  const grid = buildGrid(level);
  const legend = enemyLegend(level);
  const width = grid[0]?.length ?? 0;
  const result: ParsedLevel = {
    id: level.id,
    biome: level.biome,
    variant: level.variant,
    width,
    height: level.height,
    terrain: [],
    spawn: null,
    stars: [],
    enemies: [],
    checkpoints: [],
    portals: [],
    signs: [],
  };

  for (let row = 0; row < level.height; row++) {
    const terrainRow: Terrain[] = [];
    for (let col = 0; col < width; col++) {
      const ch = grid[row][col];
      const point = { col, row };
      let terrain: Terrain = null;
      switch (ch) {
        case '#':
          terrain = 'ground';
          break;
        case 'X':
          terrain = 'stone';
          break;
        case '=':
          terrain = 'oneway';
          break;
        case 'P':
          result.spawn = point;
          break;
        case 'S':
          result.stars.push(point);
          break;
        case 'K':
          result.checkpoints.push(point);
          break;
        case 'O':
          result.portals.push(point);
          break;
        default: {
          const sign = level.signs?.[ch];
          if (sign) result.signs.push({ ...point, text: sign });
          else if (legend[ch]) result.enemies.push({ ...point, type: legend[ch] });
        }
      }
      terrainRow.push(terrain);
    }
    result.terrain.push(terrainRow);
  }
  return result;
}
