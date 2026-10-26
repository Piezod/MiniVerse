/**
 * Elemental affinities (Phaser-free). Loaded from combat/elements.json, so the balance can change
 * without touching code. Affinity is WHAT a hit is made of; the attack form (contact, stomp,
 * projectile, area, status) is HOW it lands — see damage.ts.
 */
export interface ElementDef {
  id: string;
  name: string;
  /** #rrggbb used by UI and effects. */
  color: string;
}

export interface ElementChart {
  readonly elements: Readonly<Record<string, ElementDef>>;
  /** Attack multiplier of `attacker` against a defender of type `defender` (1 when either is untyped). */
  multiplier(attacker: string | null | undefined, defender: string | null | undefined): number;
  /** Defender types this element deals bonus damage to. */
  strongAgainst(element: string): string[];
  /** Defender types this element deals reduced damage to. */
  weakAgainst(element: string): string[];
}

export interface ChartIssue {
  message: string;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Chart without elements: every multiplier is 1. */
export const NEUTRAL_CHART: ElementChart = createChart({}, {});

function createChart(elements: Record<string, ElementDef>, matrix: Record<string, Record<string, number>>): ElementChart {
  const ids = Object.keys(elements);
  return {
    elements,
    multiplier: (attacker, defender) => (attacker && defender ? (matrix[attacker]?.[defender] ?? 1) : 1),
    strongAgainst: (element) => ids.filter((d) => (matrix[element]?.[d] ?? 1) > 1),
    weakAgainst: (element) => ids.filter((d) => (matrix[element]?.[d] ?? 1) < 1),
  };
}

/**
 * elements.json:
 *   elements: { id: { name, color } }
 *   cycle: [a, b, c, ...]   a beats b, b beats c ... last beats first
 *   advantage / disadvantage: multipliers for the winner and the inverse relation
 *   overrides: { attacker: { defender: multiplier } } applied last (optional)
 */
export function buildElementChart(raw: unknown): { chart: ElementChart; issues: ChartIssue[] } {
  const issues: ChartIssue[] = [];
  if (!isRecord(raw) || !isRecord(raw.elements)) return { chart: NEUTRAL_CHART, issues: [{ message: 'elements.json necesita "elements"' }] };

  const elements: Record<string, ElementDef> = {};
  for (const [id, value] of Object.entries(raw.elements)) {
    if (!/^[a-z][a-z0-9-]*$/.test(id)) issues.push({ message: `id de elemento no válido: "${id}"` });
    else if (!isRecord(value) || typeof value.name !== 'string' || typeof value.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(value.color)) {
      issues.push({ message: `elemento "${id}": necesita "name" y "color" (#rrggbb)` });
    } else elements[id] = { id, name: value.name, color: value.color };
  }

  const number = (key: string, fallback: number): number => {
    const v = raw[key] ?? fallback;
    if (typeof v !== 'number' || v < 0 || v > 10) {
      issues.push({ message: `"${key}" debe ser un número entre 0 y 10` });
      return fallback;
    }
    return v;
  };
  const advantage = number('advantage', 1.5);
  const disadvantage = number('disadvantage', 0.5);

  const matrix: Record<string, Record<string, number>> = {};
  const set = (a: string, d: string, m: number): void => void ((matrix[a] ??= {})[d] = m);
  const cycle = Array.isArray(raw.cycle) ? raw.cycle : [];
  if (cycle.some((id) => typeof id !== 'string' || !elements[id])) issues.push({ message: '"cycle" solo puede contener elementos definidos' });
  else if (new Set(cycle).size !== cycle.length) issues.push({ message: '"cycle" no puede repetir elementos' });
  else if (cycle.length >= 2) {
    cycle.forEach((attacker, i) => {
      const beaten = cycle[(i + 1) % cycle.length] as string;
      set(attacker as string, beaten, advantage);
      set(beaten, attacker as string, disadvantage);
    });
  }

  if (raw.overrides !== undefined) {
    if (!isRecord(raw.overrides)) issues.push({ message: '"overrides" debe ser un objeto' });
    else
      for (const [attacker, row] of Object.entries(raw.overrides)) {
        if (!elements[attacker] || !isRecord(row)) {
          issues.push({ message: `overrides.${attacker}: elemento desconocido` });
          continue;
        }
        for (const [defender, m] of Object.entries(row)) {
          if (!elements[defender] || typeof m !== 'number' || m < 0) issues.push({ message: `overrides.${attacker}.${defender} no válido` });
          else set(attacker, defender, m);
        }
      }
  }
  return { chart: createChart(elements, matrix), issues };
}
