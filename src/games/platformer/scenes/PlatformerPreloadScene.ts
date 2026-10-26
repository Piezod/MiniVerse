import Phaser from 'phaser';
import { createMissingPlaceholders, queueAssets } from '../../../core/assets/AssetLoader';
import { registerAnimations } from '../../../core/animation/AnimationRegistry';
import { GAME_HEIGHT, GAME_WIDTH } from '../../../core/config';
import { ensurePixelFont } from '../../../core/ui/pixelFont';
import { PLATFORMER_ANIMS } from '../assets/animations';
import { queueHeroSkin, registerHeroSkin } from '../assets/heroSkin';
import { PLATFORMER_ASSETS } from '../assets/manifest';
import { BIOMES } from '../biomes';
import { PlatformerScenes } from '../config';
import { buildLevelManager, queueLevels } from '../level/levelLoader';

export class PlatformerPreloadScene extends Phaser.Scene {
  static readonly KEY = PlatformerScenes.Preload;

  constructor() {
    super(PlatformerPreloadScene.KEY);
  }

  preload(): void {
    this.cameras.main.setBackgroundColor('#151634');
    const barWidth = 160;
    const x = (GAME_WIDTH - barWidth) / 2;
    const y = GAME_HEIGHT / 2;
    this.add.rectangle(x, y, barWidth, 4, 0x2b2552).setOrigin(0, 0.5);
    const bar = this.add.rectangle(x, y, 0, 4, 0xffd56b).setOrigin(0, 0.5);
    this.load.on(Phaser.Loader.Events.PROGRESS, (value: number) => (bar.width = barWidth * value));

    queueAssets(this, PLATFORMER_ASSETS);
    queueHeroSkin(this);
    queueLevels(this);
    // Only biome files with a real `url` are downloaded; the rest is generated when a level starts.
    for (const biome of Object.values(BIOMES)) queueAssets(this, biome.assets);
  }

  create(): void {
    ensurePixelFont(this);
    createMissingPlaceholders(this, PLATFORMER_ASSETS);
    // The hero skin goes first; procedural animations only fill in the keys it doesn't define.
    registerHeroSkin(this);
    registerAnimations(this.anims, PLATFORMER_ANIMS);
    buildLevelManager(this);
    this.scene.start(PlatformerScenes.LevelSelect);
  }
}
