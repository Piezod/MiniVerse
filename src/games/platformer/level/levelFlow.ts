import type Phaser from 'phaser';
import { PlatformerScenes } from '../config';

export interface LevelSceneData {
  levelId: string;
}

/** Fades out the running level (if any) and starts another level. */
export function startLevel(from: Phaser.Scene, levelId: string): void {
  withFadeOut(from, () => {
    from.scene.stop(PlatformerScenes.Hud);
    from.scene.start(PlatformerScenes.Level, { levelId } satisfies LevelSceneData);
  });
}

export function openLevelSelect(from: Phaser.Scene): void {
  withFadeOut(from, () => {
    from.scene.stop(PlatformerScenes.Level);
    from.scene.stop(PlatformerScenes.Hud);
    from.scene.start(PlatformerScenes.LevelSelect);
  });
}

function withFadeOut(from: Phaser.Scene, done: () => void): void {
  const level = from.scene.get(PlatformerScenes.Level);
  // A paused scene doesn't update its camera effects, so only fade a running level.
  if (!level || !level.sys.isActive()) {
    done();
    return;
  }
  level.cameras.main.fadeOut(250, 12, 11, 28);
  level.cameras.main.once('camerafadeoutcomplete', done);
}
