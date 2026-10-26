import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { badgeText, PAGES_BASE, resolveBuildEnv } from '../build/buildEnv';
import { stagingPlugin } from '../build/stagingPlugin';

const ROOT = join(__dirname, '..');
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8');
const CF = { CF_PAGES: '1', CF_PAGES_COMMIT_SHA: 'ABCDEF1234567890abcdef1234567890abcdef12', CF_PAGES_BRANCH: 'develop' };

describe('destinos de despliegue', () => {
  it('desarrollo local: base "/" y sin badge', () => {
    expect(resolveBuildEnv({}, 'serve')).toEqual({ base: '/', appEnv: 'development', commit: '' });
  });

  it('GitHub Pages (build y preview): base /MiniVerse/ y producción, como antes', () => {
    expect(resolveBuildEnv({}, 'build')).toEqual({ base: PAGES_BASE, appEnv: 'production', commit: '' });
    expect(resolveBuildEnv({}, 'serve', true)).toMatchObject({ base: '/MiniVerse/', appEnv: 'production' });
    // GitHub Actions variables must not turn a production build into staging
    expect(resolveBuildEnv({ GITHUB_ACTIONS: 'true', GITHUB_SHA: 'a'.repeat(40) }, 'build')).toEqual({ base: '/MiniVerse/', appEnv: 'production', commit: '' });
  });

  it('Cloudflare Pages: base "/", staging y commit corto', () => {
    expect(resolveBuildEnv(CF, 'build')).toEqual({ base: '/', appEnv: 'staging', commit: 'abcdef1' });
  });

  it('las variables VITE_* permiten probar staging en local', () => {
    expect(resolveBuildEnv({ VITE_BASE_PATH: '/', VITE_APP_ENV: 'staging', VITE_COMMIT: '1234567890' }, 'build')).toEqual({ base: '/', appEnv: 'staging', commit: '1234567' });
    expect(resolveBuildEnv({ VITE_BASE_PATH: '/sub/dir/' }, 'build').base).toBe('/sub/dir/');
  });

  it('rechaza valores inválidos y descarta commits que no son hexadecimales', () => {
    expect(() => resolveBuildEnv({ VITE_BASE_PATH: 'MiniVerse' }, 'build')).toThrow(/VITE_BASE_PATH/);
    expect(() => resolveBuildEnv({ VITE_BASE_PATH: '/x' }, 'build')).toThrow(/VITE_BASE_PATH/);
    expect(() => resolveBuildEnv({ VITE_APP_ENV: 'qa' }, 'build')).toThrow(/VITE_APP_ENV/);
    expect(resolveBuildEnv({ ...CF, CF_PAGES_COMMIT_SHA: 'not-a-sha' }, 'build').commit).toBe('');
  });
});

describe('indicador de entorno', () => {
  it('solo aparece en staging, con el commit si se conoce', () => {
    expect(badgeText('staging', 'abcdef1')).toBe('MiniVerse — STAGING · abcdef1');
    expect(badgeText('staging', '')).toBe('MiniVerse — STAGING');
    expect(badgeText('production', 'abcdef1')).toBeNull();
    expect(badgeText('development', '')).toBeNull();
  });

  it('main.ts lo monta solo cuando el entorno es staging', () => {
    expect(read('src/main.ts')).toMatch(/if \(__APP_ENV__ === 'staging'\)[^\n]*envBadge/);
  });
});

describe('archivos de staging (noindex)', () => {
  it('genera robots.txt, _headers y la meta noindex únicamente en staging', () => {
    const plugin = stagingPlugin();
    expect(plugin.apply).toBe('build');
    const emitted: Array<{ fileName: string; source: string }> = [];
    (plugin.generateBundle as unknown as () => void).call({ emitFile: (f: { fileName: string; source: string }) => emitted.push(f) });
    const byName = Object.fromEntries(emitted.map((f) => [f.fileName, f.source]));
    expect(byName['robots.txt']).toMatch(/Disallow: \//);
    expect(byName['_headers']).toMatch(/X-Robots-Tag: noindex/);
    expect(byName['_headers']).toMatch(/X-Content-Type-Options: nosniff/);
    const tags = (plugin.transformIndexHtml as unknown as () => Array<{ attrs: { name: string; content: string } }>)();
    expect(tags[0].attrs).toEqual({ name: 'robots', content: 'noindex, nofollow' });
  });

  it('public/ no contiene robots.txt ni _headers que viajarían a producción', () => {
    const names = readdirSync(join(ROOT, 'public'));
    expect(names).not.toContain('robots.txt');
    expect(names).not.toContain('_headers');
  });
});

describe('producción y persistencia intactas', () => {
  it('el workflow de GitHub Pages sigue publicando solo main y no usa Cloudflare', () => {
    const workflow = read('.github/workflows/deploy.yml');
    expect(workflow).toMatch(/push:\s*\n\s*branches: \[main\]/);
    expect(workflow.match(/github\.ref == 'refs\/heads\/main'/g)).toHaveLength(2);
    expect(workflow).not.toMatch(/cloudflare|wrangler|CLOUDFLARE|CF_PAGES|VITE_APP_ENV/i);
    const others = readdirSync(join(ROOT, '.github/workflows')).filter((f) => f !== 'deploy.yml');
    expect(others).toEqual([]);
  });

  it('no hay secretos ni tokens de Cloudflare en el repositorio', () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((n) => {
        if (['node_modules', '.git', 'dist'].includes(n)) return [];
        const p = join(dir, n);
        return statSync(p).isDirectory() ? walk(p) : [p];
      });
    const text = walk(ROOT).filter((f) => /\.(ts|json|md|ya?ml|html|toml)$/.test(f) && !f.endsWith('package-lock.json') && !f.endsWith('staging.test.ts'));
    for (const file of text) expect(readFileSync(file, 'utf8'), file).not.toMatch(/CLOUDFLARE_API_TOKEN|api[_-]?token\s*[:=]|wrangler\.toml/i);
  });

  it('las claves de guardado no cambian (localStorage queda separado por origen)', () => {
    expect(read('src/games/platformer/progression/gameData.ts')).toContain("'miniverse.platformer.profile'");
    expect(read('src/games/platformer/level/levelLoader.ts')).toContain("'miniverse.platformer.progress'");
  });

  it('los assets se cargan con rutas relativas resueltas contra la base (valen con "/" y con "/MiniVerse/")', () => {
    expect(read('src/main.ts')).toContain('baseURL: import.meta.env.BASE_URL');
    const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
    const absolute = walk(join(ROOT, 'src')).filter((f) => f.endsWith('.ts') && /['"`]\/assets\//.test(readFileSync(f, 'utf8')));
    expect(absolute).toEqual([]);
  });

  it('el build para Cloudflare ejecuta los tests antes de compilar', () => {
    const scripts = JSON.parse(read('package.json')).scripts;
    expect(scripts['build:ci']).toBe('npm test && npm run build');
    expect(scripts.build).toBe('tsc --noEmit && vite build');
    expect(read('.node-version').trim()).toBe('20');
  });
});
