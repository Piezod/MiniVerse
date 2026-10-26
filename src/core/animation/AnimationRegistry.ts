import type Phaser from 'phaser';

/**
 * Data-driven animation definition. Frame indices refer to the spritesheet grid (row-major),
 * so replacing a placeholder with a real spritesheet only requires updating these numbers.
 */
export interface AnimationDef {
  key: string;
  texture: string;
  frames: number[];
  frameRate: number;
  /** -1 loops forever (default), 0 plays once. */
  repeat?: number;
}

export function registerAnimations(anims: Phaser.Animations.AnimationManager, defs: readonly AnimationDef[]): void {
  for (const def of defs) {
    if (anims.exists(def.key)) continue;
    anims.create({
      key: def.key,
      frames: anims.generateFrameNumbers(def.texture, { frames: def.frames }),
      frameRate: def.frameRate,
      repeat: def.repeat ?? -1,
    });
  }
}

export function removeAnimations(anims: Phaser.Animations.AnimationManager, defs: readonly AnimationDef[]): void {
  for (const def of defs) anims.remove(def.key);
}
