import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
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
});
