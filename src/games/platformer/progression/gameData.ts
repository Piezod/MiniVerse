import type Phaser from 'phaser';
import { type AbilityCatalog, buildAbilityCatalog } from '../abilities/AbilityCatalog';
import { ABILITY_MODULE_IDS } from '../abilities/moduleIds';
import { ENEMY_SPRITES } from '../assets/enemySprites';
import { buildEnemyCatalog, type EnemyCatalog } from '../enemies/EnemyCatalog';
import { localProgressStorage } from '../level/LevelManager';
import { Profile } from './Profile';

/** Gameplay configuration files in public/assets/platformer/ (editable without touching code). */
const ENEMIES = { key: 'platformer.data.enemies', url: 'assets/platformer/enemies/enemies.json' };
const ABILITIES = { key: 'platformer.data.abilities', url: 'assets/platformer/abilities/abilities.json' };

interface GameData {
  enemies: EnemyCatalog;
  abilities: AbilityCatalog;
  profile: Profile;
}

let data: GameData | null = null;

export function queueGameData(scene: Phaser.Scene): void {
  scene.load.json(ENEMIES.key, ENEMIES.url);
  scene.load.json(ABILITIES.key, ABILITIES.url);
}

export function buildGameData(scene: Phaser.Scene): GameData {
  const enemies = buildEnemyCatalog(scene.cache.json.get(ENEMIES.key), Object.keys(ENEMY_SPRITES));
  const abilities = buildAbilityCatalog(scene.cache.json.get(ABILITIES.key), ABILITY_MODULE_IDS);
  for (const issue of enemies.issues) console.error(`[enemies] ${issue.id}: ${issue.message}`);
  for (const issue of abilities.issues) console.error(`[abilities] ${issue.id}: ${issue.message}`);
  data = { enemies, abilities, profile: new Profile(abilities, localProgressStorage('miniverse.platformer.profile')) };
  return data;
}

export function getGameData(): GameData {
  if (!data) throw new Error('Game data not loaded yet');
  return data;
}

export function releaseGameData(game: Phaser.Game): void {
  game.cache.json.remove(ENEMIES.key);
  game.cache.json.remove(ABILITIES.key);
  data = null;
}
