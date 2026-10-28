import type Phaser from 'phaser';
import { type AbilityCatalog, buildAbilityCatalog } from '../abilities/AbilityCatalog';
import { ABILITY_MODULE_IDS, PLANNED_MODULE_IDS } from '../abilities/moduleIds';
import { ENEMY_SPRITES } from '../assets/enemySprites';
import { buildElementChart, type ElementChart } from '../combat/elements';
import { buildStatusCatalog, type StatusCatalog } from '../combat/status';
import { buildEnemyCatalog, type EnemyCatalog } from '../enemies/EnemyCatalog';
import { localProgressStorage } from '../level/LevelManager';
import { Profile } from './Profile';
import { PLATFORMER_ACCESS } from './accessPolicy';

/** Gameplay configuration files in public/assets/platformer/ (editable without touching code). */
const FILES = {
  elements: { key: 'platformer.data.elements', url: 'assets/platformer/combat/elements.json' },
  statuses: { key: 'platformer.data.statuses', url: 'assets/platformer/combat/status-effects.json' },
  enemies: { key: 'platformer.data.enemies', url: 'assets/platformer/enemies/enemies.json' },
  abilities: { key: 'platformer.data.abilities', url: 'assets/platformer/abilities/abilities.json' },
};

interface GameData {
  chart: ElementChart;
  statuses: StatusCatalog;
  enemies: EnemyCatalog;
  abilities: AbilityCatalog;
  profile: Profile;
}

export interface RawGameData {
  elements: unknown;
  statuses: unknown;
  enemies: unknown;
  abilities: unknown;
}

let data: GameData | null = null;

export function queueGameData(scene: Phaser.Scene): void {
  for (const file of Object.values(FILES)) scene.load.json(file.key, file.url);
}

/** Builds and cross-validates every catalog (Phaser-free, shared with tests). */
export function buildCatalogs(raw: RawGameData): Omit<GameData, 'profile'> & { issues: string[] } {
  const elements = buildElementChart(raw.elements);
  const elementIds = Object.keys(elements.chart.elements);
  const statuses = buildStatusCatalog(raw.statuses, elementIds);
  const statusIds = Object.keys(statuses.effects);
  const enemies = buildEnemyCatalog(raw.enemies, Object.keys(ENEMY_SPRITES), { elements: elementIds, statuses: statusIds });
  const abilities = buildAbilityCatalog(raw.abilities, ABILITY_MODULE_IDS, { elements: elementIds, statuses: statusIds, plannedModules: PLANNED_MODULE_IDS });
  const issues = [
    ...elements.issues.map((i) => `[elements] ${i.message}`),
    ...statuses.issues.map((i) => `[status] ${i.id}: ${i.message}`),
    ...enemies.issues.map((i) => `[enemies] ${i.id}: ${i.message}`),
    ...abilities.issues.map((i) => `[abilities] ${i.id}: ${i.message}`),
  ];
  return { chart: elements.chart, statuses, enemies, abilities, issues };
}

export function buildGameData(scene: Phaser.Scene): GameData {
  const json = (file: { key: string }): unknown => scene.cache.json.get(file.key);
  const { issues, ...catalogs } = buildCatalogs({
    elements: json(FILES.elements),
    statuses: json(FILES.statuses),
    enemies: json(FILES.enemies),
    abilities: json(FILES.abilities),
  });
  for (const issue of issues) console.error(issue);
  data = { ...catalogs, profile: new Profile(catalogs.abilities, localProgressStorage('miniverse.platformer.profile'), PLATFORMER_ACCESS) };
  return data;
}

export function getGameData(): GameData {
  if (!data) throw new Error('Game data not loaded yet');
  return data;
}

export function releaseGameData(game: Phaser.Game): void {
  for (const file of Object.values(FILES)) game.cache.json.remove(file.key);
  data = null;
}
