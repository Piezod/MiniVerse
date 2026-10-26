import type Phaser from 'phaser';

/**
 * Hero skin loaded from public/assets/platformer/spritesheets/hero/hero_manifest.json.
 * Each animation is a horizontal strip PNG; replacing the PNGs/manifest changes the hero's look
 * without touching code. If the manifest is missing, the procedural hero is used instead.
 */
const BASE_PATH = 'assets/platformer/spritesheets/hero/';
const MANIFEST_KEY = 'platformer.hero.manifest';

export interface HeroSkinAnimation {
  file: string;
  frames: number;
  frameRate: number;
  repeat: number;
}

export interface HeroSkinManifest {
  frameWidth: number;
  frameHeight: number;
  /** Pixel inside the frame placed on the ground at the centre of the hitbox (default: bottom centre). */
  anchor?: { x: number; y: number };
  /** Direction the art faces; the game flips it when moving the other way. */
  facing?: 'left' | 'right';
  animations: Record<string, HeroSkinAnimation>;
}

export const heroTextureKey = (animation: string): string => `platformer.hero.${animation}`;
/** Same keys as ANIM.player in animations.ts, so the skin overrides the procedural animations. */
export const heroAnimationKey = (animation: string): string => `platformer.player.${animation}`;

export function queueHeroSkin(scene: Phaser.Scene): void {
  if (scene.cache.json.exists(MANIFEST_KEY)) return;
  scene.load.once(`filecomplete-json-${MANIFEST_KEY}`, (_key: string, _type: string, manifest: HeroSkinManifest) => {
    for (const [name, anim] of Object.entries(manifest.animations)) {
      scene.load.spritesheet(heroTextureKey(name), BASE_PATH + anim.file, {
        frameWidth: manifest.frameWidth,
        frameHeight: manifest.frameHeight,
        endFrame: anim.frames - 1,
      });
    }
  });
  scene.load.json(MANIFEST_KEY, BASE_PATH + 'hero_manifest.json');
}

export function getHeroSkin(scene: Phaser.Scene): HeroSkinManifest | null {
  return (scene.cache.json.get(MANIFEST_KEY) as HeroSkinManifest | undefined) ?? null;
}

/** Creates the player animations from the skin. Returns false when no skin is available. */
export function registerHeroSkin(scene: Phaser.Scene): boolean {
  const skin = getHeroSkin(scene);
  if (!skin) return false;
  for (const [name, anim] of Object.entries(skin.animations)) {
    const texture = heroTextureKey(name);
    const key = heroAnimationKey(name);
    if (!scene.textures.exists(texture) || scene.anims.exists(key)) continue;
    scene.anims.create({
      key,
      frames: scene.anims.generateFrameNumbers(texture, { start: 0, end: anim.frames - 1 }),
      frameRate: anim.frameRate,
      repeat: anim.repeat,
    });
  }
  return true;
}

export function unloadHeroSkin(game: Phaser.Game): void {
  const skin = game.cache.json.get(MANIFEST_KEY) as HeroSkinManifest | undefined;
  if (!skin) return;
  for (const name of Object.keys(skin.animations)) {
    game.anims.remove(heroAnimationKey(name));
    if (game.textures.exists(heroTextureKey(name))) game.textures.remove(heroTextureKey(name));
  }
  game.cache.json.remove(MANIFEST_KEY);
}
