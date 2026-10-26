/**
 * Level validation (Phaser-free, used by the game at load time and by the automated tests).
 * Besides structure, it simulates the player's real jump physics over the tile grid to find every
 * reachable spot, so unreachable goals and impossible jumps are reported before playing.
 */
import { type EnemyDef, isFlying } from '../enemies/EnemyCatalog';
import { validateObjects } from '../objects/validate';
import { withObjectSupport } from '../objects/reachSupport';
import { validateStory } from '../story/validate';
import { GRAVITY, PLAYER_BODY, PLAYER_TUNING } from '../physics';
import { DEFAULT_ENEMY_LEGEND, LEVEL_CHARS, type LevelData, type ParsedLevel, parseLevel, type TilePoint } from './LevelParser';
import { TILE_SIZE as T } from './tileset';

export interface ValidationIssue {
  severity: 'error' | 'warning';
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
  level?: LevelData;
  parsed?: ParsedLevel;
  reach?: ReachResult;
}

const MIN_HEIGHT = 10;
const MAX_HEIGHT = 40;
const MIN_WIDTH = 20;
const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** `knownEnemies` (from enemies.json) is optional so structure can be checked without it; `variants` maps biome id to its variant ids. */
export function validateLevel(
  raw: unknown,
  knownBiomes: readonly string[],
  knownEnemies?: Readonly<Record<string, EnemyDef>>,
  variants: Readonly<Record<string, readonly string[]>> = {},
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const error = (message: string): void => void issues.push({ severity: 'error', message });
  const warn = (message: string): void => void issues.push({ severity: 'warning', message });

  if (!isRecord(raw)) return { ok: false, issues: [{ severity: 'error', message: 'El nivel no es un objeto JSON' }] };
  const { id, name, biome, height, sections, signs, enemies } = raw;
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) error('"id" debe ser texto en minúsculas, números y guiones');
  if (typeof name !== 'string' || !name.trim()) error('"name" es obligatorio');
  if (typeof biome !== 'string' || !knownBiomes.includes(biome)) error(`"biome" debe ser uno de: ${knownBiomes.join(', ')}`);
  if (raw.variant !== undefined) {
    const allowed = typeof biome === 'string' ? (variants[biome] ?? []) : [];
    if (typeof raw.variant !== 'string' || !allowed.includes(raw.variant)) error(`"variant" debe ser una variante del bioma${allowed.length ? `: ${allowed.join(', ')}` : ' (el bioma no tiene variantes)'}`);
  }
  if (typeof height !== 'number' || !Number.isInteger(height) || height < MIN_HEIGHT || height > MAX_HEIGHT) {
    error(`"height" debe ser un entero entre ${MIN_HEIGHT} y ${MAX_HEIGHT}`);
  }
  if (signs !== undefined) {
    if (!isRecord(signs)) error('"signs" debe ser un objeto');
    else
      for (const [key, value] of Object.entries(signs)) {
        if (!/^[1-9]$/.test(key)) error(`Cartel "${key}": la clave debe ser un dígito 1-9`);
        if (!isRecord(value) || typeof value.keyboard !== 'string' || typeof value.touch !== 'string') {
          error(`Cartel "${key}": necesita textos "keyboard" y "touch"`);
        }
      }
  }
  const legend: Record<string, string> = { ...DEFAULT_ENEMY_LEGEND };
  if (enemies !== undefined) {
    if (!isRecord(enemies)) error('"enemies" debe ser un objeto { letra: tipo }');
    else
      for (const [letter, type] of Object.entries(enemies)) {
        if (!/^[A-Z]$/.test(letter) || LEVEL_CHARS.includes(letter)) error(`Enemigo "${letter}": usa una letra mayúscula no reservada (${LEVEL_CHARS})`);
        else if (typeof type !== 'string') error(`Enemigo "${letter}": el tipo debe ser texto`);
        else legend[letter] = type;
      }
  }
  if (knownEnemies) {
    for (const [letter, type] of Object.entries(legend)) if (!knownEnemies[type]) error(`Enemigo "${letter}": tipo desconocido "${type}"`);
  }
  if (!Array.isArray(sections) || sections.length === 0) error('"sections" debe ser una lista no vacía');
  else
    sections.forEach((section, i) => {
      if (!isRecord(section) || !Array.isArray(section.rows) || section.rows.some((r) => typeof r !== 'string')) {
        error(`Sección ${i + 1}: "rows" debe ser una lista de textos`);
        return;
      }
      if (typeof height === 'number' && section.rows.length > height) error(`Sección ${i + 1}: tiene más filas (${section.rows.length}) que "height"`);
      const allowed = LEVEL_CHARS + Object.keys(isRecord(signs) ? signs : {}).join('') + Object.keys(legend).join('');
      (section.rows as string[]).forEach((row, r) => {
        const bad = [...row].find((ch) => !allowed.includes(ch));
        if (bad) error(`Sección ${i + 1}, fila ${r + 1}: carácter no válido "${bad}"`);
      });
    });
  if (issues.some((i) => i.severity === 'error')) return { ok: false, issues };

  const level = raw as unknown as LevelData;
  const parsed = parseLevel(level);
  const { terrain } = parsed;
  const solidAt = (c: number, r: number): boolean => r >= 0 && r < parsed.height && (terrain[r]?.[c] === 'ground' || terrain[r]?.[c] === 'stone');
  const supportAt = (c: number, r: number): boolean => r >= 0 && r < parsed.height && !!terrain[r]?.[c];
  const label = (p: TilePoint): string => `(columna ${p.col}, fila ${p.row})`;

  if (parsed.width < MIN_WIDTH) error(`El nivel es demasiado estrecho (${parsed.width} < ${MIN_WIDTH} columnas)`);
  const spawns = countChar(level, 'P');
  if (spawns !== 1) error(`Debe haber exactamente un punto de aparición "P" (hay ${spawns})`);
  if (parsed.portals.length !== 1) error(`Debe haber exactamente una meta "O" (hay ${parsed.portals.length})`);
  if (parsed.stars.length === 0) warn('El nivel no tiene estrellas');

  const needsGround = (what: string, p: TilePoint): void => {
    if (!supportAt(p.col, p.row + 1)) error(`${what} ${label(p)} no tiene suelo debajo`);
    if (solidAt(p.col, p.row) || solidAt(p.col, p.row - 1)) error(`${what} ${label(p)} está dentro de un bloque`);
  };
  if (parsed.spawn) needsGround('El punto de aparición', parsed.spawn);
  parsed.portals.forEach((p) => needsGround('La meta', p));
  parsed.checkpoints.forEach((p) => needsGround('El checkpoint', p));
  parsed.enemies.forEach((p) => {
    const flyer = knownEnemies?.[p.type];
    if (flyer && isFlying(flyer)) return;
    if (!supportAt(p.col, p.row + 1)) warn(`El enemigo ${label(p)} no tiene suelo debajo y caerá`);
  });
  const objectCheck = validateObjects(level.objects, { width: parsed.width, height: parsed.height });
  for (const issue of objectCheck.issues) (issue.severity === 'error' ? error : warn)(`objects[${issue.index}]: ${issue.message}`);
  for (const issue of validateStory(level.story, { width: parsed.width, height: parsed.height }).issues) error(`story${issue.index >= 0 ? `[${issue.index}]` : ''}: ${issue.message}`);
  if (issues.some((i) => i.severity === 'error') || !parsed.spawn) return { ok: false, issues, level, parsed };

  // The jump simulation sees the terrain plus the cells platforms visit (doors count as open).
  const reach = analyzeReachability(objectCheck.objects.length > 0 ? withObjectSupport(parsed, objectCheck.objects) : parsed);
  const reachProblem = error;
  for (const p of parsed.portals) if (!reach.touched.has(key(p.col, p.row))) reachProblem(`La meta ${label(p)} es inalcanzable desde el inicio`);
  for (const p of parsed.stars) if (!reach.touched.has(key(p.col, p.row))) reachProblem(`La estrella ${label(p)} es inalcanzable`);
  for (const p of parsed.checkpoints) if (!reach.touched.has(key(p.col, p.row))) reachProblem(`El checkpoint ${label(p)} es inalcanzable`);

  return { ok: !issues.some((i) => i.severity === 'error'), issues, level, parsed, reach };
}

