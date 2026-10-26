import { defineConfig, loadEnv } from 'vite';
import { resolveBuildEnv } from './build/buildEnv';
import { stagingPlugin } from './build/stagingPlugin';

/**
 * Deploy targets (see build/buildEnv.ts and docs/STAGING.md):
 * - GitHub Pages production: builds use the `/MiniVerse/` subpath.
 * - Cloudflare Pages staging (CF_PAGES=1): served from `/`, with noindex files and an environment badge.
 * - Local dev server: `/`.
 */
export default defineConfig(({ command, mode, isPreview }) => {
  const target = resolveBuildEnv(loadEnv(mode, '.', ''), command, isPreview);
  return {
    base: target.base,
    define: { __APP_ENV__: JSON.stringify(target.appEnv), __APP_COMMIT__: JSON.stringify(target.commit) },
    plugins: target.appEnv === 'staging' ? [stagingPlugin()] : [],
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
  };
});
