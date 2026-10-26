import type { MiniGameInfo } from './MiniGame';

const games = new Map<string, MiniGameInfo>();

export function registerMiniGame(info: MiniGameInfo): void {
  if (games.has(info.id)) throw new Error(`Minigame "${info.id}" is already registered`);
  games.set(info.id, info);
}

export function getMiniGames(): MiniGameInfo[] {
  return [...games.values()];
}
