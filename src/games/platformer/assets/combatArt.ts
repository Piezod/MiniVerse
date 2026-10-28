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

/** NÉXAR bat 16x16, faces left: 0-1 wingbeat | 2 dive | 3 severed tendrils (death). */
export function drawNexarBatFrame(ctx: Ctx, frame: number, w: number, h: number): void {
  if (frame === 3) {
    px(ctx, '#315047', 5, 10, 7, 3);
    px(ctx, '#8fc778', 7, 9, 2, 1);
    px(ctx, '#315047', 3, 13, 3, 1);
    px(ctx, '#315047', 11, 12, 3, 1);
    finish(ctx, w, h);
    return;
  }
  const dive = frame === 2;
  const wingY = dive ? 8 : frame === 1 ? 10 : 4;
  px(ctx, '#28483f', 6, 6, 5, 6);
  px(ctx, '#477a59', 6, 5, 5, 4);
  px(ctx, '#9cc987', 7, 5, 3, 2);
  px(ctx, dive ? '#ff8b67' : '#c6ff8c', 5, 7, 2, 1);
  px(ctx, '#263d39', 3, 6, 4, 5);
  for (let i = 0; i < 5; i++) {
    const span = 4 - Math.floor(i / 2);
    px(ctx, i % 2 === 0 ? '#3d7054' : '#619766', i, wingY + Math.floor(i / 2), 1, span);
    px(ctx, i % 2 === 0 ? '#3d7054' : '#619766', 15 - i, wingY + Math.floor(i / 2), 1, span);
  }
  px(ctx, '#b8e889', 7, 12, 1, 3);
  px(ctx, '#b8e889', 10, 12, 1, 3);
  if (dive) {
    px(ctx, '#ffb28e', 4, 10, 2, 1);
    px(ctx, '#ffb28e', 9, 11, 2, 1);
  }
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

/** Spore spitter 24x24: 0 closed mouth | 1 bursting | 2 withered (death). */
export function drawSporeSpitterFrame(ctx: Ctx, frame: number, w: number, h: number): void {
  if (frame === 2) {
    px(ctx, '#315044', 4, 18, 16, 5);
    px(ctx, '#527d59', 7, 14, 10, 5);
    px(ctx, '#8fc778', 9, 15, 5, 2);
    finish(ctx, w, h);
    return;
  }
  px(ctx, '#315044', 5, 18, 14, 5);
  px(ctx, '#497653', 6, 12, 12, 7);
  px(ctx, '#6d9d63', 8, 8, 9, 8);
  px(ctx, '#9cc987', 9, 7, 7, 3);
  px(ctx, '#6d9d63', 4, 10, 6, 5);
  px(ctx, '#6d9d63', 14, 9, 6, 5);
  px(ctx, '#b8e889', 6, 9, 3, 3);
  px(ctx, '#b8e889', 16, 8, 3, 3);
  px(ctx, '#e2ffad', 7, 9, 1, 1);
  px(ctx, '#e2ffad', 17, 8, 1, 1);
  px(ctx, '#294b43', 7, 15, 11, frame === 1 ? 2 : 1);
  if (frame === 1) {
    px(ctx, '#b8f79c', 2, 13, 3, 2);
    px(ctx, '#b8f79c', 19, 12, 3, 2);
    px(ctx, '#e2ffad', 7, 18, 3, 1);
  }
  finish(ctx, w, h);
}

/** Spore projectile 8x8: 0 closed pod | 1 bursting pod. */
export function drawSporeProjectileFrame(ctx: Ctx, frame: number, w: number, h: number): void {
  fillCircle(ctx, 4, 4, frame === 0 ? 2 : 3, '#4b9867');
  px(ctx, '#a7ef89', 2, 2, 3, 2);
  px(ctx, '#e2ffad', 3, 2, 2, 1);
  if (frame === 1) {
    px(ctx, '#79d97c', 0, 3, 2, 1);
    px(ctx, '#79d97c', 6, 4, 2, 1);
    px(ctx, '#b8f79c', 3, 0, 1, 2);
    px(ctx, '#b8f79c', 4, 6, 1, 2);
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
    const shieldY = 12;
    const shieldHeight = 16;
    px(ctx, P.goldDark, 1, shieldY, 6, shieldHeight);
    px(ctx, P.gold, 2, shieldY + 1, 3, shieldHeight - 2);
    px(ctx, P.outline, 2, shieldY + 3, 4, 2);
    px(ctx, frame === 2 ? P.heart : P.glow, 12, 16, 4, 4);
    if (frame === 4) px(ctx, P.white, 13, 17, 2, 2);
    if (frame === 2) px(ctx, P.goldLight, 0, 13, 2, 12);
  }
  finish(ctx, w, h);
}

/** Organic guardian 24x32, faces left: 0-1 stalk | 2 thorn lunge | 3 husk (death) | 4 exposed. */
export function drawOrganicGuardianFrame(ctx: Ctx, frame: number, w: number, h: number): void {
  if (frame === 3) {
    px(ctx, '#315044', 3, 25, 18, 6);
    px(ctx, '#527d59', 6, 22, 12, 4);
    px(ctx, '#8fc778', 10, 23, 4, 2);
    finish(ctx, w, h);
    return;
  }
  const stride = frame === 1 ? 2 : 0;
  px(ctx, '#315044', 6 + stride, 24, 5, 8);
  px(ctx, '#315044', 15 - stride, 24, 5, 8);
  px(ctx, '#497653', 5, 10, 14, 16);
  px(ctx, '#6d9d63', 6, 9, 12, 5);
  px(ctx, '#9cc987', 7, 9, 9, 2);
  px(ctx, '#28483f', 7, 3, 11, 9);
  px(ctx, '#75a879', 8, 3, 9, 2);
  px(ctx, frame === 2 ? '#ff8b67' : '#c6ff8c', 7, 7, 4, 2);
  px(ctx, '#b8e889', 10, 2, 2, 4);
  px(ctx, '#b8e889', 14, 4, 2, 4);
  px(ctx, '#315044', 2, 12, 5, 9);
  px(ctx, '#315044', 17, 12, 5, 9);
  px(ctx, '#8fc778', 1, 13, 5, 2);
  px(ctx, '#8fc778', 18, 14, 5, 2);
  px(ctx, '#b8e889', 4, 15, 2, 5);
  px(ctx, '#b8e889', 19, 16, 2, 4);
  if (frame === 2) {
    px(ctx, '#ffb28e', 0, 14, 3, 3);
    px(ctx, '#e2ffad', 5, 8, 3, 1);
  } else if (frame === 4) {
    px(ctx, '#e2ffad', 10, 14, 4, 5);
    px(ctx, '#c6ff8c', 11, 15, 2, 3);
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

/** Bio-technician 24x32: 0-1 stir | 2 emit spores | 3 wilted (death) | 4 exposed. */
export function drawBioTechnicianFrame(ctx: Ctx, frame: number, w: number, h: number): void {
  if (frame === 3) {
    px(ctx, '#315044', 4, 25, 16, 6);
    px(ctx, '#527d59', 8, 23, 8, 3);
    px(ctx, '#b8f79c', 10, 23, 3, 1);
    finish(ctx, w, h);
    return;
  }
  const stride = frame === 1 ? 1 : 0;
  px(ctx, '#315044', 7 + stride, 24, 4, 8);
  px(ctx, '#315044', 14 - stride, 24, 4, 8);
  px(ctx, '#497653', 6, 12, 13, 14);
  px(ctx, '#6d9d63', 7, 12, 11, 3);
  px(ctx, '#8fc778', 8, 13, 8, 2);
  fillEllipse(ctx, 12, 7, 6, 5, '#527d59');
  px(ctx, '#8fc778', 8, 3, 8, 2);
  px(ctx, '#b8e889', 10, 2, 4, 2);
  px(ctx, P.outline, 7, 7, 8, 2);
  px(ctx, frame === 2 ? '#ff8b67' : '#c6ff8c', 7, 8, 4, 1);
  px(ctx, '#28483f', 1, 15, 8, 5);
  px(ctx, '#6d9d63', 2, 16, 5, 2);
  px(ctx, '#b8e889', 4, 16, 2, 2);
  px(ctx, '#315044', 18, 14, 4, 10);
  px(ctx, '#8fc778', 19, 13, 3, 3);
  if (frame === 2) {
    px(ctx, '#e2ffad', 0, 14, 3, 3);
    px(ctx, '#b8f79c', 4, 13, 2, 2);
  } else if (frame === 4) {
    px(ctx, '#e2ffad', 9, 15, 5, 4);
  }
  finish(ctx, w, h);
}

/** Stalker 24x24 (faces left): 0-1 prowl | 2 charge | 3 exposed | 4 defeated. */
export function drawStalkerFrame(ctx: Ctx, frame: number, w: number, h: number): void {
  if (frame === 4) {
    fillEllipse(ctx, 10, 20, 8, 3, '#31483e');
    px(ctx, '#6d9273', 7, 18, 8, 2);
    px(ctx, '#93e6b8', 9, 18, 2, 1);
    finish(ctx, w, h);
    return;
  }
  if (frame === 3) {
    px(ctx, '#244c48', 6, 14, 12, 4);
    px(ctx, '#76c99c', 8, 11, 8, 4);
    px(ctx, '#c6ffd7', 9, 12, 4, 2);
    px(ctx, '#355d50', 3, 16, 5, 2);
    px(ctx, '#355d50', 16, 16, 5, 2);
    finish(ctx, w, h);
    return;
  }
  const stride = frame === 1 ? 1 : 0;
  px(ctx, '#294b43', 4 + stride, 16, 5, 6);
  px(ctx, '#294b43', 15 - stride, 16, 5, 6);
  px(ctx, '#46745b', 4, 10, 16, 9);
  px(ctx, '#75a879', 6, 9, 11, 3);
  px(ctx, '#9cc987', 7, 8, 3, 3);
  px(ctx, '#345849', 14, 8, 4, 3);
  px(ctx, '#294b43', 2, 12, 5, 5);
  px(ctx, '#294b43', 17, 12, 5, 5);
  px(ctx, '#d4f58a', 5, 12, 2, 1);
  px(ctx, frame === 2 ? '#ff8b67' : '#8dffe0', 8, 12, 2, 2);
  px(ctx, '#d4f58a', 12, 12, 2, 1);
  if (frame === 2) {
    px(ctx, '#eafcb6', 1, 13, 5, 2);
    px(ctx, '#ffb28e', 6, 14, 2, 1);
    px(ctx, '#b8e889', 10, 5, 2, 3);
    px(ctx, '#b8e889', 15, 6, 2, 3);
  } else {
    px(ctx, '#b8e889', 10, 6, 2, 3);
    px(ctx, '#b8e889', 15, 7, 2, 2);
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

/** Swarm Queen 48x48: 0-1 hover | 2 attack | 3 collapsed | 4 exposed with open core. */
export function drawSwarmQueenFrame(ctx: Ctx, frame: number, w: number, h: number): void {
  if (frame === 3) {
    fillEllipse(ctx, 24, 39, 17, 7, '#315044');
    px(ctx, '#6d9d63', 13, 33, 22, 7);
    px(ctx, '#c6ff8c', 21, 34, 7, 3);
    finish(ctx, w, h);
    return;
  }
  const hover = frame === 1 ? 2 : 0;
  const attack = frame === 2;
  px(ctx, '#263e3a', 8, 26 + hover, 10, 12);
  px(ctx, '#263e3a', 30, 26 + hover, 10, 12);
  fillEllipse(ctx, 24, 24 + hover, 17, 14, '#497653');
  fillEllipse(ctx, 24, 20 + hover, 12, 12, '#6d9d63');
  px(ctx, '#8fc778', 16, 15 + hover, 16, 5);
  px(ctx, '#315044', 13, 11 + hover, 5, 11);
  px(ctx, '#315044', 30, 11 + hover, 5, 11);
  px(ctx, '#b8e889', 10, 7 + hover, 4, 12);
  px(ctx, '#b8e889', 34, 7 + hover, 4, 12);
  px(ctx, '#d4ade6', 13, 4 + hover, 4, 7);
  px(ctx, '#d4ade6', 31, 4 + hover, 4, 7);
  px(ctx, '#263e3a', 18, 8 + hover, 12, 11);
  px(ctx, '#8fc778', 20, 7 + hover, 8, 4);
  px(ctx, attack ? '#ff6f9f' : '#c6ff8c', 18, 17 + hover, 4, 2);
  px(ctx, attack ? '#ff6f9f' : '#c6ff8c', 26, 17 + hover, 4, 2);
  const core = frame === 4 ? '#e2ffad' : attack ? '#ff83aa' : '#9d65ce';
  fillEllipse(ctx, 24, 26 + hover, 7, 6, '#263e3a');
  fillEllipse(ctx, 24, 26 + hover, frame === 4 ? 5 : 3, 4, core);
  if (frame === 4) {
    px(ctx, '#fff3bb', 22, 24 + hover, 5, 3);
    px(ctx, '#e2ffad', 23, 31 + hover, 3, 4);
  }
  for (const x of [6, 39]) {
    px(ctx, '#6d9d63', x, 20 + hover, 4, 3);
    px(ctx, '#8fc778', x + 1, 21 + hover, 2, 1);
  }
  if (attack) {
    px(ctx, '#ff83aa', 19, 34, 3, 2);
    px(ctx, '#ff83aa', 26, 34, 3, 2);
    px(ctx, '#e2ffad', 22, 37, 4, 2);
  }
  finish(ctx, w, h);
}
