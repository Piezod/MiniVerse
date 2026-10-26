import type { AssetCredit, AssetDef, AudioAsset } from '../../../core/assets/AssetManifest';
import {
  drawCheckpointFrame,
  drawFxFrame,
  drawGlow,
  drawHeroFrame,
  drawPortalFrame,
  drawStarFrame,
  drawUiFrame,
  drawWalkerFrame,
} from './actors';

/**
 * World-independent assets (characters, items, FX, UI, sounds). World assets live in worlds/<id>/.
 * To replace a placeholder: put the file in public/assets/platformer/<folder>/, set `url`,
 * update `credit`, and keep the frame size/order documented in animations.ts.
 */
export const PROCEDURAL: AssetCredit = {
  author: 'MiniVerse',
  source: 'Procedural pixel art generated in code (src/games/platformer)',
  license: 'Original, project-owned',
};

const SYNTH: AssetCredit = {
  author: 'MiniVerse',
  source: 'Web Audio synthesized placeholder (src/core/audio/Sfx.ts)',
  license: 'Original, project-owned',
};

export const TEX = {
  player: 'platformer.player',
  walker: 'platformer.walker',
  star: 'platformer.star',
  checkpoint: 'platformer.checkpoint',
  portal: 'platformer.portal',
  fx: 'platformer.fx',
  glow: 'platformer.fx.glow',
  ui: 'platformer.ui',
} as const;

/** Frame indices inside TEX.fx and TEX.ui. */
export const FX_FRAME = { pixel: 0, square: 1, sparkle: 2, dust: 3, ring: 4 } as const;
export const UI_FRAME = { star: 0, heart: 1, heartEmpty: 2, pause: 3, soundOn: 4, soundOff: 5 } as const;

export const AUDIO = {
  jump: { kind: 'audio', key: 'platformer.sfx.jump', credit: SYNTH, fallbackTone: { wave: 'square', from: 320, to: 640, duration: 0.12, volume: 0.06 } },
  star: { kind: 'audio', key: 'platformer.sfx.star', credit: SYNTH, fallbackTone: { wave: 'square', from: 880, to: 1760, duration: 0.1, volume: 0.06 } },
  stomp: { kind: 'audio', key: 'platformer.sfx.stomp', credit: SYNTH, fallbackTone: { wave: 'triangle', from: 300, to: 80, duration: 0.15, volume: 0.2 } },
  hurt: { kind: 'audio', key: 'platformer.sfx.hurt', credit: SYNTH, fallbackTone: { wave: 'sawtooth', from: 440, to: 110, duration: 0.35, volume: 0.08 } },
  checkpoint: { kind: 'audio', key: 'platformer.sfx.checkpoint', credit: SYNTH, fallbackTone: { wave: 'sine', from: 523, to: 1046, duration: 0.25, volume: 0.15 } },
  victory: { kind: 'audio', key: 'platformer.sfx.victory', credit: SYNTH, fallbackTone: { wave: 'square', from: 523, to: 1568, duration: 0.5, volume: 0.06 } },
} satisfies Record<string, AudioAsset>;

export const PLATFORMER_ASSETS: readonly AssetDef[] = [
  {
    kind: 'spritesheet',
    key: TEX.player,
    // url: 'assets/platformer/spritesheets/hero.png',
    frameWidth: 32,
    frameHeight: 32,
    frameCount: 20,
    credit: PROCEDURAL,
    drawPlaceholder: drawHeroFrame,
  },
  { kind: 'spritesheet', key: TEX.walker, frameWidth: 16, frameHeight: 16, frameCount: 4, credit: PROCEDURAL, drawPlaceholder: drawWalkerFrame },
  { kind: 'spritesheet', key: TEX.star, frameWidth: 16, frameHeight: 16, frameCount: 4, credit: PROCEDURAL, drawPlaceholder: drawStarFrame },
  { kind: 'spritesheet', key: TEX.checkpoint, frameWidth: 16, frameHeight: 32, frameCount: 2, credit: PROCEDURAL, drawPlaceholder: drawCheckpointFrame },
  { kind: 'spritesheet', key: TEX.portal, frameWidth: 32, frameHeight: 32, frameCount: 4, credit: PROCEDURAL, drawPlaceholder: drawPortalFrame },
  { kind: 'spritesheet', key: TEX.fx, frameWidth: 8, frameHeight: 8, frameCount: 5, credit: PROCEDURAL, drawPlaceholder: drawFxFrame },
  { kind: 'spritesheet', key: TEX.ui, frameWidth: 8, frameHeight: 8, frameCount: 6, credit: PROCEDURAL, drawPlaceholder: drawUiFrame },
  { kind: 'image', key: TEX.glow, width: 32, height: 32, credit: PROCEDURAL, drawPlaceholder: drawGlow },
  ...Object.values(AUDIO),
];
