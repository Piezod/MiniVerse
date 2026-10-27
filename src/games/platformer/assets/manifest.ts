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
import { drawAbilityIcon, drawBatFrame, drawDroneFrame, drawElectricDroneFrame, drawGolemFrame, drawGuardianFrame, drawOmegaFrame, drawProjectileFrame, drawSentinelFrame, drawSpitterFrame, drawTechnicianFrame, drawTurretFrame } from './combatArt';

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

/** Temporary art that should be replaced by final sheets (same frame layout). */
export const PLACEHOLDER: AssetCredit = {
  author: 'MiniVerse',
  source: 'PLACEHOLDER - procedural art in src/games/platformer/assets/combatArt.ts',
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
  bat: 'platformer.enemy.bat',
  golem: 'platformer.enemy.golem',
  spitter: 'platformer.enemy.spitter',
  drone: 'platformer.enemy.drone',
  sentinel: 'platformer.enemy.sentinel',
  turret: 'platformer.enemy.turret',
  guardian: 'platformer.enemy.guardian',
  electricDrone: 'platformer.enemy.electric-drone',
  technician: 'platformer.enemy.technician',
  omega: 'platformer.enemy.omega',
  projectiles: 'platformer.projectiles',
  abilityIcons: 'platformer.ability-icons',
} as const;

export const PROJECTILE_FRAME = { beam: 0, fireball: 2 } as const;

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
  beam: { kind: 'audio', key: 'platformer.sfx.beam', credit: SYNTH, fallbackTone: { wave: 'sawtooth', from: 1200, to: 400, duration: 0.12, volume: 0.05 } },
  laser: { kind: 'audio', key: 'platformer.sfx.laser', credit: SYNTH, fallbackTone: { wave: 'sawtooth', from: 1600, to: 200, duration: 0.3, volume: 0.07 } },
  flame: { kind: 'audio', key: 'platformer.sfx.flame', credit: SYNTH, fallbackTone: { wave: 'triangle', from: 120, to: 90, duration: 0.12, volume: 0.12 } },
  enemyHit: { kind: 'audio', key: 'platformer.sfx.enemy-hit', credit: SYNTH, fallbackTone: { wave: 'square', from: 220, to: 150, duration: 0.08, volume: 0.08 } },
  enemyShoot: { kind: 'audio', key: 'platformer.sfx.enemy-shoot', credit: SYNTH, fallbackTone: { wave: 'triangle', from: 500, to: 250, duration: 0.15, volume: 0.1 } },
  clank: { kind: 'audio', key: 'platformer.sfx.clank', credit: SYNTH, fallbackTone: { wave: 'square', from: 900, to: 850, duration: 0.06, volume: 0.06 } },
  jet: { kind: 'audio', key: 'platformer.sfx.jet', credit: SYNTH, fallbackTone: { wave: 'sawtooth', from: 200, to: 500, duration: 0.15, volume: 0.05 } },
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
  // url: 'assets/platformer/enemies/bat.png', etc.
  { kind: 'spritesheet', key: TEX.bat, frameWidth: 16, frameHeight: 16, frameCount: 3, credit: PLACEHOLDER, drawPlaceholder: drawBatFrame },
  { kind: 'spritesheet', key: TEX.golem, frameWidth: 24, frameHeight: 24, frameCount: 4, credit: PLACEHOLDER, drawPlaceholder: drawGolemFrame },
  { kind: 'spritesheet', key: TEX.spitter, frameWidth: 16, frameHeight: 16, frameCount: 3, credit: PLACEHOLDER, drawPlaceholder: drawSpitterFrame },
  { kind: 'spritesheet', key: TEX.drone, frameWidth: 16, frameHeight: 16, frameCount: 4, credit: PLACEHOLDER, drawPlaceholder: drawDroneFrame },
  { kind: 'spritesheet', key: TEX.sentinel, frameWidth: 24, frameHeight: 24, frameCount: 4, credit: PLACEHOLDER, drawPlaceholder: drawSentinelFrame },
  { kind: 'spritesheet', key: TEX.turret, frameWidth: 24, frameHeight: 24, frameCount: 4, credit: PLACEHOLDER, drawPlaceholder: drawTurretFrame },
  { kind: 'spritesheet', key: TEX.guardian, frameWidth: 24, frameHeight: 32, frameCount: 5, credit: PLACEHOLDER, drawPlaceholder: drawGuardianFrame },
  { kind: 'spritesheet', key: TEX.electricDrone, frameWidth: 24, frameHeight: 24, frameCount: 5, credit: PLACEHOLDER, drawPlaceholder: drawElectricDroneFrame },
  { kind: 'spritesheet', key: TEX.technician, frameWidth: 24, frameHeight: 32, frameCount: 5, credit: PLACEHOLDER, drawPlaceholder: drawTechnicianFrame },
  { kind: 'spritesheet', key: TEX.omega, frameWidth: 48, frameHeight: 48, frameCount: 5, credit: PLACEHOLDER, drawPlaceholder: drawOmegaFrame },
  { kind: 'spritesheet', key: TEX.projectiles, frameWidth: 8, frameHeight: 8, frameCount: 4, credit: PLACEHOLDER, drawPlaceholder: drawProjectileFrame },
  { kind: 'spritesheet', key: TEX.abilityIcons, frameWidth: 8, frameHeight: 8, frameCount: 3, credit: PLACEHOLDER, drawPlaceholder: drawAbilityIcon },
  ...Object.values(AUDIO),
];
