/**
 * PLACEHOLDER art for combat content (enemies, projectiles, ability icons). Original procedural
 * pixel art in the shared palette; replace with real sheets keeping the documented frame layouts.
 */
import { addOutline, type Ctx, fillCircle, fillEllipse, hardenAlpha, px } from '../../../core/art/pixel';
import { PALETTE as P } from './palette';

const finish = (ctx: Ctx, w: number, h: number): void => {
  hardenAlpha(ctx, w, h);
  addOutline(ctx, w, h, P.outline);
};

/** Bat 16x16, faces left: 0 wings up | 1 wings down | 2 folded (death). */
export function drawBatFrame(ctx: Ctx, frame: number, w: number, h: number): void {
  const body = '#4a3f8a';
  const wing = '#6a5ab8';
  fillEllipse(ctx, 8, 9, 3, 3, body);
  px(ctx, body, 6, 4, 1, 2);
  px(ctx, body, 9, 4, 1, 2);
  if (frame === 0) {
    for (let i = 0; i < 5; i++) px(ctx, wing, 1 + i, 4 + Math.floor(i / 2), 1, 4 - Math.floor(i / 2));
    for (let i = 0; i < 5; i++) px(ctx, wing, 14 - i, 4 + Math.floor(i / 2), 1, 4 - Math.floor(i / 2));
  } else if (frame === 1) {
    for (let i = 0; i < 5; i++) px(ctx, wing, 1 + i, 9, 1, 2 + Math.floor(i / 2));
    for (let i = 0; i < 5; i++) px(ctx, wing, 14 - i, 9, 1, 2 + Math.floor(i / 2));
  } else {
    px(ctx, wing, 5, 7, 2, 6);
    px(ctx, wing, 10, 7, 2, 6);
  }
  px(ctx, P.heart, 6, 8, 1, 1);
  px(ctx, P.heart, 9, 8, 1, 1);
  px(ctx, P.white, 7, 11, 1, 1);
  finish(ctx, w, h);
}

/** Golem 24x24, faces left: 0-1 walk | 2 guard/attack | 3 rubble (death). */
export function drawGolemFrame(ctx: Ctx, frame: number, w: number, h: number): void {
  if (frame === 3) {
    fillEllipse(ctx, 7, 20, 4, 3, P.stoneDark);
    fillEllipse(ctx, 15, 21, 5, 2, P.stone);
    fillEllipse(ctx, 11, 18, 3, 2, P.stoneLight);
    finish(ctx, w, h);
    return;
  }
  const step = frame === 1 ? 1 : 0;
  px(ctx, P.stoneDark, 6 + step, 19, 4, 5);
  px(ctx, P.stoneDark, 14 - step, 19, 4, 5);
  px(ctx, P.stone, 4, 7, 16, 13);
  px(ctx, P.stoneLight, 5, 7, 14, 2);
  px(ctx, P.stoneDark, 4, 17, 16, 2);
  px(ctx, P.moss, 6, 6, 8, 2);
  px(ctx, P.mossLight, 8, 6, 3, 1);
  // Glowing core and eye (faces left).
  px(ctx, P.glowDark, 9, 11, 4, 4);
  px(ctx, P.glow, 10, 12, 2, 2);
  px(ctx, P.goldLight, 5, 9, 3, 2);
  if (frame === 2) {
    // Arms raised as a shield in front.
    px(ctx, P.stoneDark, 0, 5, 4, 12);
    px(ctx, P.stoneLight, 1, 6, 2, 10);
  } else {
    px(ctx, P.stoneDark, 1, 10, 3, 8);
    px(ctx, P.stoneDark, 20, 10, 3, 8);
  }
  finish(ctx, w, h);
}

/** Spitter 16x16 (lava vent plant), faces left: 0 closed | 1 open (shooting) | 2 withered (death). */
export function drawSpitterFrame(ctx: Ctx, frame: number, w: number, h: number): void {
  px(ctx, P.stoneDark, 3, 13, 10, 3);
  px(ctx, P.stone, 4, 12, 8, 2);
  if (frame === 2) {
    px(ctx, '#6a4a3a', 6, 8, 4, 4);
    finish(ctx, w, h);
    return;
  }
  px(ctx, P.moss, 7, 6, 2, 6);
  fillCircle(ctx, 7, 6, 4, '#c84a3a');
  px(ctx, '#ff7a45', 5, 3, 4, 2);
  if (frame === 1) {
    px(ctx, P.outline, 2, 5, 4, 3);
    px(ctx, P.gold, 3, 6, 2, 1);
  } else {
    px(ctx, P.outline, 3, 6, 3, 1);
  }
  finish(ctx, w, h);
}

/** Projectiles 8x8: 0-1 energy beam bolt | 2-3 enemy fireball. */
export function drawProjectileFrame(ctx: Ctx, frame: number, w: number, h: number): void {
  if (frame < 2) {
    px(ctx, P.glowDark, 0, 3, 8, 2);
    px(ctx, P.glow, 1 + frame, 3, 6 - frame, 2);
    px(ctx, P.white, 4, 3, 3, 1);
    return;
  }
  fillCircle(ctx, 4, 4, 2 + (frame - 2), '#ff7a45');
  px(ctx, P.gold, 3, 3, 2, 2);
  hardenAlpha(ctx, w, h);
}

