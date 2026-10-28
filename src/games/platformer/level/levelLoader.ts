import type Phaser from 'phaser';
import { BIOME_VARIANTS, BIOMES } from '../biomes';
import type { EnemyDef } from '../enemies/EnemyCatalog';
import { buildCampaign, CampaignManager } from './CampaignManager';
import { type LevelEntry, LevelManager, localProgressStorage } from './LevelManager';
import { clearSandboxLevels } from './sandboxLevels';
import { validateLevel } from './LevelValidator';
import { PLATFORMER_ACCESS } from '../progression/accessPolicy';

/** Campaign definition: public/assets/platformer/levels/levels.json lists level files in order. */
const LEVELS_PATH = 'assets/platformer/levels/';
const REGISTRY_KEY = 'platformer.levels.registry';
const CAMPAIGN_KEY = 'platformer.campaign';
const CAMPAIGN_URL = 'assets/platformer/campaign.json';
const levelKey = (file: string): string => `platformer.level.${file}`;

interface LevelRegistry {
  levels: string[];
  plannedLevels?: string[];
}

let manager: LevelManager | null = null;
let campaign: CampaignManager | null = null;

export function queueLevels(scene: Phaser.Scene): void {
  scene.load.json(CAMPAIGN_KEY, CAMPAIGN_URL);
  scene.load.once(`filecomplete-json-${REGISTRY_KEY}`, (_key: string, _type: string, registry: LevelRegistry) => {
    for (const file of [...(registry.levels ?? []), ...(registry.plannedLevels ?? [])]) scene.load.json(levelKey(file), LEVELS_PATH + file);
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
    const validation = validateLevel(raw ?? null, Object.keys(BIOMES), enemies, BIOME_VARIANTS);
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

/** Builds the chapters from campaign.json on top of the loaded levels. Call after buildLevelManager. */
export function buildCampaignManager(
  scene: Phaser.Scene,
  abilities?: Readonly<Record<string, { levels: readonly unknown[] }>>,
  enemies?: Readonly<Record<string, { boss: boolean }>>,
): CampaignManager {
  const levels = getLevelManager();
  const { chapters, issues, meta } = buildCampaign(scene.cache.json.get(CAMPAIGN_KEY), { levels: levels.levels, biomes: Object.keys(BIOMES), variants: BIOME_VARIANTS, abilities, enemies });
  for (const issue of issues) console.error(`[campaign] ${issue.chapter}: ${issue.message}`);
  campaign = new CampaignManager(chapters, levels, meta, PLATFORMER_ACCESS);
  return campaign;
}

export function getCampaign(): CampaignManager {
  if (!campaign) throw new Error('Campaign not loaded yet');
  return campaign;
}

export function releaseLevels(game: Phaser.Game): void {
  const registry = game.cache.json.get(REGISTRY_KEY) as LevelRegistry | undefined;
  for (const file of [...(registry?.levels ?? []), ...(registry?.plannedLevels ?? [])]) game.cache.json.remove(levelKey(file));
  game.cache.json.remove(REGISTRY_KEY);
  game.cache.json.remove(CAMPAIGN_KEY);
  manager = null;
  campaign = null;
  clearSandboxLevels();
}
