import type Phaser from 'phaser';
import type { ActionInput } from '../../../core/input/ActionInput';
import type { CombatSystem } from '../combat/CombatSystem';
import type { Cooldown, EnergyPool } from '../combat/resources';
import type { PlatformerAction } from '../config';
import type { Player } from '../entities/Player';
import type { PlatformerFx } from '../view/PlatformerFx';
import type { AbilityDef, AbilityLevel } from './AbilityCatalog';

/** Everything an ability may use. Abilities never reach into the scene or player internals. */
export interface AbilityContext {
  scene: Phaser.Scene;
  player: Player;
  input: ActionInput<PlatformerAction>;
  energy: EnergyPool;
  combat: CombatSystem;
  fx: PlatformerFx;
}

export interface AbilityInstance {
  readonly def: AbilityDef;
  readonly level: number;
  readonly cooldown: Cooldown;
  /** `held`/`pressed` refer to the ability's slot button (always false for passives). */
  update(dt: number, held: boolean, pressed: boolean): void;
}

/** A module turns a configured ability level into a runtime instance. */
export type AbilityModule = (ctx: AbilityContext, def: AbilityDef, level: number, stats: AbilityLevel) => AbilityInstance;

/** Reads a numeric parameter with a default, so configs can omit values. */
export const param = (stats: AbilityLevel, key: string, fallback: number): number => stats.params[key] ?? fallback;
