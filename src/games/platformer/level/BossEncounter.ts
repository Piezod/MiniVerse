import type { ParsedLevel } from './LevelParser';
import type { StoryBeat } from '../story/types';

export interface BossEncounter {
  enemy: string;
  arena: { col: number; row: number; width: number; height: number };
  signals: { engaged: string; hazards: string; defeated: string };
  vulnerableBy?: string[];
  intro: string;
  victory: string;
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const ID = /^[a-z][a-z0-9-]*$/;

export function validateBossEncounter(
  raw: unknown,
  level: ParsedLevel,
  beats: readonly StoryBeat[],
  enemies?: Readonly<Record<string, { boss: boolean }>>,
): { encounter: BossEncounter | null; issues: string[] } {
  if (raw === undefined) return { encounter: null, issues: [] };
  const issues: string[] = [];
  if (!record(raw) || !record(raw.arena) || !record(raw.signals)) return { encounter: null, issues: ['bossEncounter necesita enemy, arena, signals, intro y victory'] };
  for (const key of Object.keys(raw)) if (!['enemy', 'arena', 'signals', 'vulnerableBy', 'intro', 'victory'].includes(key)) issues.push(`bossEncounter: campo desconocido ${key}`);
  const enemy = typeof raw.enemy === 'string' ? raw.enemy : '';
  if (!ID.test(enemy) || (enemies && !enemies[enemy]?.boss)) issues.push('bossEncounter.enemy debe ser un jefe registrado');
  const arena = raw.arena;
  for (const key of Object.keys(arena)) if (!['col', 'row', 'width', 'height'].includes(key)) issues.push(`arena: campo desconocido ${key}`);
  const integer = (key: string, minimum: number, maximum: number): number => {
    const value = arena[key];
    if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum || value > maximum) {
      issues.push(`arena.${key} fuera de rango`);
      return minimum;
    }
    return value;
  };
  const bounds = { col: integer('col', 0, level.width - 1), row: integer('row', 0, level.height - 1), width: integer('width', 1, level.width), height: integer('height', 1, level.height) };
  if (bounds.col + bounds.width > level.width || bounds.row + bounds.height > level.height) issues.push('arena fuera del nivel');
  const signal = (key: string): string => {
    const value = raw.signals as Record<string, unknown>;
    if (typeof value[key] !== 'string' || !ID.test(value[key])) issues.push(`signals.${key} necesita un id válido`);
    return typeof value[key] === 'string' ? value[key] : '';
  };
  for (const key of Object.keys(raw.signals)) if (!['engaged', 'hazards', 'defeated'].includes(key)) issues.push(`signals: campo desconocido ${key}`);
  const signals = { engaged: signal('engaged'), hazards: signal('hazards'), defeated: signal('defeated') };
  if (new Set(Object.values(signals)).size !== 3) issues.push('signals no pueden repetirse');
  const vulnerableBy: string[] = [];
  if (raw.vulnerableBy !== undefined) {
    if (!Array.isArray(raw.vulnerableBy) || raw.vulnerableBy.length === 0 || raw.vulnerableBy.some((value) => typeof value !== 'string' || !ID.test(value))) issues.push('vulnerableBy debe ser una lista no vacía de señales válidas');
    else vulnerableBy.push(...new Set(raw.vulnerableBy as string[]));
  }
  const story = (key: string): string => {
    const value = raw[key];
    const beat = beats.find((entry) => entry.id === value);
    if (!beat || beat.trigger.type !== 'event' || !beat.blocking) issues.push(`bossEncounter.${key} necesita un diálogo bloqueante de evento`);
    return typeof value === 'string' ? value : '';
  };
  const intro = story('intro');
  const victory = story('victory');
  const actors = level.enemies.filter((entry) => entry.type === enemy);
  if (actors.length !== 1 || actors.some((entry) => entry.col < bounds.col || entry.col >= bounds.col + bounds.width || entry.row < bounds.row || entry.row >= bounds.row + bounds.height)) issues.push('bossEncounter necesita exactamente un jefe dentro de la arena');
  return { encounter: issues.length ? null : { enemy, arena: bounds, signals, ...(vulnerableBy.length ? { vulnerableBy } : {}), intro, victory }, issues };
}