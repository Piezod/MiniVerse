import { registerMiniGame } from '../core/minigame/GameRegistry';

/** Single place where minigames are listed. Each `load` is a dynamic import, so games are code-split. */
export function registerGames(): void {
  registerMiniGame({
    id: 'platformer',
    title: 'Aventuras Pixel',
    description: 'Plataformas en el bosque mecanico',
    accentColor: 0x4c9a50,
    load: () => import('./platformer').then((m) => m.platformerModule),
  });
}
