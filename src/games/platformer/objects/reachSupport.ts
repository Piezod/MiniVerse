import type { ParsedLevel } from '../level/LevelParser';
import type { LevelObjectConfig } from './types';

/**
 * Terrain for the jump simulation of the level validator, with the objects that help the player: every
 * cell a moving platform visits becomes a one-way tile. Optimistic (it ignores timing) and doors count
 * as open, so an "unreachable" report is a real problem while a pass doesn't prove the timing is fair.
 */
export function withObjectSupport(parsed: ParsedLevel, objects: readonly LevelObjectConfig[]): ParsedLevel {
  const terrain = parsed.terrain.map((row) => [...row]);
  for (const o of objects) {
    if (o.type !== 'movingPlatform') continue;
    const sign = Math.sign(o.travel);
    for (let step = 0; step <= Math.abs(o.travel); step++) {
      const row = o.axis === 'y' ? o.row + sign * step : o.row;
      const col = o.axis === 'x' ? o.col + sign * step : o.col;
      for (let c = col; c < col + o.width; c++) if (terrain[row] && c >= 0 && c < parsed.width && !terrain[row][c]) terrain[row][c] = 'oneway';
    }
  }
  return { ...parsed, terrain };
}
