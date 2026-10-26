import type { StoryBeat, StoryIssue, StoryLine } from './types';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const ID = /^[a-z][a-z0-9-]*$/;
const MAX_BEATS = 40;
const MAX_LINES = 10;
export const MAX_TEXT = 220;

const BEAT_KEYS = ['id', 'trigger', 'blocking', 'once', 'lines'];
const LINE_KEYS = ['speaker', 'text', 'touchText', 'duration'];
const ZONE_KEYS = ['type', 'col', 'row', 'width', 'height'];

/** Validates the "story" block of a level: { beats: [...] }. Unknown fields are errors, not silently ignored. */
export function validateStory(raw: unknown, size: { width: number; height: number }): { beats: StoryBeat[]; issues: StoryIssue[]; ok: boolean } {
  const issues: StoryIssue[] = [];
  const beats: StoryBeat[] = [];
  const fail = (index: number, message: string): void => void issues.push({ index, message });
  if (raw === undefined || raw === null) return { beats, issues, ok: true };
  if (!isRecord(raw) || !Array.isArray(raw.beats)) {
    fail(-1, '"story" debe ser { "beats": [...] }');
    return { beats, issues, ok: false };
  }
  for (const key of Object.keys(raw)) if (key !== 'beats') fail(-1, `campo desconocido "${key}" en "story"`);
  if (raw.beats.length > MAX_BEATS) fail(-1, `demasiados momentos (${raw.beats.length} > ${MAX_BEATS})`);

  const ids = new Set<string>();
  let starts = 0;
  raw.beats.slice(0, MAX_BEATS).forEach((entry, index) => {
    const errors: string[] = [];
    if (!isRecord(entry)) return fail(index, 'cada momento debe ser un objeto');
    const label = typeof entry.id === 'string' ? `"${entry.id}"` : 'sin id';
    for (const key of Object.keys(entry)) if (!BEAT_KEYS.includes(key)) errors.push(`campo desconocido "${key}"`);
    if (typeof entry.id !== 'string' || !ID.test(entry.id)) errors.push('"id" debe ser minúsculas, números y guiones');
    else if (ids.has(entry.id)) errors.push(`id duplicado "${entry.id}"`);
    else ids.add(entry.id);
    for (const key of ['blocking', 'once'] as const) if (entry[key] !== undefined && typeof entry[key] !== 'boolean') errors.push(`"${key}" debe ser true o false`);

    let trigger: StoryBeat['trigger'] = { type: 'start' };
    const t = entry.trigger;
    if (!isRecord(t)) errors.push('"trigger" es obligatorio: { "type": "start" } o { "type": "zone", col, row, width, height }');
    else if (t.type === 'start') {
      starts++;
      for (const key of Object.keys(t)) if (key !== 'type') errors.push(`trigger "start": campo desconocido "${key}"`);
    } else if (t.type === 'zone') {
      for (const key of Object.keys(t)) if (!ZONE_KEYS.includes(key)) errors.push(`trigger "zone": campo desconocido "${key}"`);
      const int = (key: string, min: number, max: number): number => {
        const v = t[key];
        if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) {
          errors.push(`trigger "zone": "${key}" debe ser un entero entre ${min} y ${max}`);
          return min;
        }
        return v;
      };
      const zone = { type: 'zone' as const, col: int('col', 0, size.width - 1), row: int('row', 0, size.height - 1), width: int('width', 1, 80), height: int('height', 1, 60) };
      if (zone.col + zone.width > size.width || zone.row + zone.height > size.height) errors.push('trigger "zone": la zona se sale del nivel');
      trigger = zone;
    } else errors.push('trigger "type" debe ser "start" o "zone"');

    const lines: StoryLine[] = [];
    if (!Array.isArray(entry.lines) || entry.lines.length === 0 || entry.lines.length > MAX_LINES) errors.push(`"lines" debe tener entre 1 y ${MAX_LINES} líneas`);
    else
      entry.lines.forEach((l, n) => {
        const at = `lines[${n}]`;
        if (!isRecord(l)) return void errors.push(`${at} debe ser un objeto`);
        for (const key of Object.keys(l)) if (!LINE_KEYS.includes(key)) errors.push(`${at}: campo desconocido "${key}"`);
        if (typeof l.speaker !== 'string' || !ID.test(l.speaker)) errors.push(`${at}: "speaker" debe ser un id (minúsculas, números y guiones)`);
        if (typeof l.text !== 'string' || !l.text.trim() || l.text.length > MAX_TEXT) errors.push(`${at}: "text" debe tener entre 1 y ${MAX_TEXT} caracteres`);
        if (l.touchText !== undefined && (typeof l.touchText !== 'string' || !l.touchText.trim() || l.touchText.length > MAX_TEXT)) errors.push(`${at}: "touchText" debe tener entre 1 y ${MAX_TEXT} caracteres`);
        if (l.duration !== undefined && (typeof l.duration !== 'number' || l.duration < 0.5 || l.duration > 20)) errors.push(`${at}: "duration" debe estar entre 0.5 y 20`);
        if (typeof l.speaker === 'string' && typeof l.text === 'string') {
          lines.push({ speaker: l.speaker, text: l.text, ...(typeof l.touchText === 'string' ? { touchText: l.touchText } : {}), ...(typeof l.duration === 'number' ? { duration: l.duration } : {}) });
        }
      });

    if (errors.length) errors.forEach((m) => fail(index, `${label}: ${m}`));
    else beats.push({ id: entry.id as string, trigger, blocking: entry.blocking === true, once: entry.once !== false, lines });
  });
  if (starts > 1) fail(-1, 'solo puede haber un momento con trigger "start"');
  return { beats, issues, ok: issues.length === 0 };
}