/** Ability icons 8x8: 0 jetpack | 1 energy beam | 2 flamethrower. */
export function drawAbilityIcon(ctx: Ctx, frame: number, w: number, h: number): void {
  switch (frame) {
    case 0:
      px(ctx, P.metalLight, 2, 0, 4, 4);
      px(ctx, P.metal, 2, 3, 4, 1);
      px(ctx, '#ff7a45', 2, 4, 1, 2);
      px(ctx, '#ff7a45', 5, 4, 1, 2);
      px(ctx, P.gold, 2, 6, 1, 1);
      px(ctx, P.gold, 5, 6, 1, 1);
      break;
    case 1:
      px(ctx, P.glow, 4, 0, 2, 3);
      px(ctx, P.glow, 2, 3, 4, 1);
      px(ctx, P.glow, 2, 4, 2, 3);
      px(ctx, P.white, 4, 1, 1, 1);
      break;
    case 2:
      fillCircle(ctx, 4, 4, 3, '#ff7a45');
      px(ctx, P.gold, 3, 3, 2, 3);
      px(ctx, P.goldLight, 3, 5, 1, 1);
      break;
  }
  addOutline(ctx, w, h, P.outline);
}

/** Scout drone 16x16 (faces left): 0-1 hover (rotor) | 2 charging (red eye) | 3 wreck (death). */
export function drawDroneFrame(ctx: Ctx, frame: number, w: number, h: number): void {
  if (frame === 3) {
    px(ctx, P.metalDark, 4, 11, 8, 3);
    px(ctx, P.metal, 5, 10, 5, 2);
    px(ctx, P.heart, 9, 11, 1, 1);
    px(ctx, P.metalLight, 3, 13, 2, 1);
    finish(ctx, w, h);
    return;
  }
  const rotor = frame === 1 ? 1 : 0;
  px(ctx, P.metalDark, 7, 3, 2, 2);
  px(ctx, P.metalLight, 2 + rotor, 2, 5, 1);
  px(ctx, P.metalLight, 9 - rotor, 2, 5, 1);
  fillEllipse(ctx, 8, 8, 5, 4, P.metal);
  px(ctx, P.metalLight, 5, 5, 6, 1);
  px(ctx, P.glow, 10, 6, 3, 1);
  px(ctx, P.metalDark, 4, 10, 8, 2);
  px(ctx, P.outline, 3, 7, 5, 3);
  const eye = frame === 2 ? P.heart : P.glow;
  px(ctx, eye, 4, 8, 3, 1);
  if (frame === 2) px(ctx, P.white, 5, 8, 1, 1);
  px(ctx, P.goldDark, 10, 8, 2, 1);
  finish(ctx, w, h);
}

/** Sentinel drone 24x24 (faces left): 0-1 hover | 2 firing (muzzle glow) | 3 wreck (death). */
export function drawSentinelFrame(ctx: Ctx, frame: number, w: number, h: number): void {
  if (frame === 3) {
    fillEllipse(ctx, 12, 19, 7, 3, P.metalDark);
    px(ctx, P.metal, 7, 16, 8, 3);
    px(ctx, P.heart, 14, 17, 2, 2);
    px(ctx, P.metalLight, 4, 20, 3, 1);
    finish(ctx, w, h);
    return;
  }
  const bob = frame === 1 ? 1 : 0;
  fillEllipse(ctx, 12, 11 + bob, 9, 6, P.metal);
  px(ctx, P.metalLight, 6, 6 + bob, 12, 2);
  px(ctx, P.goldDark, 15, 8 + bob, 5, 6);
  px(ctx, P.goldLight, 17, 9 + bob, 2, 3);
  px(ctx, P.metalDark, 5, 14 + bob, 14, 2);
  px(ctx, P.gold, 4, 11 + bob, 2, 2);
  px(ctx, P.gold, 18, 11 + bob, 2, 2);
  // Visor (faces left) and under-slung cannon.
  px(ctx, P.outline, 4, 9 + bob, 8, 4);
  px(ctx, frame === 2 ? P.heart : P.glow, 5, 10 + bob, 5, 2);
  px(ctx, P.metalDark, 2, 16 + bob, 7, 3);
  px(ctx, P.outline, 1, 17 + bob, 3, 1);
  if (frame === 2) {
    px(ctx, P.goldLight, 0, 16 + bob, 2, 3);
    px(ctx, P.white, 0, 17 + bob, 1, 1);
  }
  px(ctx, P.metalDark, 10, 3 + bob, 4, 3);
  px(ctx, P.metalLight, 6, 3 + bob, 4, 1);
  px(ctx, P.metalLight, 14, 3 + bob, 4, 1);
  finish(ctx, w, h);
}
