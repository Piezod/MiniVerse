import { defineConfig } from 'vite';

/** Public URL on GitHub Pages: https://piezod.github.io/MiniVerse/ */
const PAGES_BASE = '/MiniVerse/';

export default defineConfig(({ command, isPreview }) => ({
  // Dev server keeps serving from the root; builds and `vite preview` use the Pages subpath.
  base: command === 'build' || isPreview ? PAGES_BASE : '/',
  server: {
    // Exposed on the LAN so the game can be tested from a phone on the same network.
    host: true,
    port: 5173,
    strictPort: true,
  },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: { phaser: ['phaser'] },
      },
    },
  },
}));
