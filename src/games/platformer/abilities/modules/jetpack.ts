import { playSound } from '../../../../core/audio/Sfx';
import { ANIM } from '../../assets/animations';
import { AUDIO } from '../../assets/manifest';
import { Cooldown } from '../../combat/resources';
import { type AbilityModule, param } from '../Ability';

/**
 * Propulsión: extra mid-air jumps with thruster particles, and a short glide while jump is held.
 * params: extraJumps, jumpVelocity, glideTime (s), glideFallSpeed (px/s).
 */
export const jetpack: AbilityModule = (ctx, def, level, stats) => {
  const extraJumps = param(stats, 'extraJumps', 1);
  const jumpVelocity = param(stats, 'jumpVelocity', 280);
  const glideTime = param(stats, 'glideTime', 0.5);
  const glideFallSpeed = param(stats, 'glideFallSpeed', 50);
  const cooldown = new Cooldown(stats.cooldown);
  let jumpsLeft = extraJumps;
  let glideLeft = glideTime;
  let trail = 0;

  return {
    def,
    level,
    cooldown,
    update(dt) {
      const { player, input, energy, fx } = ctx;
      cooldown.update(dt);
      if (!player.isAlive) return;
      const body = player.body;
      if (body.blocked.down) {
        jumpsLeft = extraJumps;
        glideLeft = glideTime;
        return;
      }
      if (input.justPressed('jump') && !player.jumpedThisFrame && !player.canGroundJump && jumpsLeft > 0 && cooldown.ready && energy.tryConsume(stats.energy)) {
        jumpsLeft--;
        cooldown.trigger();
        player.airJump(jumpVelocity);
        player.playAction([ANIM.player.jetpack, ANIM.player.jump], 250);
        fx.jet(player.x, body.bottom, 10);
        playSound(ctx.scene, AUDIO.jet);
        return;
      }
      if (input.isDown('jump') && body.velocity.y > glideFallSpeed && glideLeft > 0) {
        body.setVelocityY(glideFallSpeed);
        glideLeft -= dt;
        trail -= dt;
        if (trail <= 0) {
          trail = 0.06;
          fx.jet(player.x, body.bottom, 2);
        }
      }
    },
  };
};
