/**
 * Modular status effects (Phaser-free). Definitions come from combat/status-effects.json; each
 * entity owns a `StatusEffects` instance that the game updates every frame.
 *
 * Kinds:  dot (damage over time) | slow (speed multiplier) | stun (no movement/attacks)
 *         vulnerable (extra damage taken)
 * Stacking: refresh (restart duration) | intensity (+1 stack up to maxStacks, restart duration)
 *           extend (add duration up to maxDuration) | ignore (no effect while active)
 * Every effect has a finite duration capped by maxDuration, so nothing can become permanent.
 */
export const STATUS_KINDS = ['dot', 'slow', 'stun', 'vulnerable'] as const;
export const STACKING_RULES = ['refresh', 'intensity', 'extend', 'ignore'] as const;
export type StatusKind = (typeof STATUS_KINDS)[number];
export type StackingRule = (typeof STACKING_RULES)[number];

/** Hard ceiling for any effect duration, in seconds. */
export const MAX_STATUS_DURATION = 20;

export interface StatusDef {
  id: string;
  name: string;
  kind: StatusKind;
  /** Seconds. */
  duration: number;
  maxDuration: number;
  stacking: StackingRule;
  maxStacks: number;
  /** dot: damage per tick per stack; slow: speed multiplier (0..1); vulnerable: damage taken multiplier. */
  intensity: number;
  /** dot only: seconds between ticks. */
  tick: number;
  /** Element of dot damage (for affinities), optional. */
  element: string | null;
  /** Defenders of these elements are immune (e.g. fire enemies can't burn). */
  blockedBy: string[];
  /** Optional tint (#rrggbb) shown while active. */
  tint?: string;
}

export interface StatusCatalog {
  effects: Record<string, StatusDef>;
  issues: Array<{ id: string; message: string }>;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function buildStatusCatalog(raw: unknown, knownElements: readonly string[]): StatusCatalog {
  const effects: Record<string, StatusDef> = {};
  const issues: StatusCatalog['issues'] = [];
  if (!isRecord(raw)) return { effects, issues: [{ id: '*', message: 'status-effects.json debe ser un objeto { id: definición }' }] };

  for (const [id, r] of Object.entries(raw)) {
    const errors: string[] = [];
    if (!isRecord(r)) {
      issues.push({ id, message: 'la definición debe ser un objeto' });
      continue;
    }
    const num = (key: string, min: number, max: number, fallback?: number): number => {
      const v = r[key] ?? fallback;
      if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) {
        errors.push(`"${key}" debe estar entre ${min} y ${max}`);
        return min;
      }
      return v;
    };
    const kind = r.kind as StatusKind;
    if (!STATUS_KINDS.includes(kind)) errors.push(`"kind" debe ser uno de: ${STATUS_KINDS.join(', ')}`);
    const stacking = (r.stacking ?? 'refresh') as StackingRule;
    if (!STACKING_RULES.includes(stacking)) errors.push(`"stacking" debe ser uno de: ${STACKING_RULES.join(', ')}`);
    const duration = num('duration', 0.05, MAX_STATUS_DURATION);
    const maxDuration = num('maxDuration', duration, MAX_STATUS_DURATION, duration);
    const intensity =
      kind === 'slow' ? num('intensity', 0, 1) : kind === 'vulnerable' ? num('intensity', 1, 5) : kind === 'dot' ? num('intensity', 0, 50) : num('intensity', 0, 1, 0);
    const tick = kind === 'dot' ? num('tick', 0.05, 10) : num('tick', 0, 10, 0);
    const element = typeof r.element === 'string' ? r.element : null;
    if (element !== null && !knownElements.includes(element)) errors.push(`"element" desconocido: ${element}`);
    const blockedBy = Array.isArray(r.blockedBy) ? r.blockedBy.filter((e): e is string => typeof e === 'string') : [];
    blockedBy.filter((e) => !knownElements.includes(e)).forEach((e) => errors.push(`"blockedBy": elemento desconocido ${e}`));
    if (errors.length) {
      errors.forEach((message) => issues.push({ id, message }));
      continue;
    }
    effects[id] = {
      id,
      name: typeof r.name === 'string' ? r.name : id,
      kind,
      duration,
      maxDuration,
      stacking,
      maxStacks: Math.floor(num('maxStacks', 1, 10, 1)),
      intensity,
      tick,
      element,
      blockedBy,
      tint: typeof r.tint === 'string' && /^#[0-9a-f]{6}$/i.test(r.tint) ? r.tint : undefined,
    };
  }
  return { effects, issues };
}

