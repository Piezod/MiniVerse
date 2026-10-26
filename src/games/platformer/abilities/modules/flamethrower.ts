import Phaser from 'phaser';
import { playSound } from '../../../../core/audio/Sfx';
import { ANIM } from '../../assets/animations';
import { AUDIO } from '../../assets/manifest';
import { Cooldown } from '../../combat/resources';
import { type AbilityModule, param } from '../Ability';
import { flameTickDamage } from '../formulas';

/**
 * Lanzallamas: short-range continuous cone while held. Damage grows the longer it is held.
 * Energy is drained per second (level.energy). params: range, height, tick, baseDamage, rampPerSecond, maxDamage.
 */
export const flamethrower: AbilityModule = (ctx, def, level, stats) => {
  const cooldown = new Cooldown(stats.cooldown);
  const range = param(stats, 'range', 34);
  const height = param(stats, 'height', 14);
  const tick = param(stats, 'tick', 0.12);
  const base = param(stats, 'baseDamage', 0.25);
  const ramp = param(stats, 'rampPerSecond', 0.5);
  const max = param(stats, 'maxDamage', 1);
  let held = 0;
  let tickLeft = 0;
  let soundLeft = 0;
  let burning = false;
  /** Set when the tank runs dry; the button must be released before igniting again. */
  let exhausted = false;
  /** Energy needed to ignite (0.25 s worth), so an empty tank can't sputter on regeneration. */
  const ignition = stats.energy * 0.25;

  return {
    def,
    level,
    cooldown,
    update(dt, isHeld) {
      cooldown.update(dt);
      const { player, energy, combat, fx } = ctx;
      if (!isHeld) exhausted = false;
      if (exhausted || (!burning && energy.current < ignition)) isHeld = false;
      const needed = stats.energy * dt;
      if (!isHeld || !player.isAlive || !cooldown.ready || energy.drain(needed) < needed) {
        if (isHeld && burning) exhausted = true;
        burning = false;
        held = 0;
        tickLeft = 0;
        return;
      }
      burning = true;
      held += dt;
      tickLeft -= dt;
      const dir = player.facing as -1 | 1;
      const mouthX = player.x + dir * 8;
      const y = player.body.center.y;
      fx.flame(mouthX, y, dir);
      player.playAction([ANIM.player.shoot, ANIM.player.attack], 150);
      soundLeft -= dt;
      if (soundLeft <= 0) {
        soundLeft = 0.12;
        playSound(ctx.scene, AUDIO.flame);
      }
      if (tickLeft > 0) return;
      tickLeft = tick;
      const area = new Phaser.Geom.Rectangle(dir > 0 ? mouthX : mouthX - range, y - height / 2, range, height);
      combat.damageArea(area, { amount: flameTickDamage(held, base, ramp, max), form: 'area', element: def.element, effects: stats.effects, fromX: player.x });
    },
  };
};
