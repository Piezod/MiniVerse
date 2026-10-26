import type { LevelData } from './LevelParser';
import type { ValidationResult } from './LevelValidator';

export interface LevelEntry {
  /** Order in the campaign, starting at 0. */
  index: number;
  file: string;
  id: string;
  name: string;
  biome: string;
  data: LevelData | null;
  validation: ValidationResult;
}

export interface LevelResult {
  stars: number;
  total: number;
}

interface SavedProgress {
  version: 2;
  best: Record<string, LevelResult>;
}

export const PROGRESS_VERSION = 2;

/**
 * Converts a stored progress to the current version (pure). v1 also kept an `unlocked` list; unlocking
 * is now derived from completed levels, so only the best results are carried over.
 */
export function migrateProgress(stored: unknown): SavedProgress {
  const best: Record<string, LevelResult> = {};
  const raw = typeof stored === 'object' && stored !== null ? (stored as { best?: unknown }).best : null;
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    for (const [id, result] of Object.entries(raw)) {
      const r = result as Partial<LevelResult> | null;
      if (r && Number.isFinite(r.stars) && Number.isFinite(r.total)) best[id] = { stars: Math.max(0, r.stars as number), total: Math.max(0, r.total as number) };
    }
  }
  return { version: PROGRESS_VERSION, best };
}

export interface ProgressStorage {
  load(): string | null;
  save(value: string): void;
}

export const memoryStorage = (): ProgressStorage => {
  let value: string | null = null;
  return { load: () => value, save: (v) => void (value = v) };
};

export const localProgressStorage = (key: string): ProgressStorage => ({
  load: () => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  save: (value) => {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Private mode or full storage: progress just won't persist.
    }
  },
});

/**
 * Level state: ordered levels (from levels.json) and best results. Unlocking is derived: by default
 * the first valid level is open and completing a level opens the next one; the CampaignManager
 * replaces that rule with per-chapter rules through setUnlockRule.
 */
export class LevelManager {
  private progress: SavedProgress = { version: PROGRESS_VERSION, best: {} };
  private rule: ((id: string) => boolean) | null = null;

  constructor(
    readonly levels: readonly LevelEntry[],
    private readonly storage: ProgressStorage,
  ) {
    const stored = storage.load();
    if (stored === null) return;
    try {
      const parsed = JSON.parse(stored) as { version?: number } | null;
      this.progress = migrateProgress(parsed);
      if (!parsed || parsed.version !== PROGRESS_VERSION) this.save();
    } catch {
      // Corrupt save: start fresh.
    }
  }

  /** Replaces the default linear unlocking (used by the campaign). */
  setUnlockRule(rule: ((id: string) => boolean) | null): void {
    this.rule = rule;
  }

  get(id: string): LevelEntry | undefined {
    return this.levels.find((level) => level.id === id);
  }

  getData(id: string): LevelData {
    const entry = this.get(id);
    if (!entry?.data || !entry.validation.ok) throw new Error(`Level "${id}" is missing or invalid`);
    return entry.data;
  }

  isPlayable(id: string): boolean {
    return this.get(id)?.validation.ok === true;
  }

  isUnlocked(id: string): boolean {
    if (!this.isPlayable(id)) return false;
    if (this.rule) return this.rule(id);
    const valid = this.levels.filter((level) => level.validation.ok);
    const position = valid.findIndex((level) => level.id === id);
    return position === 0 || this.isCompleted(valid[position - 1].id);
  }

  next(id: string): LevelEntry | undefined {
    const entry = this.get(id);
    return entry ? this.levels.slice(entry.index + 1).find((level) => level.validation.ok) : undefined;
  }

  best(id: string): LevelResult | undefined {
    return this.progress.best[id];
  }

  isCompleted(id: string): boolean {
    return this.progress.best[id] !== undefined;
  }

  /** Records a completed level and keeps the best star count. Returns the next level in registry order. */
  complete(id: string, result: LevelResult): LevelEntry | undefined {
    const previous = this.progress.best[id];
    if (!previous || result.stars > previous.stars) this.progress.best[id] = result;
    this.save();
    return this.next(id);
  }

  /** Last unlocked playable level, used as the default selection. */
  latestUnlocked(): LevelEntry | undefined {
    return [...this.levels].reverse().find((level) => this.isUnlocked(level.id));
  }

  private save(): void {
    this.storage.save(JSON.stringify(this.progress));
  }
}
