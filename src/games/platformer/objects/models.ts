/** Phaser-free behaviour of level objects: signals, hazard cycles, platform paths, switches and doors. */
import type { HazardTiming } from './types';

type Listener = (id: string, on: boolean) => void;

/** Tiny named on/off signal bus shared by the objects of a level (switches write, doors and hazards read). */
export class SignalBus {
  private readonly state = new Map<string, boolean>();
  private readonly listeners = new Set<Listener>();

  isOn(id: string): boolean {
    return this.state.get(id) === true;
  }

  set(id: string, on: boolean): void {
    if (this.isOn(id) === on) return;
    this.state.set(id, on);
    for (const listener of [...this.listeners]) listener(id, on);
  }

  onChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  clear(): void {
    this.state.clear();
    this.listeners.clear();
  }
}

export type HazardPhase = 'off' | 'warning' | 'active';

/**
 * off → warning → active timeline. While disabled (gated) the hazard is off and the cycle rewinds, so
 * enabling it always starts with a warning instead of an instant hit. A permanent hazard is simply on
 * from the start, and warns only after being re-enabled.
 */
export class HazardCycle {
  private elapsed: number;
  private enabled = true;
  private warningLeft = 0;

  constructor(private readonly timing: HazardTiming) {
    this.elapsed = timing.offset;
  }

  setEnabled(enabled: boolean): void {
    if (enabled === this.enabled) return;
    this.enabled = enabled;
    if (!enabled) this.elapsed = this.timing.offset;
    else if (this.timing.mode === 'permanent') this.warningLeft = this.timing.warning;
  }

  update(dt: number): void {
    if (!this.enabled) return;
    const step = Math.max(0, dt);
    this.elapsed += step;
    this.warningLeft = Math.max(0, this.warningLeft - step);
  }

  get phase(): HazardPhase {
    if (!this.enabled) return 'off';
    const { mode, on, off, warning } = this.timing;
    if (mode === 'permanent') return this.warningLeft > 0 ? 'warning' : 'active';
    const length = off + warning + on;
    const t = length > 0 ? this.elapsed % length : 0;
    return t < off ? 'off' : t < off + warning ? 'warning' : 'active';
  }

  get isActive(): boolean {
    return this.phase === 'active';
  }

  /** Seconds elapsed in the cycle (for tests and debugging). */
  get time(): number {
    return this.elapsed;
  }
}
export interface PathSpec {
  /** Signed travel in tiles. */
  travel: number;
  speed: number;
  wait: number;
  offset: number;
  tileSize: number;
}

/** Ping-pong movement along a straight segment, with a pause at both ends. Frame-rate independent. */
export class PathMotion {
  readonly length: number;
  /** Distance travelled from the start, 0..length. */
  pos: number;
  private dir: 1 | -1 = 1;
  private waiting = 0;

  constructor(private readonly spec: PathSpec) {
    this.length = Math.abs(spec.travel) * spec.tileSize;
    this.pos = Math.min(1, Math.max(0, spec.offset)) * this.length;
  }

  update(dt: number): void {
    let left = Math.max(0, dt);
    const { speed, wait } = this.spec;
    if (speed <= 0 || this.length <= 0) return;
    while (left > 1e-9) {
      if (this.waiting > 0) {
        const used = Math.min(left, this.waiting);
        this.waiting -= used;
        left -= used;
        continue;
      }
      const distance = this.dir > 0 ? this.length - this.pos : this.pos;
      const time = distance / speed;
      if (left < time) {
        this.pos += this.dir * speed * left;
        return;
      }
      this.pos = this.dir > 0 ? this.length : 0;
      left -= time;
      this.dir = this.dir > 0 ? -1 : 1;
      this.waiting = wait;
    }
  }

  /** Current speed along the path (signed by travel direction), 0 while waiting. */
  get velocity(): number {
    return this.waiting > 0 ? 0 : this.dir * this.spec.speed * Math.sign(this.spec.travel);
  }

  /** Signed displacement from the start along the travel direction. */
  get displacement(): number {
    return this.pos * Math.sign(this.spec.travel);
  }
}

/** Switch state: permanent once activated, or on for `duration` seconds after the last activation. */
export class SwitchModel {
  private remaining = 0;
  private on = false;

  constructor(
    readonly id: string,
    private readonly duration: number,
    private readonly bus: SignalBus,
  ) {}

  get isOn(): boolean {
    return this.on;
  }

  /** Seconds left of a timed switch (0 when off or permanent). */
  get timeLeft(): number {
    return this.on && this.duration > 0 ? this.remaining : 0;
  }

  activate(): boolean {
    const changed = !this.on;
    this.on = true;
    this.remaining = this.duration;
    this.bus.set(this.id, true);
    return changed;
  }

  update(dt: number): void {
    if (!this.on || this.duration <= 0) return;
    this.remaining -= Math.max(0, dt);
    if (this.remaining <= 0) {
      this.on = false;
      this.remaining = 0;
      this.bus.set(this.id, false);
    }
  }

  /** Forgets the state and releases the signal (level restart or destruction). */
  reset(): void {
    this.on = false;
    this.remaining = 0;
    this.bus.set(this.id, false);
  }
}

export function doorShouldBeOpen(opensWith: readonly string[], inverted: boolean, bus: SignalBus): boolean {
  const powered = opensWith.length > 0 && opensWith.every((id) => bus.isOn(id));
  return powered !== inverted;
}

/** Whether a hazard runs given its optional gating switches. */
export function hazardEnabled(gate: { enabledBy?: string; disabledBy?: string }, bus: SignalBus): boolean {
  if (gate.enabledBy !== undefined && !bus.isOn(gate.enabledBy)) return false;
  if (gate.disabledBy !== undefined && bus.isOn(gate.disabledBy)) return false;
  return true;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const boxesOverlap = (a: Box, b: Box): boolean => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
