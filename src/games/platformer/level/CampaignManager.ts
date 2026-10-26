/**
 * Campaign structure (Phaser-free). campaign.json groups the levels of levels.json into chapters;
 * all progress is derived from the LevelManager (completed levels), so nothing contradictory is
 * ever stored: a chapter is unlocked when the chapters it requires are fully completed, and a
 * level when its chapter is unlocked and the previous level of the chapter is completed.
 */
import type { LevelEntry, LevelResult, LevelManager } from './LevelManager';

export type ChapterStatus = 'ready' | 'planned' | 'broken';

export interface ChapterReward {
  /** Ability granted for completing the chapter (applied by the shop/profile layer). */
  ability: string;
  level: number;
}

export interface ChapterDef {
  id: string;
  name: string;
  description: string;
  order: number;
  /** Main biome of the chapter; null when each level declares its own (the prologue). */
  biome: string | null;
  /** Level ids in play order (ids from the level files, not file names). */
  levels: string[];
  /** Chapters that must be completed first. */
  unlock: string[];
  rewards: ChapterReward[];
  /** planned: announced but without content yet; never playable. */
  status: ChapterStatus;
  /** Levels the finished chapter will have (planned chapters only). */
  plannedLevels: number;
}

export interface CampaignIssue {
  chapter: string;
  message: string;
}

