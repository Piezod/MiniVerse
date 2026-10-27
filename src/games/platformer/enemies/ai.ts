/** Enemy AI state selection (Phaser-free, unit tested). */
import type { EnemyDef } from './EnemyCatalog';

export type AiState = 'idle' | 'patrol' | 'chase' | 'attack' | 'recover' | 'hurt' | 'death';

export interface AiSnapshot {
  dead: boolean;
  /** Seconds left of the hurt stun. */
  hurtTime: number;
  /** Seconds left of the current attack. */
  attackTime: number;
  /** Distance to the player in px (Infinity when the player is not targetable). */
  distance: number;
  attackReady: boolean;
  recoveryTime?: number;
  targetInFront?: boolean;
}

export function nextAiState(def: EnemyDef, s: AiSnapshot): AiState {
  if (s.dead) return 'death';
  if (s.hurtTime > 0) return 'hurt';
  if ((s.recoveryTime ?? 0) > 0) return 'recover';
  if (s.attackTime > 0) return 'attack';
  const distance = s.targetInFront === false ? Infinity : s.distance;
  if (def.attack && s.attackReady && distance <= def.attack.range) return 'attack';
  const sees = distance <= def.detectRange;
  if (sees && (def.movement === 'chase' || def.movement === 'fly' || def.movement === 'hover')) return 'chase';
  if (def.movement === 'patrol' || def.movement === 'chase' || def.movement === 'hover') return 'patrol';
  return 'idle';
}
