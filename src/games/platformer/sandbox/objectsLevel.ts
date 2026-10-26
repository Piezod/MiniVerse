import type { LevelData } from '../level/LevelParser';

/** Id of the technical scenario; it never appears in levels.json or the campaign. */
export const OBJECTS_SANDBOX_ID = 'sandbox-objects';

const WIDTH = 64;
const HEIGHT = 14;

/**
 * Test level for level objects (development only, see docs/LEVEL_OBJECTS.md).
 * Left to right: moving platform over a pit, electrified floor, periodic laser with a timed switch that
 * turns it off, a switch that opens a door, and a vertical platform up to the exit.
 */
export function buildObjectsSandbox(): LevelData {
  const grid = Array.from({ length: HEIGHT }, () => Array.from({ length: WIDTH }, () => '.'));
  const put = (col: number, row: number, ch: string): void => void (grid[row][col] = ch);
  for (let col = 0; col < WIDTH; col++) {
    const pit = col >= 12 && col <= 21;
    for (const row of [12, 13]) if (!pit) put(col, row, '#');
  }
  for (let col = 56; col < WIDTH; col++) for (let row = 6; row < 12; row++) put(col, row, '#');
  for (let row = 0; row <= 8; row++) put(48, row, 'X');
  put(38, 4, 'X');

  put(2, 11, 'P');
  put(30, 11, 'K');
  put(61, 5, 'O');
  for (const [col, row] of [[16, 9], [27, 9], [40, 11], [58, 5]]) put(col, row, 'S');
  put(8, 11, '1');
  put(23, 11, '2');
  put(32, 11, '3');
  put(42, 11, '4');

  return {
    id: OBJECTS_SANDBOX_ID,
    name: 'Test de objetos',
    biome: 'ruins',
    height: HEIGHT,
    sections: [{ rows: grid.map((row) => row.join('')) }],
    signs: {
      '1': { keyboard: 'Plataforma movil', touch: 'Plataforma movil' },
      '2': { keyboard: 'Suelo electrico: salta', touch: 'Suelo electrico: salta' },
      '3': { keyboard: 'Pisa: apaga el laser 6 s', touch: 'Pisa: apaga el laser 6 s' },
      '4': { keyboard: 'Interruptor: abre la puerta', touch: 'Interruptor: abre la puerta' },
    },
    objects: [
      { type: 'movingPlatform', id: 'pit-platform', col: 12, row: 12, width: 3, axis: 'x', travel: 7, speed: 40, wait: 0.6 },
      { type: 'electricFloor', col: 25, row: 11, width: 3, on: 1.2, off: 1.6, warning: 0.7 },
      { type: 'switch', id: 'laser-off', col: 34, row: 11, duration: 6 },
      { type: 'laser', col: 38, row: 5, orientation: 'vertical', length: 6, on: 1.2, off: 1.6, warning: 0.7, disabledBy: 'laser-off' },
      { type: 'switch', id: 'door-switch', col: 44, row: 11 },
      { type: 'door', col: 48, row: 9, height: 3, opensWith: ['door-switch'] },
      { type: 'movingPlatform', id: 'lift', col: 51, row: 12, width: 3, axis: 'y', travel: -6, speed: 35, wait: 1 },
    ],
  };
}
