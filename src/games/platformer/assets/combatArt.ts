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

export function drawTurretFrame(ctx: Ctx, frame: number, w: number, h: number): void {
  if (frame === 3) {
    px(ctx, P.metalDark, 3, 19, 18, 5);
    px(ctx, P.metal, 8, 16, 8, 4);
    px(ctx, P.heart, 10, 19, 3, 1);
  } else {
    px(ctx, P.metalDark, 3, 20, 18, 4);
    px(ctx, P.metalLight, 4, 20, 16, 1);
    px(ctx, P.metal, 9, 15, 7, 5);
    px(ctx, P.metalDark, 6, 6, 15, 11);
    px(ctx, P.metalLight, 7, 6, 13, 2);
    px(ctx, P.goldDark, 16, 9, 4, 5);
    px(ctx, P.metal, 1, 10, 12, 4);
    px(ctx, P.outline, 0, 11, 3, 2);
    px(ctx, frame === 2 ? P.heart : P.glow, 7, 9, 3, 2);
    px(ctx, frame === 1 ? P.gold : P.glowDark, 18, 4, 2, 1);
    if (frame === 2) px(ctx, P.goldLight, 0, 9, 2, 6);
  }
  finish(ctx, w, h);
}

export function drawGuardianFrame(ctx: Ctx, frame: number, w: number, h: number): void {
  if (frame === 3) {
    px(ctx, P.metalDark, 3, 25, 18, 7);
    px(ctx, P.goldDark, 4, 24, 6, 5);
    px(ctx, P.heart, 13, 26, 3, 2);
  } else {
    const stride = frame === 1 ? 2 : 0;
    px(ctx, P.metalDark, 6 + stride, 23, 5, 9);
    px(ctx, P.metalDark, 15 - stride, 23, 5, 9);
    px(ctx, P.metal, 6, 10, 14, 15);
    px(ctx, P.metalLight, 7, 10, 12, 3);
    px(ctx, P.metalDark, 8, 2, 11, 9);
    px(ctx, P.metalLight, 9, 2, 9, 2);
    px(ctx, frame === 2 ? P.heart : P.glow, 8, 6, 7, 2);
    const shieldY = frame === 4 ? 24 : 12;
    const shieldHeight = frame === 4 ? 7 : 16;
    px(ctx, P.goldDark, 1, shieldY, 6, shieldHeight);
    px(ctx, P.gold, 2, shieldY + 1, 3, shieldHeight - 2);
    px(ctx, P.outline, 2, shieldY + 3, 4, 2);
    px(ctx, frame === 2 ? P.heart : P.glow, 12, 16, 4, 4);
    if (frame === 4) px(ctx, P.white, 13, 17, 2, 2);
    if (frame === 2) px(ctx, P.goldLight, 0, 13, 2, 12);
  }
  finish(ctx, w, h);
}

export function drawElectricDroneFrame(ctx: Ctx, frame: number, w: number, h: number): void {
  if (frame === 3) {
    px(ctx, P.metalDark, 4, 18, 16, 5);
    px(ctx, '#7fe3ff', 9, 18, 3, 1);
  } else {
    px(ctx, P.metalDark, 6, 6, 12, 12);
    px(ctx, P.metalLight, 7, 6, 10, 2);
    px(ctx, '#2a7a90', 2, 5, 3, 14);
    px(ctx, '#2a7a90', 19, 5, 3, 14);
    const color = frame === 2 ? P.heart : frame === 4 ? '#315663' : '#7fe3ff';
    px(ctx, color, 3, frame === 1 ? 8 : 6, 1, 10);
    px(ctx, color, 20, frame === 1 ? 6 : 8, 1, 10);
    px(ctx, color, 8, 10, 8, 5);
    px(ctx, P.outline, 8, 12, 3, 1);
    if (frame === 2) px(ctx, P.white, 1, 11, 5, 2);
  }
  finish(ctx, w, h);
}

export function drawTechnicianFrame(ctx: Ctx, frame: number, w: number, h: number): void {
  if (frame === 3) {
    px(ctx, '#384846', 4, 26, 16, 6);
    px(ctx, '#78b29d', 8, 24, 8, 3);
  } else {
    const stride = frame === 1 ? 1 : 0;
    px(ctx, '#384846', 7 + stride, 23, 4, 9);
    px(ctx, '#384846', 14 - stride, 23, 4, 9);
    px(ctx, '#52856f', 6, 12, 13, 14);
    px(ctx, '#a0d4b8', 7, 13, 9, 2);
    fillEllipse(ctx, 12, 7, 6, 5, '#78b29d');
    px(ctx, '#78b29d', 5, 6, 3, 2);
    px(ctx, '#78b29d', 17, 6, 3, 2);
    px(ctx, P.outline, 7, 6, 8, 2);
    px(ctx, frame === 2 ? P.heart : '#c86bff', 7, 7, 5, 1);
    const raised = frame !== 4;
    px(ctx, '#40395e', 1, raised ? 16 : 24, 8, 5);
    px(ctx, frame === 2 ? P.white : '#c86bff', 2, raised ? 17 : 25, 4, 2);
    px(ctx, '#40395e', 18, 14, 3, 10);
  }
  finish(ctx, w, h);
}

export function drawOmegaFrame(ctx: Ctx, frame: number, w: number, h: number): void {
  if (frame === 3) {
    px(ctx, P.metalDark, 5, 37, 38, 11);
    px(ctx, '#94384b', 10, 34, 25, 9);
    px(ctx, P.glow, 22, 38, 5, 3);
  } else {
    const shift = frame === 1 ? 1 : 0;
    px(ctx, P.metalDark, 11 + shift, 32, 10, 16);
    px(ctx, P.metalDark, 28 - shift, 32, 10, 16);
    px(ctx, '#94384b', 8, 15, 33, 22);
    px(ctx, '#df6771', 10, 15, 29, 3);
    px(ctx, P.metalDark, 3, 13, 9, 20);
    px(ctx, P.metalDark, 38, 13, 8, 20);
    px(ctx, P.gold, 4, 14, 6, 4);
    px(ctx, P.gold, 39, 14, 5, 4);
    px(ctx, P.metalDark, 13, 3, 23, 12);
    px(ctx, P.metalLight, 15, 3, 19, 3);
    px(ctx, frame === 2 ? P.heart : P.goldLight, 13, 9, 17, 3);
    px(ctx, P.outline, 17, 20, 17, 13);
    px(ctx, frame === 4 ? P.glow : P.heart, 21, 22, 9, 9);
    px(ctx, frame === 4 ? P.white : P.gold, 23, 24, 5, 5);
    if (frame === 2) px(ctx, P.heart, 0, 23, 7, 4);
  }
  finish(ctx, w, h);
}