export interface CampaignContext {
  levels: ReadonlyArray<Pick<LevelEntry, 'id' | 'biome'> & { validation: { ok: boolean } }>;
  biomes: readonly string[];
  /** Ability ids with their number of levels (for rewards). */
  abilities?: Readonly<Record<string, { levels: readonly unknown[] }>>;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const ID = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Validates campaign.json. A chapter with errors becomes `broken` (listed, never playable) instead of
 * stopping the game; `planned` chapters declare no levels so nothing refers to missing files.
 */
export function buildCampaign(raw: unknown, ctx: CampaignContext): { chapters: ChapterDef[]; issues: CampaignIssue[] } {
  const issues: CampaignIssue[] = [];
  const chapters: ChapterDef[] = [];
  if (!isRecord(raw) || !Array.isArray(raw.chapters)) return { chapters, issues: [{ chapter: '*', message: 'campaign.json necesita "chapters": []' }] };

  const levelById = new Map(ctx.levels.map((l) => [l.id, l]));
  const seenIds = new Set<string>();
  const seenOrders = new Set<number>();
  const owner = new Map<string, string>();

  raw.chapters.forEach((entry, i) => {
    const id = isRecord(entry) && typeof entry.id === 'string' ? entry.id : `#${i}`;
    const errors: string[] = [];
    if (!isRecord(entry)) return void issues.push({ chapter: id, message: 'el capítulo debe ser un objeto' });
    if (!ID.test(id)) errors.push('"id" debe ser minúsculas, números y guiones');
    if (seenIds.has(id)) errors.push(`id duplicado "${id}"`);
    seenIds.add(id);
    const name = typeof entry.name === 'string' && entry.name.trim() ? entry.name : '';
    if (!name) errors.push('"name" es obligatorio');
    const order = entry.order;
    if (typeof order !== 'number' || !Number.isInteger(order) || order < 0) errors.push('"order" debe ser un entero >= 0');
    else if (seenOrders.has(order)) errors.push(`"order" ${order} repetido`);
    else seenOrders.add(order);

    const planned = entry.planned === true;
    const biome = entry.biome === null || entry.biome === undefined ? null : typeof entry.biome === 'string' ? entry.biome : (errors.push('"biome" debe ser texto o null'), null);
    if (!planned && biome !== null && !ctx.biomes.includes(biome)) errors.push(`"biome" desconocido: ${biome} (${ctx.biomes.join(', ')})`);

    const levels = Array.isArray(entry.levels) && entry.levels.every((l) => typeof l === 'string') ? (entry.levels as string[]) : [];
    if (!Array.isArray(entry.levels)) errors.push('"levels" debe ser una lista de ids de nivel');
    let plannedLevels = 0;
    if (planned) {
      if (levels.length > 0) errors.push('un capítulo "planned" no puede listar niveles hasta que existan (déjalo en [] y quita "planned" al añadirlos)');
      plannedLevels = typeof entry.plannedLevels === 'number' && Number.isInteger(entry.plannedLevels) && entry.plannedLevels > 0 ? entry.plannedLevels : 0;
      if (!plannedLevels) errors.push('un capítulo "planned" necesita "plannedLevels" (entero > 0)');
    } else {
      if (levels.length === 0) errors.push('un capítulo jugable necesita al menos un nivel');
      for (const levelId of levels) {
        const level = levelById.get(levelId);
        if (!level) errors.push(`el nivel "${levelId}" no existe en levels.json`);
        else if (!level.validation.ok) errors.push(`el nivel "${levelId}" no es válido`);
        else if (biome !== null && level.biome !== biome) errors.push(`el nivel "${levelId}" usa el bioma "${level.biome}", no "${biome}"`);
        if (owner.has(levelId)) errors.push(`el nivel "${levelId}" ya pertenece al capítulo "${owner.get(levelId)}"`);
        else owner.set(levelId, id);
      }
      if (new Set(levels).size !== levels.length) errors.push('hay niveles repetidos');
    }

    let unlock: string[] = [];
    if (entry.unlock !== undefined && entry.unlock !== null) {
      if (isRecord(entry.unlock) && Array.isArray(entry.unlock.chapters) && entry.unlock.chapters.every((c) => typeof c === 'string')) unlock = entry.unlock.chapters as string[];
      else errors.push('"unlock" debe ser null o { "chapters": [ids] }');
    }

    const rewards: ChapterReward[] = [];
    if (entry.rewards !== undefined) {
      const list = isRecord(entry.rewards) && Array.isArray(entry.rewards.abilities) ? entry.rewards.abilities : null;
      if (!list) errors.push('"rewards" debe ser { "abilities": [{ "id", "level" }] }');
      else
        for (const r of list) {
          const ok = isRecord(r) && typeof r.id === 'string' && typeof r.level === 'number' && Number.isInteger(r.level) && r.level >= 1;
          if (!ok) errors.push('cada recompensa necesita "id" y "level" (entero >= 1)');
          else if (ctx.abilities) {
            const def = ctx.abilities[r.id as string];
            if (!def) errors.push(`recompensa: habilidad desconocida "${r.id as string}"`);
            else if ((r.level as number) > def.levels.length) errors.push(`recompensa: "${r.id as string}" no tiene nivel ${r.level as number}`);
            else rewards.push({ ability: r.id as string, level: r.level as number });
          } else rewards.push({ ability: r.id as string, level: r.level as number });
        }
    }

    errors.forEach((message) => issues.push({ chapter: id, message }));
    chapters.push({
      id,
      name: name || id,
      description: typeof entry.description === 'string' ? entry.description : '',
      order: typeof order === 'number' ? order : i,
      biome,
      levels: planned ? [] : levels,
      unlock,
      rewards,
      status: errors.length ? 'broken' : planned ? 'planned' : 'ready',
      plannedLevels,
    });
  });

  chapters.sort((a, b) => a.order - b.order);
  const byId = new Map(chapters.map((c) => [c.id, c]));
  for (const chapter of chapters) {
    const bad = chapter.unlock.filter((u) => u === chapter.id || !byId.has(u));
    if (bad.length) {
      issues.push({ chapter: chapter.id, message: `"unlock" apunta a capítulos inexistentes o a sí mismo: ${bad.join(', ')}` });
      chapter.status = 'broken';
    }
  }
  // A chapter can't wait for itself through other chapters.
  const waitsForSelf = (start: string, id: string, seen: Set<string>): boolean =>
    (byId.get(id)?.unlock ?? []).some((u) => u === start || (!seen.has(u) && (seen.add(u), waitsForSelf(start, u, seen))));
  for (const chapter of chapters) {
    if (waitsForSelf(chapter.id, chapter.id, new Set())) {
      issues.push({ chapter: chapter.id, message: 'los requisitos de desbloqueo forman un ciclo' });
      chapter.status = 'broken';
    }
  }
  for (const level of ctx.levels) {
    if (level.validation.ok && !owner.has(level.id)) issues.push({ chapter: '*', message: `el nivel "${level.id}" no pertenece a ningún capítulo jugable` });
  }
  return { chapters, issues };
}

export interface ChapterProgress {
  completed: number;
  total: number;
  stars: number;
  starsTotal: number;
  unlocked: boolean;
  isCompleted: boolean;
  status: ChapterStatus;
}

export interface CompletionResult {
  /** Next level of the same chapter, if there is one. */
  next: LevelEntry | undefined;
  chapterCompleted: boolean;
  /** Chapters that became playable with this completion. */
  unlockedChapters: ChapterDef[];
}

/** Chapters and per-chapter unlocking on top of the LevelManager (which owns results and storage). */
export class CampaignManager {
  readonly chapters: readonly ChapterDef[];
  private readonly byId = new Map<string, ChapterDef>();
  private readonly chapterOfLevel = new Map<string, ChapterDef>();
  /** Chapter last shown by the level list, so other screens can return to it. */
  lastChapterId: string | null = null;

