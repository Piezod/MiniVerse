import { playSound } from '../../../../core/audio/Sfx';
import { ANIM } from '../../assets/animations';
import { AUDIO } from '../../assets/manifest';
import { Cooldown } from '../../combat/resources';
import { type AbilityModule, param } from '../Ability';
import { affordableCharge, chargedDamage, chargeEnergyCost, chargeFraction } from '../formulas';

/**
 * Charged piercing beam (Cañón láser): hold the button to charge, release to fire.
 * params: damage (uncharged), chargedDamage (full charge), chargeTime (s), range (px), pierce (max
 * enemies hit), beamHeight (px, uncharged; grows with charge). Energy (level.energy) is the cost of
 * a full charge and is paid on release; cooldown starts after firing. assets.color: beam tint.
 */
export const chargedShot: AbilityModule = (ctx, def, level, stats) => {
  const cooldown = new Cooldown(stats.cooldown);
  const minDamage = param(stats, 'damage', 1);
  const maxDamage = param(stats, 'chargedDamage', 3);
  const chargeTime = param(stats, 'chargeTime', 1);
  const range = param(stats, 'range', 200);
  const pierce = Math.max(1, Math.floor(param(stats, 'pierce', 2)));
  const beamHeight = param(stats, 'beamHeight', 4);
  const color = typeof def.assets.color === 'string' ? def.assets.color : '#ff4d6d';
  let charging = false;
  let held = 0;

  const cancel = (): void => {
    if (charging) ctx.fx.endCharge();
    charging = false;
    held = 0;
  };

  return {
    def,
    level,
    cooldown,
    cancel: cancel,
    update(dt, isHeld, pressed) {
      cooldown.update(dt);
      const { player, energy, combat, fx } = ctx;
      if (!player.isAlive) return cancel();
      if (!charging) {
        if (!pressed || !cooldown.ready || affordableCharge(energy.current, stats.energy) < 0) return;
        charging = true;
        held = 0;
      }
      // Energy spent elsewhere while charging lowers the ceiling of the charge.
      const ceiling = affordableCharge(energy.current, stats.energy);
      if (ceiling < 0) return cancel();
      const dir = player.facing as -1 | 1;
      const x = player.x + dir * 10;
      const y = player.body.bottom - 10;
      if (isHeld) {
        held += dt;
        fx.setCharge(player.x, player.body.center.y, Math.min(chargeFraction(held, chargeTime), ceiling), color);
        return;
      }
      const fraction = Math.min(chargeFraction(held, chargeTime), ceiling);
      cancel();
      if (!energy.tryConsume(chargeEnergyCost(fraction, stats.energy))) return;
      cooldown.trigger();
      const height = beamHeight + Math.round(fraction * beamHeight);
      const { endX } = combat.fireBeam({
        x,
        y,
        dir,
        range,
        height,
        pierce,
        hit: { amount: chargedDamage(fraction, minDamage, maxDamage), form: 'projectile', element: def.element, effects: stats.effects },
      });
      fx.laser(x, endX, y, height, fraction, color);
      player.playAction([ANIM.player.shoot, ANIM.player.attack], 250);
      playSound(ctx.scene, AUDIO.laser);
    },
  };
};