/** Status effects that trigger for a hit, given a random source in [0, 1). */
export function rollEffects(effects: readonly { id: string; chance?: number }[], random: () => number): string[] {
  return effects.filter((e) => (e.chance ?? 1) >= 1 || random() < (e.chance ?? 1)).map((e) => e.id);
}

interface ActiveStatus {
  def: StatusDef;
  remaining: number;
  stacks: number;
  tickLeft: number;
}

export interface StatusTick {
  effect: string;
  amount: number;
  element: string | null;
}

export interface StatusOwner {
  /** Defender element (for blockedBy). */
  element: string | null;
  /** Status ids this entity can never receive. */
  immune: readonly string[];
}

export class StatusEffects {
  private readonly active = new Map<string, ActiveStatus>();

  constructor(
    private readonly catalog: Readonly<Record<string, StatusDef>>,
    private readonly owner: StatusOwner,
  ) {}

  has(id: string): boolean {
    return this.active.has(id);
  }

  stacks(id: string): number {
    return this.active.get(id)?.stacks ?? 0;
  }

  remaining(id: string): number {
    return this.active.get(id)?.remaining ?? 0;
  }

  /** Active effect ids, most recent last. */
  get ids(): string[] {
    return [...this.active.keys()];
  }

  isImmune(id: string): boolean {
    const def = this.catalog[id];
    if (!def) return true;
    return this.owner.immune.includes(id) || (this.owner.element !== null && def.blockedBy.includes(this.owner.element));
  }

  /** Applies (or stacks) an effect. Returns false when unknown, immune or ignored. */
  apply(id: string): boolean {
    const def = this.catalog[id];
    if (!def || this.isImmune(id)) return false;
    const current = this.active.get(id);
    if (!current) {
      this.active.set(id, { def, remaining: def.duration, stacks: 1, tickLeft: def.tick });
      return true;
    }
    switch (def.stacking) {
      case 'ignore':
        return false;
      case 'refresh':
        current.remaining = def.duration;
        return true;
      case 'intensity':
        current.stacks = Math.min(def.maxStacks, current.stacks + 1);
        current.remaining = def.duration;
        return true;
      case 'extend':
        current.remaining = Math.min(def.maxDuration, current.remaining + def.duration);
        return true;
    }
  }

  clear(id?: string): void {
    if (id) this.active.delete(id);
    else this.active.clear();
  }

  /** Advances timers; returns damage-over-time ticks due this frame. */
  update(dt: number): StatusTick[] {
    const ticks: StatusTick[] = [];
    for (const [id, status] of this.active) {
      const step = Math.min(dt, status.remaining);
      if (status.def.kind === 'dot') {
        // Only time inside the effect's remaining duration can produce ticks.
        status.tickLeft -= step;
        while (status.tickLeft <= 1e-9) {
          ticks.push({ effect: id, amount: status.def.intensity * status.stacks, element: status.def.element });
          status.tickLeft += status.def.tick;
        }
      }
      status.remaining -= dt;
      if (status.remaining <= 1e-9) this.active.delete(id);
    }
    return ticks;
  }

  /** Movement multiplier from slow/stun effects (strongest one wins, never stacks below 0). */
  get speedMultiplier(): number {
    let m = 1;
    for (const { def } of this.active.values()) {
      if (def.kind === 'stun') return 0;
      if (def.kind === 'slow') m = Math.min(m, def.intensity);
    }
    return m;
  }

  get stunned(): boolean {
    return [...this.active.values()].some((s) => s.def.kind === 'stun');
  }

  /** Extra damage taken from vulnerable effects (multiplicative per stack, capped at ×3). */
  get damageTakenMultiplier(): number {
    let m = 1;
    for (const { def, stacks } of this.active.values()) if (def.kind === 'vulnerable') m *= def.intensity ** stacks;
    return Math.min(3, m);
  }

  /** Tint of the most recently applied effect that defines one. */
  get tint(): string | undefined {
    return [...this.active.values()].reverse().find((s) => s.def.tint)?.def.tint;
  }
}
