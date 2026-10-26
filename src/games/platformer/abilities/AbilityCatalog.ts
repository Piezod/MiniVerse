/** Ability (passives and weapons) definitions loaded from abilities.json (Phaser-free). */
import type { EffectApplication } from '../combat/damage';
import { ABILITY_BUTTONS, type AbilityButton } from '../controls';

export type AbilitySlot = 'passive' | 'active';

export interface AbilityLevel {
  /** Stars needed to buy this level. */
  cost: number;
  /** Energy per use (active) or per second (continuous abilities). */
  energy: number;
  /** Seconds between uses. */
  cooldown: number;
  /** Module-specific values: damage, range, speed... */
  params: Record<string, number>;
  /** Status effects applied by each hit at this level. */
  effects: EffectApplication[];
}

export interface AbilityDef {
  id: string;
  name: string;
  description: string;
  /** Runtime module implementing it (see abilities/modules). Several abilities can share a module. */
  module: string;
  /** passive = always on (Propulsión); active = weapon equipped on F or R. */
  slot: AbilitySlot;
  /** Elemental affinity of a weapon's hits (elements.json id). Two weapons may share an element. */
  element: string | null;
  /** Preferred weapon slot when first equipped (F = primary, R = secondary). */
  defaultSlot: AbilityButton | null;
  /** false = planned: hidden from the shop and can't be bought or equipped. */
  available: boolean;
  /** Frame in the UI icon sheet. */
  icon: number;
  /** Level id that must be completed before it can be bought (null = always available). */
  requires: string | null;
  levels: AbilityLevel[];
  /** Asset keys used by the module (projectile frame, fx...). */
  assets: Record<string, string | number>;
}

export interface AbilityCatalog {
  abilities: Record<string, AbilityDef>;
  issues: Array<{ id: string; message: string }>;
}

export interface AbilityCatalogIds {
  /** Element ids (elements.json). When given, weapons must declare a valid element. */
  elements?: readonly string[];
  /** Status effect ids (status-effects.json). */
  statuses?: readonly string[];
  /** Modules allowed only for unavailable (planned) abilities. */
  plannedModules?: readonly string[];
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function buildAbilityCatalog(raw: unknown, knownModules: readonly string[], ids: AbilityCatalogIds = {}): AbilityCatalog {
  const abilities: Record<string, AbilityDef> = {};
  const issues: AbilityCatalog['issues'] = [];
  if (!isRecord(raw)) return { abilities, issues: [{ id: '*', message: 'abilities.json debe ser un objeto { id: definición }' }] };

  for (const [id, r] of Object.entries(raw)) {
    const errors: string[] = [];
    if (!isRecord(r)) {
      issues.push({ id, message: 'la definición debe ser un objeto' });
      continue;
    }
    const available = r.available !== false;
    const planned = ids.plannedModules ?? [];
    if (typeof r.name !== 'string' || !r.name) errors.push('"name" es obligatorio');
    if (typeof r.module !== 'string' || !(knownModules.includes(r.module) || (!available && planned.includes(r.module)))) {
      errors.push(
        typeof r.module === 'string' && planned.includes(r.module)
          ? `"module" ${r.module} aún no está implementado: usa "available": false`
          : `"module" debe ser uno de: ${knownModules.join(', ')}`,
      );
    }
    if (r.slot !== 'passive' && r.slot !== 'active') errors.push('"slot" debe ser "passive" o "active"');
    // "button" is the pre-v2 name of "defaultSlot"; both are accepted.
    const slotKey = r.defaultSlot !== undefined ? 'defaultSlot' : 'button';
    const rawSlot = r[slotKey] ?? null;
    if (r.slot === 'active' && rawSlot !== null && !ABILITY_BUTTONS.includes(rawSlot as AbilityButton)) errors.push(`"${slotKey}" debe ser uno de: ${ABILITY_BUTTONS.join(', ')}`);
    if (r.slot === 'passive' && rawSlot !== null) errors.push(`las habilidades pasivas no usan "${slotKey}"`);
    const element = typeof r.element === 'string' ? r.element : null;
    if (r.element !== undefined && r.element !== null && typeof r.element !== 'string') errors.push('"element" debe ser un id de elemento');
    if (element !== null && ids.elements && !ids.elements.includes(element)) errors.push(`"element" debe ser uno de: ${ids.elements.join(', ')}`);
    if (r.slot === 'active' && element === null && ids.elements) errors.push('las armas necesitan "element"');
    if (r.requires !== undefined && r.requires !== null && typeof r.requires !== 'string') errors.push('"requires" debe ser un id de nivel o null');
    const levels: AbilityLevel[] = [];
    if (!Array.isArray(r.levels) || r.levels.length === 0) errors.push('"levels" debe tener al menos un nivel');
    else
      r.levels.forEach((l, i) => {
        if (!isRecord(l)) return void errors.push(`levels[${i}] debe ser un objeto`);
        const n = (key: string): number => {
          const v = l[key] ?? 0;
          if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) errors.push(`levels[${i}].${key} debe ser un número >= 0`);
          return typeof v === 'number' ? v : 0;
        };
        const cost = n('cost');
        if (!Number.isInteger(cost)) errors.push(`levels[${i}].cost debe ser entero`);
        const params: Record<string, number> = {};
        if (isRecord(l.params))
          for (const [k, v] of Object.entries(l.params)) {
            if (typeof v !== 'number') errors.push(`levels[${i}].params.${k} debe ser numérico`);
            else params[k] = v;
          }
        const effects: EffectApplication[] = [];
        if (l.effects !== undefined) {
          if (!Array.isArray(l.effects)) errors.push(`levels[${i}].effects debe ser una lista`);
          else
            l.effects.forEach((e, j) => {
              const at = `levels[${i}].effects[${j}]`;
              if (!isRecord(e) || typeof e.id !== 'string') return void errors.push(`${at} necesita "id"`);
              if (ids.statuses && !ids.statuses.includes(e.id)) errors.push(`${at}: estado desconocido "${e.id}"`);
              if (e.chance !== undefined && (typeof e.chance !== 'number' || e.chance < 0 || e.chance > 1)) errors.push(`${at}.chance debe estar entre 0 y 1`);
              effects.push(typeof e.chance === 'number' ? { id: e.id, chance: e.chance } : { id: e.id });
            });
        }
        levels.push({ cost, energy: n('energy'), cooldown: n('cooldown'), params, effects });
      });
    if (errors.length) {
      errors.forEach((message) => issues.push({ id, message }));
      continue;
    }
    abilities[id] = {
      id,
      name: r.name as string,
      description: typeof r.description === 'string' ? r.description : '',
      module: r.module as string,
      slot: r.slot as AbilitySlot,
      element: r.slot === 'active' ? element : null,
      defaultSlot: r.slot === 'active' ? (rawSlot as AbilityButton | null) : null,
      available,
      icon: typeof r.icon === 'number' ? r.icon : 0,
      requires: typeof r.requires === 'string' ? r.requires : null,
      levels,
      assets: isRecord(r.assets) ? (r.assets as Record<string, string | number>) : {},
    };
  }
  return { abilities, issues };
}
