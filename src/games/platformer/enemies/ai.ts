/** Enemy AI state selection (Phaser-free, unit tested). */
import type { EnemyDef } from './EnemyCatalog';

export type AiState = 'idle' | 'patrol' | 'chase' | 'attack' | 'hurt' | 'death';

export interface AiSnapshot {
  dead: boolean;
  /** Seconds left of the hurt stun. */
  hurtTime: number;
  /** Seconds left of the current attack. */
  attackTime: number;
  /** Distance to the player in px (Infinity when the player is not targetable). */
  distance: number;
  attackReady: boolean;
}

export function nextAiState(def: EnemyDef, s: AiSnapshot): AiState {
  if (s.dead) return 'death';
  if (s.hurtTime > 0) return 'hurt';
  if (s.attackTime > 0) return 'attack';
  if (def.attack && s.attackReady && s.distance <= def.attack.range) return 'attack';
  const sees = s.distance <= def.detectRange;
  if (sees && (def.movement === 'chase' || def.movement === 'fly')) return 'chase';
  if (def.movement === 'patrol' || def.movement === 'chase') return 'patrol';
  return 'idle';
}
