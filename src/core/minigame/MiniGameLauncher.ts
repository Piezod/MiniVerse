import type Phaser from 'phaser';
import { SceneKeys } from '../config';
import type { MiniGameInfo, MiniGameModule } from './MiniGame';

let active: MiniGameModule | null = null;
let pendingRelease: MiniGameModule | null = null;

export async function launchMiniGame(from: Phaser.Scene, info: MiniGameInfo): Promise<void> {
  const module = await info.load();
  const manager = from.game.scene;
  for (const SceneClass of module.scenes) {
    if (!manager.keys[SceneClass.KEY]) manager.add(SceneClass.KEY, SceneClass, false);
  }
  active = module;
  from.scene.start(module.entryScene);
}

/** Stops every scene of the running minigame and returns to the main menu. */
export function exitToMenu(from: Phaser.Scene): void {
  const manager = from.game.scene;
  if (active) {
    for (const { KEY } of active.scenes) {
      if (KEY === from.sys.settings.key) continue;
      if (manager.isActive(KEY) || manager.isPaused(KEY) || manager.isSleeping(KEY)) manager.stop(KEY);
    }
    pendingRelease = active;
    active = null;
  }
  from.scene.start(SceneKeys.MainMenu);
}

/** Called by the menu once the previous minigame scenes are fully shut down. */
export function releasePendingMiniGame(game: Phaser.Game): void {
  pendingRelease?.unload?.(game);
  pendingRelease = null;
}
