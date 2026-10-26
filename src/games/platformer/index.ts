import { removeAnimations } from '../../core/animation/AnimationRegistry';
import { unloadAssets } from '../../core/assets/AssetLoader';
import type { MiniGameModule } from '../../core/minigame/MiniGame';
import { PLATFORMER_ANIMS } from './assets/animations';
import { unloadHeroSkin } from './assets/heroSkin';
import { PLATFORMER_ASSETS } from './assets/manifest';
import { BIOMES } from './biomes';
import { releaseLevels } from './level/levelLoader';
import { PlatformerHudScene } from './scenes/PlatformerHudScene';
import { PlatformerLevelScene } from './scenes/PlatformerLevelScene';
import { PlatformerLevelSelectScene } from './scenes/PlatformerLevelSelectScene';
import { PlatformerPreloadScene } from './scenes/PlatformerPreloadScene';

export const platformerModule: MiniGameModule = {
  entryScene: PlatformerPreloadScene.KEY,
  scenes: [PlatformerPreloadScene, PlatformerLevelSelectScene, PlatformerLevelScene, PlatformerHudScene],
  unload(game) {
    removeAnimations(game.anims, PLATFORMER_ANIMS);
    unloadAssets(game, PLATFORMER_ASSETS);
    unloadHeroSkin(game);
    releaseLevels(game);
    for (const biome of Object.values(BIOMES)) {
      removeAnimations(game.anims, biome.anims);
      unloadAssets(game, biome.assets);
    }
  },
};
