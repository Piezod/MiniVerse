/** Ability definitions loaded from abilities.json (Phaser-free). */
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
}

export interface AbilityDef {
  id: string;
  name: string;
  description: string;
  /** Runtime module implementing it (see abilities/modules). Several abilities can share a module. */
  module: string;
  slot: AbilitySlot;
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

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function buildAbilityCatalog(raw: unknown, knownModules: readonly string[]): AbilityCatalog {
  const abilities: Record<string, AbilityDef> = {};
  const issues: AbilityCatalog['issues'] = [];
  if (!isRecord(raw)) return { abilities, issues: [{ id: '*', message: 'abilities.json debe ser un objeto { id: definición }' }] };

  for (const [id, r] of Object.entries(raw)) {
    const errors: string[] = [];
    if (!isRecord(r)) {
      issues.push({ id, message: 'la definición debe ser un objeto' });
      continue;
    }
    if (typeof r.name !== 'string' || !r.name) errors.push('"name" es obligatorio');
    if (typeof r.module !== 'string' || !knownModules.includes(r.module)) errors.push(`"module" debe ser uno de: ${knownModules.join(', ')}`);
    if (r.slot !== 'passive' && r.slot !== 'active') errors.push('"slot" debe ser "passive" o "active"');
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
        levels.push({ cost, energy: n('energy'), cooldown: n('cooldown'), params });
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
      icon: typeof r.icon === 'number' ? r.icon : 0,
      requires: typeof r.requires === 'string' ? r.requires : null,
      levels,
      assets: isRecord(r.assets) ? (r.assets as Record<string, string | number>) : {},
    };
  }
  return { abilities, issues };
}
