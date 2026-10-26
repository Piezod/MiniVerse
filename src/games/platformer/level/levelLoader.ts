import type Phaser from 'phaser';
import { BIOMES } from '../biomes';
import type { EnemyDef } from '../enemies/EnemyCatalog';
import { type LevelEntry, LevelManager, localProgressStorage } from './LevelManager';
import { validateLevel } from './LevelValidator';

/** Campaign definition: public/assets/platformer/levels/levels.json lists level files in order. */
const LEVELS_PATH = 'assets/platformer/levels/';
const REGISTRY_KEY = 'platformer.levels.registry';
const levelKey = (file: string): string => `platformer.level.${file}`;

interface LevelRegistry {
  levels: string[];
}

let manager: LevelManager | null = null;

export function queueLevels(scene: Phaser.Scene): void {
  scene.load.once(`filecomplete-json-${REGISTRY_KEY}`, (_key: string, _type: string, registry: LevelRegistry) => {
    for (const file of registry.levels ?? []) scene.load.json(levelKey(file), LEVELS_PATH + file);
  });
  scene.load.json(REGISTRY_KEY, LEVELS_PATH + 'levels.json');
}

/** Validates every loaded level file and builds the campaign. Invalid levels are reported and skipped. */
export function buildLevelManager(scene: Phaser.Scene, enemies: Readonly<Record<string, EnemyDef>>): LevelManager {
  const registry = scene.cache.json.get(REGISTRY_KEY) as LevelRegistry | undefined;
  const files = registry?.levels ?? [];
  if (files.length === 0) console.error('[levels] levels.json is missing or empty');

  const entries: LevelEntry[] = files.map((file, index) => {
    const raw: unknown = scene.cache.json.get(levelKey(file));
    const validation = validateLevel(raw ?? null, Object.keys(BIOMES), enemies);
    for (const issue of validation.issues) {
      (issue.severity === 'error' ? console.error : console.warn)(`[levels] ${file}: ${issue.message}`);
    }
    const data = validation.level ?? null;
    return { index, file, id: data?.id ?? file, name: data?.name ?? file, biome: data?.biome ?? '', data, validation };
  });

  const ids = new Set<string>();
  for (const entry of entries) {
    if (ids.has(entry.id)) {
      console.error(`[levels] ${entry.file}: duplicated id "${entry.id}"`);
      entry.validation = { ...entry.validation, ok: false };
    }
    ids.add(entry.id);
  }

  manager = new LevelManager(entries, localProgressStorage('miniverse.platformer.progress'));
  return manager;
}

export function getLevelManager(): LevelManager {
  if (!manager) throw new Error('Levels not loaded yet');
  return manager;
}

export function releaseLevels(game: Phaser.Game): void {
  const registry = game.cache.json.get(REGISTRY_KEY) as LevelRegistry | undefined;
  for (const file of registry?.levels ?? []) game.cache.json.remove(levelKey(file));
  game.cache.json.remove(REGISTRY_KEY);
  manager = null;
}
