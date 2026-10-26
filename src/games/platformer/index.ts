import { removeAnimations } from '../../core/animation/AnimationRegistry';
import { unloadAssets } from '../../core/assets/AssetLoader';
import type { MiniGameModule } from '../../core/minigame/MiniGame';
import { PLATFORMER_ANIMS } from './assets/animations';
import { ENEMY_ANIMS, PROJECTILE_ANIMS } from './assets/enemySprites';
import { unloadHeroSkin } from './assets/heroSkin';
import { PLATFORMER_ASSETS } from './assets/manifest';
import { BIOMES } from './biomes';
import { releaseLevels } from './level/levelLoader';
import { releaseGameData } from './progression/gameData';
import { PlatformerAffinityScene } from './scenes/PlatformerAffinityScene';
import { PlatformerHudScene } from './scenes/PlatformerHudScene';
import { PlatformerLevelScene } from './scenes/PlatformerLevelScene';
import { PlatformerLevelSelectScene } from './scenes/PlatformerLevelSelectScene';
import { PlatformerPreloadScene } from './scenes/PlatformerPreloadScene';
import { PlatformerShopScene } from './scenes/PlatformerShopScene';

export const platformerModule: MiniGameModule = {
  entryScene: PlatformerPreloadScene.KEY,
  scenes: [PlatformerPreloadScene, PlatformerLevelSelectScene, PlatformerShopScene, PlatformerAffinityScene, PlatformerLevelScene, PlatformerHudScene],
  unload(game) {
    removeAnimations(game.anims, PLATFORMER_ANIMS);
    removeAnimations(game.anims, ENEMY_ANIMS);
    removeAnimations(game.anims, PROJECTILE_ANIMS);
    unloadAssets(game, PLATFORMER_ASSETS);
    unloadHeroSkin(game);
    releaseLevels(game);
    releaseGameData(game);
    for (const biome of Object.values(BIOMES)) {
      removeAnimations(game.anims, biome.anims);
      unloadAssets(game, biome.assets);
    }
  },
};
