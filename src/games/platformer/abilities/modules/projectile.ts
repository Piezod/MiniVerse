import { playSound } from '../../../../core/audio/Sfx';
import { ANIM } from '../../assets/animations';
import { AUDIO } from '../../assets/manifest';
import { Cooldown } from '../../combat/resources';
import { type AbilityModule, param } from '../Ability';

/**
 * Horizontal projectile (Rayo de energía). params: damage, range (px), speed (px/s).
 * Energy per shot = level.energy, fire rate = level.cooldown.
 */
export const projectile: AbilityModule = (ctx, def, level, stats) => {
  const cooldown = new Cooldown(stats.cooldown);
  const damage = param(stats, 'damage', 1);
  const range = param(stats, 'range', 150);
  const speed = param(stats, 'speed', 260);

  return {
    def,
    level,
    cooldown,
    update(dt, _held, pressed) {
      cooldown.update(dt);
      const { player, energy, combat, fx } = ctx;
      if (!pressed || !player.isAlive || !cooldown.ready || !energy.tryConsume(stats.energy)) return;
      cooldown.trigger();
      const dir = player.facing;
      const x = player.x + dir * 10;
      // Low enough to hit short ground enemies (walker body is 10px tall).
      const y = player.body.bottom - 9;
      combat.firePlayerShot({ x, y, vx: dir * speed, damage, type: 'beam', range });
      fx.impact(x, y, 'beam');
      player.playAction([ANIM.player.shoot, ANIM.player.attack], 200);
      playSound(ctx.scene, AUDIO.beam);
    },
  };
};
