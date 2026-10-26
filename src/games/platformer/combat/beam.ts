/** Phaser-free beam helpers (testable). */

/** Nearest `pierce` candidates to the origin; the beam stops being useful after that many hits. */
export function beamTargets<T extends { x: number }>(originX: number, candidates: readonly T[], pierce: number): T[] {
  return [...candidates].sort((a, b) => Math.abs(a.x - originX) - Math.abs(b.x - originX)).slice(0, Math.max(0, Math.floor(pierce)));
}
