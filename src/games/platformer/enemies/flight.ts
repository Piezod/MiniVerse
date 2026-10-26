/** Flight behaviour of hovering enemies (Phaser-free, unit tested). Parameters come from enemies.json ("patrol"). */
import type { PatrolZone } from './EnemyCatalog';

export interface Point {
  x: number;
  y: number;
}

export interface Velocity {
  vx: number;
  vy: number;
}

const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

/**
 * Sweeps left and right inside the zone around `home` while bobbing vertically. An enemy pushed out of the
 * zone (knockback, chase) flies back to it.
 */
export function hoverPatrol(pos: Point, home: Point, zone: PatrolZone, speed: number, dir: 1 | -1, elapsed: number): Velocity & { dir: 1 | -1 } {
  let next = dir;
  if (pos.x >= home.x + zone.range) next = -1;
  else if (pos.x <= home.x - zone.range) next = 1;
  if (Math.abs(pos.x - home.x) > zone.range + 1) next = Math.sign(home.x - pos.x) > 0 ? 1 : -1;
  const wanted = home.y + Math.sin(elapsed * 2) * zone.bob;
  return { vx: next * speed, vy: clamp((wanted - pos.y) * 2, -speed, speed), dir: next };
}

/** Flies straight at the target but never farther than `leash` px beyond the patrol zone. */
export function leashedChase(pos: Point, target: Point, home: Point, zone: PatrolZone, speed: number): Velocity {
  const dx = target.x - pos.x;
  const dy = target.y - pos.y;
  const length = Math.hypot(dx, dy) || 1;
  const standoff = zone.standoff ?? 0;
  const direction = standoff > 0 ? (length < standoff - 12 ? -1 : length > standoff + 12 ? 1 : 0) : 1;
  let vx = (dx / length) * speed * direction;
  let vy = (dy / length) * speed * direction;
  const minX = home.x - zone.range - zone.leash;
  const maxX = home.x + zone.range + zone.leash;
  const minY = home.y - zone.bob - zone.leash;
  const maxY = home.y + zone.bob + zone.leash;
  if ((pos.x <= minX && vx < 0) || (pos.x >= maxX && vx > 0)) vx = 0;
  if ((pos.y <= minY && vy < 0) || (pos.y >= maxY && vy > 0)) vy = 0;
  return { vx, vy };
}

/** Straight dash toward a point at `power` px/s (lunge attacks). */
export function lungeVelocity(from: Point, to: Point, power: number): Velocity {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  return { vx: (dx / length) * power, vy: (dy / length) * power };
}

/** On/off blink of the attack warning (about 6 flashes per second). */
export const telegraphOn = (elapsed: number): boolean => Math.floor(elapsed * 12) % 2 === 0;
