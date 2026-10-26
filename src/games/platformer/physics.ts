/**
 * Player/enemy physics. Phaser-free so the level validator and tests use the exact same values.
 * Derived limits (holding jump, full speed):
 *   max jump height  = v² / 2g = 330² / 1800 ≈ 60 px (3.7 tiles) -> platforms up to 3 tiles higher
 *   air time (flat)  = 2v / g ≈ 0.73 s -> ≈ 73 px horizontally (≈ 4.5 tiles gap)
 */
export const GRAVITY = 900;

/** Units: px, px/s, px/s², seconds. */
export const PLAYER_TUNING = {
  runSpeed: 100,
  groundAccel: 900,
  groundDecel: 1100,
  airAccel: 600,
  jumpVelocity: 330,
  jumpCutVelocity: 120,
  stompBounce: 240,
  maxFallSpeed: 420,
  coyoteTime: 0.1,
  jumpBuffer: 0.1,
  invulnerableTime: 1.5,
} as const;

/** Arcade body of the player, in px. Its bottom edge is the feet. */
export const PLAYER_BODY = { width: 12, height: 22, offsetX: 10, offsetY: 10 } as const;

export const WALKER_SPEED = 28;
