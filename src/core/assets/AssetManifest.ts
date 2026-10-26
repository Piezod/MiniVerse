/**
 * Asset descriptors. Every visual asset declares a procedural placeholder so the game is always
 * playable; set `url` once a real file (e.g. an AI-generated spritesheet) exists in /public.
 */
export interface AssetCredit {
  author: string;
  source: string;
  license: string;
}

interface BaseAsset {
  key: string;
  credit: AssetCredit;
}

export interface SpriteSheetAsset extends BaseAsset {
  kind: 'spritesheet';
  /** Path relative to /public, e.g. `assets/platformer/spritesheets/explorer.png`. */
  url?: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  drawPlaceholder: (ctx: CanvasRenderingContext2D, frame: number, width: number, height: number) => void;
}

export interface ImageAsset extends BaseAsset {
  kind: 'image';
  url?: string;
  width: number;
  height: number;
  drawPlaceholder: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
}

export interface SynthTone {
  wave: OscillatorType;
  from: number;
  to: number;
  duration: number;
  volume?: number;
}

export interface AudioAsset extends BaseAsset {
  kind: 'audio';
  urls?: string[];
  /** Synthesized with Web Audio while no audio file is provided. */
  fallbackTone?: SynthTone;
}

export type AssetDef = SpriteSheetAsset | ImageAsset | AudioAsset;
