import type Phaser from 'phaser';

/** A scene class that exposes its key statically so the launcher can register it lazily. */
export type MiniGameSceneClass = (new () => Phaser.Scene) & { readonly KEY: string };

/** Runtime part of a minigame, loaded on demand (code-split) when the player selects it. */
export interface MiniGameModule {
  readonly entryScene: string;
  readonly scenes: readonly MiniGameSceneClass[];
  /** Frees textures, sounds and animations when returning to the menu. */
  unload?(game: Phaser.Game): void;
}

/** Lightweight metadata shown in the main menu. Must not import the game's code eagerly. */
export interface MiniGameInfo {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly accentColor: number;
  load(): Promise<MiniGameModule>;
}
