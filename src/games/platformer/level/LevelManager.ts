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
  unlocked: string[];
  best: Record<string, LevelResult>;
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
 * Campaign state: ordered levels (from levels.json), unlocking and best results.
 * The first valid level is always unlocked; completing a level unlocks the next one.
 */
export class LevelManager {
  private progress: SavedProgress = { unlocked: [], best: {} };

  constructor(
    readonly levels: readonly LevelEntry[],
    private readonly storage: ProgressStorage,
  ) {
    try {
      const saved = JSON.parse(storage.load() ?? 'null') as Partial<SavedProgress> | null;
      if (saved && Array.isArray(saved.unlocked) && typeof saved.best === 'object' && saved.best) {
        this.progress = { unlocked: saved.unlocked.filter((id) => typeof id === 'string'), best: saved.best };
      }
    } catch {
      // Corrupt save: start fresh.
    }
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
    const first = this.levels.find((level) => level.validation.ok);
    return this.isPlayable(id) && (id === first?.id || this.progress.unlocked.includes(id));
  }

  next(id: string): LevelEntry | undefined {
    const entry = this.get(id);
    return entry ? this.levels.slice(entry.index + 1).find((level) => level.validation.ok) : undefined;
  }

  best(id: string): LevelResult | undefined {
    return this.progress.best[id];
  }

  /** Records a completed level, keeps the best star count and unlocks the next level. */
  complete(id: string, result: LevelResult): LevelEntry | undefined {
    const previous = this.progress.best[id];
    if (!previous || result.stars > previous.stars) this.progress.best[id] = result;
    if (!this.progress.unlocked.includes(id)) this.progress.unlocked.push(id);
    const next = this.next(id);
    if (next && !this.progress.unlocked.includes(next.id)) this.progress.unlocked.push(next.id);
    this.storage.save(JSON.stringify(this.progress));
    return next;
  }

  /** Last unlocked playable level, used as the default selection. */
  latestUnlocked(): LevelEntry | undefined {
    return [...this.levels].reverse().find((level) => this.isUnlocked(level.id));
  }
}
