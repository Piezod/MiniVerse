import type { Plugin } from 'vite';

const ROBOTS = 'User-agent: *\nDisallow: /\n';

/** Cloudflare Pages `_headers`: noindex plus basic hardening. HTTPS is enforced by Cloudflare. */
const HEADERS = `/*
  X-Robots-Tag: noindex, nofollow, noarchive
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), geolocation=(), microphone=()
`;

/** Only added to staging builds, so the production bundle (GitHub Pages) is untouched. */
export function stagingPlugin(): Plugin {
  return {
    name: 'miniverse-staging',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { name: 'robots', content: 'noindex, nofollow' }, injectTo: 'head' },
    ],
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: ROBOTS });
      this.emitFile({ type: 'asset', fileName: '_headers', source: HEADERS });
    },
  };
}
