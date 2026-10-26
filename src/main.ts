import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './core/config';
import { computeZoom, enableResponsiveZoom } from './core/scaling';
import { registerGames } from './games';
import { MainMenuScene } from './scenes/MainMenuScene';

registerGames();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#000000',
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.NONE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    zoom: computeZoom(),
  },
  physics: {
    default: 'arcade',
    // Add ?debug to the URL in dev to see collision boxes.
    arcade: { debug: import.meta.env.DEV && new URLSearchParams(window.location.search).has('debug') },
  },
  input: { activePointers: 3 },
  // Relative asset paths ('assets/...') resolve against the deploy base ('/' locally, '/MiniVerse/' on Pages).
  loader: { baseURL: import.meta.env.BASE_URL },
  scene: [MainMenuScene],
});

enableResponsiveZoom(game);

// Dev-only handle for debugging from the browser console / automated tests.
if (import.meta.env.DEV) (window as unknown as { __game: Phaser.Game }).__game = game;
