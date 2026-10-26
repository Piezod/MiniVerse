/** View models and keyboard navigation of the chapter and level selection screens (Phaser-free). */
import type { CampaignManager, ChapterStatus } from './CampaignManager';

export type NavKey = 'LEFT' | 'RIGHT' | 'UP' | 'DOWN';

/** Moves a selection through a grid; never leaves the list and stays put at the edges. */
export function moveSelection(index: number, key: NavKey, count: number, perRow: number): number {
  if (count <= 0) return 0;
  const step = { LEFT: -1, RIGHT: 1, UP: -perRow, DOWN: perRow }[key];
  const next = index + step;
  return next < 0 || next >= count ? Math.min(Math.max(index, 0), count - 1) : next;
}

/** Card centers of a grid whose last row is centered. */
export function gridCenters(count: number, perRow: number, cardW: number, cardH: number, gap: number, centerX: number, centerY: number): Array<{ x: number; y: number }> {
  const rows = Math.ceil(count / perRow);
  return Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / perRow);
    const inRow = Math.min(perRow, count - row * perRow);
    const startX = centerX - (inRow * cardW + (inRow - 1) * gap) / 2 + cardW / 2;
    return { x: startX + (i % perRow) * (cardW + gap), y: centerY + (row - (rows - 1) / 2) * (cardH + gap) };
  });
}

export interface ChapterCard {
  id: string;
  name: string;
  description: string;
  biome: string;
  status: ChapterStatus;
  unlocked: boolean;
  /** Can be opened (ready and unlocked). */
  selectable: boolean;
  stateLabel: string;
  levels: string;
  stars: string;
  completed: boolean;
  /** Names of the chapters still required, for locked chapters. */
  requires: string[];
}

export function chapterCards(campaign: CampaignManager, biomeName: (id: string) => string): ChapterCard[] {
  return campaign.chapters.map((chapter) => {
    const p = campaign.progressOf(chapter.id);
    const selectable = p.status === 'ready' && p.unlocked;
    const stateLabel = p.status === 'planned' ? 'Proximamente' : p.status === 'broken' ? 'No disponible' : !p.unlocked ? 'Bloqueado' : p.isCompleted ? 'Completado' : 'Disponible';
    return {
      id: chapter.id,
      name: chapter.name,
      description: chapter.description,
      biome: chapter.biome ? biomeName(chapter.biome) : 'Varios',
      status: p.status,
      unlocked: p.unlocked,
      selectable,
      stateLabel,
      levels: `${p.completed}/${p.total}`,
      stars: `${p.stars}/${p.starsTotal}`,
      completed: p.isCompleted,
      requires: chapter.unlock.filter((id) => !campaign.isChapterCompleted(id)).map((id) => campaign.chapter(id)?.name ?? id),
    };
  });
}

export interface LevelCard {
  id: string;
  name: string;
  position: number;
  biome: string;
  valid: boolean;
  unlocked: boolean;
  completed: boolean;
  stars: number;
  starsTotal: number;
}

export function levelCards(campaign: CampaignManager, chapterId: string): LevelCard[] {
  return campaign.levelsOf(chapterId).map((entry, i) => ({
    id: entry.id,
    name: entry.name,
    position: i + 1,
    biome: entry.biome,
    valid: entry.validation.ok,
    unlocked: campaign.isLevelUnlocked(entry.id),
    completed: campaign.isLevelCompleted(entry.id),
    stars: campaign.progressOfLevel(entry.id)?.stars ?? 0,
    starsTotal: entry.validation.parsed?.stars.length ?? 0,
  }));
}

/** Chapter shown when the level list opens without an explicit one. */
export function defaultChapterId(campaign: CampaignManager, preferred?: string | null): string | undefined {
  const usable = (id: string | null | undefined): id is string => !!id && campaign.chapter(id)?.status === 'ready' && campaign.isChapterUnlocked(id);
  if (usable(preferred)) return preferred;
  if (usable(campaign.lastChapterId)) return campaign.lastChapterId;
  const latest = campaign.latestUnlockedLevel();
  return (latest && campaign.chapterOf(latest.id)?.id) ?? campaign.availableChapters()[0]?.id;
}