  constructor(
    chapters: readonly ChapterDef[],
    private readonly levels: LevelManager,
  ) {
    this.chapters = chapters;
    for (const chapter of chapters) {
      this.byId.set(chapter.id, chapter);
      if (chapter.status === 'ready') for (const id of chapter.levels) this.chapterOfLevel.set(id, chapter);
    }
    levels.setUnlockRule((id) => this.isLevelUnlocked(id));
  }

  chapter(id: string): ChapterDef | undefined {
    return this.byId.get(id);
  }

  chapterOf(levelId: string): ChapterDef | undefined {
    return this.chapterOfLevel.get(levelId);
  }

  /** Level entries of a ready chapter, in play order. */
  levelsOf(chapterId: string): LevelEntry[] {
    const chapter = this.byId.get(chapterId);
    if (chapter?.status !== 'ready') return [];
    return chapter.levels.map((id) => this.levels.get(id)).filter((l): l is LevelEntry => !!l);
  }

  /** 1-based position of a level inside its chapter. */
  positionOf(levelId: string): number {
    return (this.chapterOf(levelId)?.levels.indexOf(levelId) ?? -1) + 1;
  }

  isLevelCompleted(levelId: string): boolean {
    return this.levels.isCompleted(levelId);
  }

  /** Best result of a level, if completed. */
  progressOfLevel(levelId: string): LevelResult | undefined {
    return this.levels.best(levelId);
  }

  isChapterCompleted(chapterId: string): boolean {
    const chapter = this.byId.get(chapterId);
    return chapter?.status === 'ready' && chapter.levels.every((id) => this.levels.isCompleted(id));
  }

  isChapterUnlocked(chapterId: string): boolean {
    const chapter = this.byId.get(chapterId);
    return chapter?.status === 'ready' && chapter.unlock.every((id) => this.isChapterCompleted(id));
  }

  isLevelUnlocked(levelId: string): boolean {
    const chapter = this.chapterOf(levelId);
    if (!chapter || !this.isChapterUnlocked(chapter.id)) return false;
    const position = chapter.levels.indexOf(levelId);
    return position === 0 || this.levels.isCompleted(chapter.levels[position - 1]);
  }

  /** Playable chapters that are currently unlocked, in order. */
  availableChapters(): ChapterDef[] {
    return this.chapters.filter((c) => this.isChapterUnlocked(c.id));
  }

  progressOf(chapterId: string): ChapterProgress {
    const chapter = this.byId.get(chapterId);
    const ids = chapter?.status === 'ready' ? chapter.levels : [];
    const entries = ids.map((id) => this.levels.get(id));
    return {
      completed: ids.filter((id) => this.levels.isCompleted(id)).length,
      total: ids.length || (chapter?.plannedLevels ?? 0),
      stars: ids.reduce((sum, id) => sum + (this.levels.best(id)?.stars ?? 0), 0),
      starsTotal: entries.reduce((sum, e) => sum + (e?.validation.parsed?.stars.length ?? 0), 0),
      unlocked: this.isChapterUnlocked(chapterId),
      isCompleted: this.isChapterCompleted(chapterId),
      status: chapter?.status ?? 'broken',
    };
  }

  /** Next playable chapter after `chapterId` in campaign order (unlocked or not). */
  nextChapter(chapterId: string): ChapterDef | undefined {
    const index = this.chapters.findIndex((c) => c.id === chapterId);
    return index < 0 ? undefined : this.chapters.slice(index + 1).find((c) => c.status === 'ready');
  }

  /** Next level inside the same chapter (never crosses chapters). */
  nextLevel(levelId: string): LevelEntry | undefined {
    const chapter = this.chapterOf(levelId);
    const id = chapter?.levels[chapter.levels.indexOf(levelId) + 1];
    return id ? this.levels.get(id) : undefined;
  }

  /** Rewards of every completed chapter (derived, so they can't get out of sync with progress). */
  earnedRewards(): ChapterReward[] {
    return this.chapters.filter((c) => this.isChapterCompleted(c.id)).flatMap((c) => c.rewards);
  }

  complete(levelId: string, result: LevelResult): CompletionResult {
    const before = new Set(this.availableChapters().map((c) => c.id));
    this.levels.complete(levelId, result);
    const chapter = this.chapterOf(levelId);
    return {
      next: this.nextLevel(levelId),
      chapterCompleted: !!chapter && this.isChapterCompleted(chapter.id),
      unlockedChapters: this.availableChapters().filter((c) => !before.has(c.id)),
    };
  }

  /** Default selection: the last unlocked level of the campaign. */
  latestUnlockedLevel(): LevelEntry | undefined {
    for (const chapter of [...this.chapters].reverse()) {
      const open = [...this.levelsOf(chapter.id)].reverse().find((l) => this.isLevelUnlocked(l.id));
      if (open) return open;
    }
    return undefined;
  }
}
