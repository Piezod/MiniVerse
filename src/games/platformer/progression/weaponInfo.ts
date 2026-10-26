/** Display text for weapon cards (Phaser-free so the formatting can be tested). */
import type { AbilityDef } from '../abilities/AbilityCatalog';
import type { StatusDef } from '../combat/status';

export interface WeaponSummary {
  damage: string;
  energy: string;
  cooldown: string;
  effects: string;
}

const fmt = (n: number): string => String(Math.round(n * 100) / 100);

/** Damage, energy, cooldown and effects of an ability level (1-based), as shown in the shop. */
export function weaponSummary(def: AbilityDef, level: number, statuses: Readonly<Record<string, StatusDef>>): WeaponSummary {
  const stats = def.levels[Math.min(Math.max(level, 1), def.levels.length) - 1];
  const p = stats.params;
  // Continuous weapons (flamethrower) describe a damage range per tick and energy per second.
  const continuous = p.baseDamage !== undefined;
  const damage = continuous
    ? `${fmt(p.baseDamage)}-${fmt(p.maxDamage ?? p.baseDamage)}/tick`
    : p.chargedDamage !== undefined
      ? `${fmt(p.damage ?? 0)}-${fmt(p.chargedDamage)}`
      : p.damage !== undefined
        ? fmt(p.damage)
        : '-';
  const energy = stats.energy > 0 ? `${fmt(stats.energy)}${continuous ? '/s' : ''}` : '-';
  const cooldown = stats.cooldown > 0 ? `${fmt(stats.cooldown)}s` : continuous ? 'continuo' : '-';
  const effects =
    [
      ...(p.pierce !== undefined ? [`Perfora ${p.pierce}`] : []),
      ...stats.effects.map((e) => {
        const name = statuses[e.id]?.name ?? e.id;
        return e.chance !== undefined && e.chance < 1 ? `${name} ${Math.round(e.chance * 100)}/100` : name;
      }),
    ].join(', ') || '-';
  return { damage, energy, cooldown, effects };
}
