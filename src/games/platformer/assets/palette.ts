/**
 * Master palette for "Aventuras Pixel" actors, items and UI. Worlds define their own environment
 * palettes but should reuse OUTLINE and stay within this value/saturation range.
 */
export const PALETTE = {
  outline: '#141327',
  white: '#fff8ec',

  skin: '#ffd7b5',
  skinShade: '#e8a58c',
  blush: '#ff9aa2',
  hair: '#6b3a5e',
  cap: '#3fb08a',
  capLight: '#7ee0b0',
  capDark: '#257060',
  scarf: '#ff7a45',
  scarfLight: '#ffb070',
  scarfDark: '#c84a3a',
  coat: '#4a6fd8',
  coatLight: '#7a9cf0',
  coatDark: '#33489a',
  pants: '#2e2c58',
  pantsDark: '#221f45',
  boot: '#7a4232',
  bootLight: '#a8603e',

  gold: '#ffd56b',
  goldLight: '#fff3c4',
  goldDark: '#e8963a',

  metal: '#7a7caa',
  metalLight: '#a9abd0',
  metalDark: '#52547e',
  moss: '#62c47c',
  mossLight: '#b4ec9a',
  glow: '#8ff5ff',
  glowDark: '#4ab0d0',
  void: '#2b1d4a',
  voidLight: '#6a3fb0',
  stone: '#6e6a92',
  stoneLight: '#9c98bf',
  stoneDark: '#48446a',
  heart: '#ff5a7a',
  heartDark: '#b8334f',
} as const;

/** Numeric versions for tints and particles. */
export const hex = (color: string): number => parseInt(color.slice(1), 16);
