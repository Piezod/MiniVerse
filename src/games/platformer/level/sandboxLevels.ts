/** Technical levels that live outside the campaign (development tools). They never touch progress or saves. */
import { BIOME_VARIANTS, BIOMES } from '../biomes';
import type { EnemyDef } from '../enemies/EnemyCatalog';
import type { LevelData } from './LevelParser';
import { validateLevel } from './LevelValidator';

const sandboxes = new Map<string, LevelData>();

/** Validates a sandbox level like any other and keeps it available to the level scene. Throws on errors. */
export function registerSandboxLevel(raw: unknown, enemies: Readonly<Record<string, EnemyDef>>): LevelData {
  const result = validateLevel(raw, Object.keys(BIOMES), enemies, BIOME_VARIANTS);
  for (const issue of result.issues) if (issue.severity === 'warning') console.warn(`[sandbox] ${issue.message}`);
  if (!result.ok || !result.level) {
    throw new Error(`Invalid sandbox level:\n${result.issues.filter((i) => i.severity === 'error').map((i) => `  ${i.message}`).join('\n')}`);
  }
  sandboxes.set(result.level.id, result.level);
  return result.level;
}

export const getSandboxLevel = (id: string): LevelData | undefined => sandboxes.get(id);

export const clearSandboxLevels = (): void => sandboxes.clear();
