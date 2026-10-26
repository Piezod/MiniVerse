/** Deploy target resolution (pure, shared by vite.config.ts and tests). */
export type AppEnv = 'development' | 'staging' | 'production';

/** Public path of the GitHub Pages site: https://piezod.github.io/MiniVerse/ */
export const PAGES_BASE = '/MiniVerse/';

export interface BuildEnv {
  base: string;
  appEnv: AppEnv;
  /** Short commit id shown in the staging badge ('' when unknown). */
  commit: string;
}

type Env = Readonly<Record<string, string | undefined>>;

const APP_ENVS: readonly AppEnv[] = ['development', 'staging', 'production'];

/**
 * - GitHub Pages (default for builds / preview): base `/MiniVerse/`, production.
 * - Cloudflare Pages (it sets CF_PAGES=1): base `/`, staging, commit from CF_PAGES_COMMIT_SHA.
 * - Local dev server: base `/`, development.
 * VITE_BASE_PATH, VITE_APP_ENV and VITE_COMMIT override each value (e.g. to try staging locally).
 */
export function resolveBuildEnv(env: Env, command: 'build' | 'serve', isPreview = false): BuildEnv {
  const cloudflare = env.CF_PAGES === '1';

  const explicitBase = env.VITE_BASE_PATH;
  if (explicitBase !== undefined && explicitBase !== '' && !/^\/([\w.-]+\/)*$/.test(explicitBase)) {
    throw new Error(`VITE_BASE_PATH must start and end with "/" (got "${explicitBase}")`);
  }
  const base = explicitBase || (cloudflare ? '/' : command === 'build' || isPreview ? PAGES_BASE : '/');

  const explicitEnv = env.VITE_APP_ENV;
  if (explicitEnv !== undefined && explicitEnv !== '' && !APP_ENVS.includes(explicitEnv as AppEnv)) {
    throw new Error(`VITE_APP_ENV must be one of ${APP_ENVS.join(', ')} (got "${explicitEnv}")`);
  }
  const appEnv = (explicitEnv || (cloudflare ? 'staging' : command === 'serve' && !isPreview ? 'development' : 'production')) as AppEnv;

  const rawCommit = env.VITE_COMMIT || env.CF_PAGES_COMMIT_SHA || '';
  const commit = /^[0-9a-f]{7,40}$/i.test(rawCommit) ? rawCommit.slice(0, 7).toLowerCase() : '';
  return { base, appEnv, commit };
}

/** Text of the environment badge; null where nothing must be shown (development and production). */
export function badgeText(appEnv: string, commit: string): string | null {
  return appEnv === 'staging' ? `MiniVerse — STAGING${commit ? ` · ${commit}` : ''}` : null;
}
