/** Level object configuration types (Phaser-free). Objects are declared per level in the level JSON under "objects". */

export const OBJECT_TYPES = ['movingPlatform', 'laser', 'electricFloor', 'switch', 'door'] as const;
export type ObjectType = (typeof OBJECT_TYPES)[number];

/** Hazard timeline: off → warning → active, repeating. `permanent` skips the cycle (after the warning when gated). */
export interface HazardTiming {
  mode: 'permanent' | 'periodic';
  /** Seconds the hazard is dangerous. */
  on: number;
  /** Seconds it is inactive. */
  off: number;
  /** Seconds of visual warning before it turns on. */
  warning: number;
  /** Seconds the cycle starts already advanced, to desynchronize hazards. */
  offset: number;
}

/** A hazard can be gated by a switch signal: only runs while it is on (enabledBy) or off (disabledBy). */
export interface Gated {
  enabledBy?: string;
  disabledBy?: string;
}

interface Base {
  /** Unique within the level; required by switches, optional for the rest. */
  id?: string;
  /** Tile coordinates in the level grid (row 0 = top). */
  col: number;
  row: number;
}

export interface MovingPlatformConfig extends Base {
  type: 'movingPlatform';
  /** Width in tiles. */
  width: number;
  axis: 'x' | 'y';
  /** Signed distance in tiles from the start: positive = right/down, negative = left/up. */
  travel: number;
  /** px/s. */
  speed: number;
  /** Seconds it waits at each end. */
  wait: number;
  /** Start position along the path, 0..1. */
  offset: number;
}

export interface LaserConfig extends Base, HazardTiming, Gated {
  type: 'laser';
  /** The beam runs right (horizontal) or down (vertical) from the emitter tile. */
  orientation: 'horizontal' | 'vertical';
  /** Beam length in tiles after the emitter. */
  length: number;
  damage: number;
}

export interface ElectricFloorConfig extends Base, HazardTiming, Gated {
  type: 'electricFloor';
  /** Width in tiles. The strip occupies the walkable row `row`, on top of the floor below it. */
  width: number;
  damage: number;
}

export interface SwitchConfig extends Base {
  type: 'switch';
  id: string;
  /** 0 = stays on once activated; otherwise seconds it stays on after the last activation. */
  duration: number;
}

export interface DoorConfig extends Base {
  type: 'door';
  /** Height in tiles, growing downwards from (col, row). */
  height: number;
  /** Switch ids; the door opens when ALL of them are on. */
  opensWith: string[];
  /** Open by default and closed while the switches are on. */
  inverted: boolean;
}

export type LevelObjectConfig = MovingPlatformConfig | LaserConfig | ElectricFloorConfig | SwitchConfig | DoorConfig;

export interface ObjectIssue {
  severity: 'error' | 'warning';
  /** Index in the "objects" list (-1 for the list itself). */
  index: number;
  message: string;
}

export interface LevelDimensions {
  width: number;
  height: number;
  externalSignals?: readonly string[];
}