function countChar(level: LevelData, ch: string): number {
  return level.sections.reduce((n, s) => n + s.rows.reduce((m, r) => m + r.split(ch).length - 1, 0), 0);
}

// ---------------------------------------------------------------- Reachability

const key = (c: number, r: number): string => `${c},${r}`;

export interface ReachResult {
  /** Tiles where the player can stand ("col,row" of the cell containing the feet). */
  standing: Set<string>;
  /** Every tile the player's body can overlap. */
  touched: Set<string>;
}

const DT = 1 / 60;
const HALF_W = PLAYER_BODY.width / 2;
/** Safety margin: the simulated player is slightly slower than the real one. */
const RUN_SPEED = PLAYER_TUNING.runSpeed * 0.92;

/**
 * Breadth-first search over standing positions. From each one it simulates walking off edges and
 * jumps (full and short, several speeds, both directions) with the same gravity, jump speed and
 * body size as the game, and records where the player lands.
 */
export function analyzeReachability(level: ParsedLevel): ReachResult {
  const { terrain, width, height } = level;
  const solid = (c: number, r: number): boolean => {
    if (c < 0 || c >= width) return true;
    if (r < 0 || r >= height) return false;
    return terrain[r][c] === 'ground' || terrain[r][c] === 'stone';
  };
  const support = (c: number, r: number): boolean => r >= 0 && r < height && c >= 0 && c < width && !!terrain[r][c];

  const cols = (x: number): [number, number] => [Math.floor((x - HALF_W) / T), Math.floor((x + HALF_W - 0.001) / T)];
  const rows = (feet: number): [number, number] => [Math.floor((feet - PLAYER_BODY.height) / T), Math.floor((feet - 0.001) / T)];
  const bodyHits = (x: number, feet: number): boolean => {
    const [c0, c1] = cols(x);
    const [r0, r1] = rows(feet);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (solid(c, r)) return true;
    return false;
  };

  const standing = new Set<string>();
  const touched = new Set<string>();
  const touch = (x: number, feet: number): void => {
    const [c0, c1] = cols(x);
    const [r0, r1] = rows(feet);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) touched.add(key(c, r));
  };

  /** Returns the standing cell where the trajectory lands, or null (fell out / timed out). */
  const simulate = (x0: number, feet0: number, vx: number, vy0: number, holdTime: number): [number, number] | null => {
    let x = x0;
    let feet = feet0;
    let vy = vy0;
    let vxNow = vx;
    for (let step = 0; step < 240; step++) {
      const t = step * DT;
      if (vy < -PLAYER_TUNING.jumpCutVelocity && t > holdTime) vy = -PLAYER_TUNING.jumpCutVelocity;
      vy = Math.min(vy + GRAVITY * DT, PLAYER_TUNING.maxFallSpeed);

      const nx = x + vxNow * DT;
      if (bodyHits(nx, feet)) vxNow = 0;
      else x = nx;

      const nf = feet + vy * DT;
      if (vy < 0) {
        if (bodyHits(x, nf)) vy = 0;
        else feet = nf;
      } else {
        const [c0, c1] = cols(x);
        for (let r = Math.ceil(feet / T); r <= Math.floor(nf / T); r++) {
          for (let c = c0; c <= c1; c++) {
            if (support(c, r)) {
              touch(x, r * T);
              return [Math.floor(x / T), r - 1];
            }
          }
        }
        if (bodyHits(x, nf)) return null;
        feet = nf;
      }
      touch(x, feet);
      if (feet > height * T + 2 * T) return null;
    }
    return null;
  };

  const start = level.spawn!;
  const queue: Array<[number, number]> = [[start.col, start.row]];
  standing.add(key(start.col, start.row));
  while (queue.length > 0) {
    const [c, r] = queue.shift()!;
    const feet = (r + 1) * T;
    const center = c * T + T / 2;
    touch(center, feet);

    const launches: Array<[number, number, number, number]> = [];
    for (const dir of [-1, 1]) {
      // Walking off this tile (also covers walking onto the neighbour).
      launches.push([center + dir * (T / 2 + HALF_W + 1), dir * RUN_SPEED, 0, 0]);
      for (const x of [center, center + dir * (T / 2 + HALF_W - 1)]) {
        for (const speed of [RUN_SPEED, RUN_SPEED * 0.5, RUN_SPEED * 0.2]) {
          launches.push([x, dir * speed, -PLAYER_TUNING.jumpVelocity, 10]);
          launches.push([x, dir * speed, -PLAYER_TUNING.jumpVelocity, 0.08]);
        }
      }
    }
    launches.push([center, 0, -PLAYER_TUNING.jumpVelocity, 10]);

    for (const [x, vx, vy, hold] of launches) {
      if (bodyHits(x, feet)) continue;
      const landed = simulate(x, feet, vx, vy, hold);
      if (!landed) continue;
      const [lc, lr] = landed;
      const k = key(lc, lr);
      if (standing.has(k) || bodyHits(lc * T + T / 2, (lr + 1) * T)) continue;
      standing.add(k);
      queue.push([lc, lr]);
    }
  }
  return { standing, touched };
}
