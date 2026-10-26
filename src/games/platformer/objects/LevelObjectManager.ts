import { SignalBus } from './models';
import type { LevelDimensions, LevelObjectConfig, ObjectIssue, ObjectType } from './types';
import { OBJECT_TYPES } from './types';
import { validateObjects } from './validate';

/** Runtime instance of a configured object. Only three things are required of it. */
export interface LevelObject<C extends LevelObjectConfig = LevelObjectConfig> {
  readonly config: C;
  /** Called every unpaused frame with the elapsed seconds. */
  update(dt: number): void;
  /** Releases everything the object created (sprites, bodies, colliders, listeners). Must be idempotent. */
  destroy(): void;
}

/** What every factory receives: the host's context plus the level's shared signal bus. */
export type ObjectContext<Host> = Host & { readonly signals: SignalBus };

export type ObjectFactory<Host, C extends LevelObjectConfig = LevelObjectConfig> = (config: C, ctx: ObjectContext<Host>) => LevelObject<C>;

type FactoryFor<Host, T extends ObjectType> = ObjectFactory<Host, Extract<LevelObjectConfig, { type: T }>>;

/** Maps object type ids to constructors. New object types are added with `register`; the manager never changes. */
export class ObjectRegistry<Host> {
  private readonly factories = new Map<string, ObjectFactory<Host, never>>();

  register<T extends ObjectType>(type: T, factory: FactoryFor<Host, T>): this {
    if (!(OBJECT_TYPES as readonly string[]).includes(type)) throw new Error(`Unknown object type "${type}" (add it to OBJECT_TYPES and the validator first)`);
    if (this.factories.has(type)) throw new Error(`Object type "${type}" is already registered`);
    this.factories.set(type, factory as unknown as ObjectFactory<Host, never>);
    return this;
  }

  has(type: string): boolean {
    return this.factories.has(type);
  }

  get types(): string[] {
    return [...this.factories.keys()];
  }

  create(config: LevelObjectConfig, ctx: ObjectContext<Host>): LevelObject {
    const factory = this.factories.get(config.type);
    if (!factory) throw new Error(`No constructor registered for object type "${config.type}"`);
    return (factory as unknown as ObjectFactory<Host>)(config, ctx);
  }
}

export class ObjectConfigError extends Error {
  constructor(readonly issues: readonly ObjectIssue[]) {
    super(`Invalid level objects:\n${issues.filter((i) => i.severity === 'error').map((i) => `  objects[${i.index}] ${i.message}`).join('\n')}`);
  }
}

/** Longest step an object sees, so a long frame (tab switch, debugger) never teleports hazards or platforms. */
const MAX_STEP = 0.1;

/**
 * Owns the objects of one level run: validates the JSON, creates the objects, updates them and tears
 * them down. The scene calls `update` every frame (a paused scene doesn't call it) and `destroy`
 * when the level restarts or ends.
 */
export class LevelObjectManager<Host> {
  readonly signals = new SignalBus();
  private objects: LevelObject[] = [];
  private isPaused = false;
  private destroyed = false;

  constructor(
    private readonly registry: ObjectRegistry<Host>,
    private readonly host: Host,
  ) {}

  /** Validates and creates the objects. Throws ObjectConfigError instead of ignoring bad configuration. */
  load(raw: unknown, size: LevelDimensions): LevelObject[] {
    if (this.destroyed) throw new Error('LevelObjectManager already destroyed');
    const { objects, issues, ok } = validateObjects(raw, size);
    if (!ok) throw new ObjectConfigError(issues);
    const ctx: ObjectContext<Host> = { ...this.host, signals: this.signals };
    for (const config of objects) {
      try {
        this.objects.push(this.registry.create(config, ctx));
      } catch (error) {
        this.destroy();
        throw error;
      }
    }
    return [...this.objects];
  }

  get count(): number {
    return this.objects.length;
  }

  get list(): readonly LevelObject[] {
    return this.objects;
  }

  get paused(): boolean {
    return this.isPaused;
  }

  /** Looks an object up by its configured id. */
  get(id: string): LevelObject | undefined {
    return this.objects.find((o) => o.config.id === id);
  }

  pause(): void {
    this.isPaused = true;
  }

  resume(): void {
    this.isPaused = false;
  }

  update(dt: number): void {
    if (this.isPaused || this.destroyed) return;
    const step = Math.min(Math.max(dt, 0), MAX_STEP);
    for (const object of this.objects) object.update(step);
  }

  /** Destroys every object (last created first), clears the signals and leaves the manager unusable. Idempotent. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    const objects = this.objects;
    this.objects = [];
    const failures: unknown[] = [];
    for (const object of objects.reverse()) {
      try {
        object.destroy();
      } catch (error) {
        failures.push(error);
      }
    }
    this.signals.clear();
    if (failures.length) throw failures[0];
  }
}
