import { type BiomeDefinition, createBiome } from '../createBiome';
import { ICE_DEFINITION } from './ice';

/**
 * Estación espacial (capítulo 1, "La estación fantasma"). Provisional: reutiliza el generador procedural y
 * parte de la paleta del bioma de hielo. Cada textura se puede sustituir por un PNG con `files` (base o variante).
 *
 * Variantes (a las que apuntan los episodios de campaign.json):
 * - hangar: solo iluminación, comparte todas las texturas del bioma base.
 * - corridors: iluminación y partículas propias, comparte texturas.
 * - reactor: paleta verde/ámbar, texturas propias.
 * - boss: paleta roja de alarma, texturas propias.
 */
export const STATION_DEFINITION: BiomeDefinition = {
  ...ICE_DEFINITION,
  id: 'station',
  name: 'Estacion espacial',
  sign: 'console',
  accentColor: '#4ad8ff',
  seed: 71,
  palette: {
    ...ICE_DEFINITION.palette,
    sky: [
      [0, '#04050d'],
      [0.5, '#0a1130'],
      [1, '#16224a'],
    ],
    halo: '#2a3a7a',
    star: '#cfe8ff',
    moon: '#9fb4d8',
    moonShade: '#5c6f98',
    peak: '#2a3050',
    mountain: '#1b2040',
    mountainLight: '#2e3562',
    mist: '#3a4a7a',
    hills: '#161a33',
    hillsLight: '#262c50',
    treesFar: '#12152b',
    treesFarLight: '#1f2444',
    treesNear: '#0b0d1c',
    treesNearLight: '#181c38',
    foreground: '#0a0b18',
    surfaceLight: '#8d9bc0',
    surface: '#5c6890',
    surfaceDark: '#3d4668',
    surfaceShadow: '#262c48',
    soilLight: '#4a5272',
    soil: '#343b58',
    soilDark: '#262b44',
    soilDeep: '#1a1e32',
    rockLight: '#aeb8d8',
    rock: '#7a86ae',
    rockDark: '#525c82',
    rockDeep: '#343c5a',
    accent: '#4ad8ff',
    accentLight: '#bff3ff',
    accent2: '#ffb347',
    glow: '#4ad8ff',
    glowLight: '#d8faff',
    crystal: '#4ad8ff',
    crystalDark: '#2a7aa8',
    crystalAlt: '#ffb347',
  },
  style: {
    celestial: 'moon',
    stars: 70,
    peaks: 'cave',
    snowLine: null,
    hillProps: 'columns',
    far: 'colonnade',
    near: 'pillars',
    surface: 'ash',
    blocks: 'carved',
    foreground: 'drifts',
  },
  // Provisional set: debris, energy cores and hanging cables stand in for station props.
  decorations: [
    { type: 'pebbles', weight: 3 },
    { type: 'boulder', weight: 1 },
    { type: 'crystals', weight: 1.2, glow: '#4ad8ff' },
    { type: 'hanging', weight: 4 },
  ],
  decorationDensity: { top: 0.25, bottom: 0.4 },
  ambient: [{ particle: 'pixel', colors: ['#bff3ff', '#4ad8ff'], frequency: 260, lifespan: [4000, 7000], speedX: [-3, 3], speedY: [-4, 2], additive: true }],
  lighting: { vignette: 0.4, overlay: { color: 0x4a78ff, alpha: 0.05, blend: 'add' } },
  dust: ['#8d9bc0', '#bff3ff', '#5c6890'],
  variants: {
    hangar: {
      name: 'Hangar',
      decorations: [
        { type: 'emergency', weight: 3, on: ['ground', 'stone'] },
        { type: 'console', weight: 2, on: ['ground', 'stone'] },
        { type: 'capsule', weight: 2, on: ['ground'] },
        { type: 'container', weight: 3, on: ['ground', 'stone'] },
        { type: 'alienTech', weight: 1, on: ['ground', 'stone'] },
        { type: 'wallPanel', weight: 2, on: ['ground', 'stone'] },
      ],
      decorationDensity: { top: 0.4, bottom: 0 },
      lighting: { vignette: 0.3, overlay: { color: 0x6aa8ff, alpha: 0.07, blend: 'add' } },
    },
    corridors: {
      name: 'Pasillos de seguridad',
      accentColor: '#ffb347',
      lighting: { vignette: 0.5, overlay: { color: 0xffa040, alpha: 0.06, blend: 'add' } },
      ambient: [
        { particle: 'square', colors: ['#d8e4ff', '#8d9bc0'], frequency: 180, lifespan: [3000, 5000], speedX: [-6, 6], speedY: [-14, -4] },
        { particle: 'pixel', colors: ['#ffb347'], frequency: 500, lifespan: [1500, 3000], speedX: [-8, 8], speedY: [-8, 8], additive: true },
      ],
    },
    reactor: {
      name: 'Reactor',
      accentColor: '#7dff9a',
      palette: {
        sky: [
          [0, '#030a06'],
          [0.5, '#06200f'],
          [1, '#0e3a1c'],
        ],
        halo: '#1f7a3a',
        mist: '#2a7a4a',
        accent: '#7dff9a',
        accentLight: '#e0ffe8',
        accent2: '#ffd24a',
        glow: '#7dff9a',
        glowLight: '#e0ffe8',
        crystal: '#7dff9a',
        crystalDark: '#2a8a4a',
        crystalAlt: '#ffd24a',
      },
      decorations: [
        { type: 'crystals', weight: 3, glow: '#7dff9a' },
        { type: 'pebbles', weight: 2 },
        { type: 'hanging', weight: 3 },
      ],
      ambient: [{ particle: 'pixel', colors: ['#7dff9a', '#ffd24a'], frequency: 140, lifespan: [1500, 3500], speedX: [-10, 10], speedY: [-20, -6], additive: true }],
      lighting: { vignette: 0.5, overlay: { color: 0x40ff80, alpha: 0.09, blend: 'add' } },
      dust: ['#7dff9a', '#e0ffe8'],
    },
    boss: {
      name: 'Sala de control',
      accentColor: '#ff4a5a',
      palette: {
        sky: [
          [0, '#0f0306'],
          [0.5, '#2a0710'],
          [1, '#4a0e1a'],
        ],
        halo: '#7a1f2f',
        mist: '#7a2a3a',
        accent: '#ff4a5a',
        accentLight: '#ffc0c8',
        accent2: '#ffb347',
        glow: '#ff4a5a',
        glowLight: '#ffd0d6',
        crystal: '#ff4a5a',
        crystalDark: '#8a1f2f',
        crystalAlt: '#ffb347',
      },
      ambient: [{ particle: 'pixel', colors: ['#ff4a5a', '#ffb347'], frequency: 200, lifespan: [2000, 4000], speedX: [-6, 6], speedY: [-10, 4], additive: true }],
      lighting: { vignette: 0.55, overlay: { color: 0xff2a3a, alpha: 0.1, blend: 'add' } },
      dust: ['#ff4a5a', '#ffc0c8'],
    },
  },
};

export const STATION = createBiome(STATION_DEFINITION);
