import type Phaser from 'phaser';
import type { AssetDef } from './AssetManifest';

/** Queues every asset that has a real file. Call from `preload()`. */
export function queueAssets(scene: Phaser.Scene, assets: readonly AssetDef[]): void {
  for (const asset of assets) {
    switch (asset.kind) {
      case 'spritesheet':
        if (asset.url && !scene.textures.exists(asset.key)) {
          scene.load.spritesheet(asset.key, asset.url, {
            frameWidth: asset.frameWidth,
            frameHeight: asset.frameHeight,
            endFrame: asset.frameCount - 1,
          });
        }
        break;
      case 'image':
        if (asset.url && !scene.textures.exists(asset.key)) scene.load.image(asset.key, asset.url);
        break;
      case 'audio':
        if (asset.urls?.length && !scene.cache.audio.exists(asset.key)) scene.load.audio(asset.key, asset.urls);
        break;
    }
  }
}

/** Generates canvas placeholders for textures that were not loaded from file. Call from `create()`. */
export function createMissingPlaceholders(scene: Phaser.Scene, assets: readonly AssetDef[]): void {
  for (const asset of assets) {
    if (asset.kind === 'audio' || scene.textures.exists(asset.key)) continue;

    const isSheet = asset.kind === 'spritesheet';
    const frames = isSheet ? asset.frameCount : 1;
    const width = isSheet ? asset.frameWidth : asset.width;
    const height = isSheet ? asset.frameHeight : asset.height;
    const texture = scene.textures.createCanvas(asset.key, width * frames, height);
    if (!texture) continue;

    const ctx = texture.getContext();
    ctx.imageSmoothingEnabled = false;
    // Each frame gets its own canvas so draw functions can post-process pixels (outlines, alpha).
    const frameCanvas = document.createElement('canvas');
    frameCanvas.width = width;
    frameCanvas.height = height;
    const frameCtx = frameCanvas.getContext('2d', { willReadFrequently: true });
    if (!frameCtx) continue;
    for (let i = 0; i < frames; i++) {
      frameCtx.setTransform(1, 0, 0, 1, 0, 0);
      frameCtx.globalAlpha = 1;
      frameCtx.globalCompositeOperation = 'source-over';
      frameCtx.clearRect(0, 0, width, height);
      if (isSheet) asset.drawPlaceholder(frameCtx, i, width, height);
      else asset.drawPlaceholder(frameCtx, width, height);
      ctx.drawImage(frameCanvas, i * width, 0);
      // Same frame naming (0..n-1) as a loaded spritesheet, so animations work with either source.
      if (isSheet) texture.add(i, 0, i * width, 0, width, height);
    }
    texture.refresh();
  }
}

export function unloadAssets(game: Phaser.Game, assets: readonly AssetDef[]): void {
  for (const asset of assets) {
    if (asset.kind === 'audio') {
      game.sound.removeByKey(asset.key);
      game.cache.audio.remove(asset.key);
    } else if (game.textures.exists(asset.key)) {
      game.textures.remove(asset.key);
    }
  }
}
