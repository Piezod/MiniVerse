# Staging en Cloudflare Pages

Entorno de pruebas público que se publica solo con cada push/merge a `develop`. Es independiente de
producción (GitHub Pages, rama `main`), que no cambia.

| | Producción | Staging |
| --- | --- | --- |
| Rama | `main` | `develop` |
| Plataforma | GitHub Pages (workflow `.github/workflows/deploy.yml`) | Cloudflare Pages (integración Git) |
| URL | https://piezod.github.io/MiniVerse/ | `https://<proyecto>.pages.dev/` (se conoce al crear el proyecto) |
| Ruta base de Vite | `/MiniVerse/` | `/` |
| Aviso en pantalla | no | `MiniVerse — STAGING · <commit>` |
| Indexación | normal | `noindex` |

`feature/*` no se publica en ninguna parte. No hay GitHub Actions para staging: Cloudflare construye
directamente desde GitHub, así que no hay despliegues duplicados.

## Cómo funciona en el repositorio

- `build/buildEnv.ts` decide base, entorno y commit. Cloudflare define `CF_PAGES=1` y
  `CF_PAGES_COMMIT_SHA` durante su build; con eso el proyecto compila para `/` y como staging sin
  configurar variables a mano. Sin `CF_PAGES` todo se comporta como antes (`npm run build` →
  `/MiniVerse/`, `npm run dev` → `/`).
- Solo en staging, `build/stagingPlugin.ts` añade `robots.txt` (`Disallow: /`), `_headers`
  (`X-Robots-Tag: noindex`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`) y la etiqueta
  `<meta name="robots" content="noindex">`. Producción no incluye nada de esto.
- El aviso `MiniVerse — STAGING · abc1234` (`src/core/envBadge.ts`) se monta solo si el entorno es staging;
  en producción el código se elimina del bundle.
- Los assets se piden con rutas relativas (`assets/...`) resueltas con `import.meta.env.BASE_URL`, por lo que
  funcionan con `/` y con `/MiniVerse/`.
- `.node-version` fija Node 20 para Cloudflare. El workflow de GitHub Pages sigue usando `lts/*`.
- `npm run build:ci` ejecuta `npm test` y después `npm run build`.
- Overrides opcionales (por ejemplo para probar staging en local):
  `VITE_BASE_PATH=/`, `VITE_APP_ENV=staging`, `VITE_COMMIT=<sha>`.

## 1. Crear el proyecto en Cloudflare Pages

1. Entra en https://dash.cloudflare.com (cuenta gratuita) → **Workers & Pages** → **Create** → pestaña **Pages**.
2. Pulsa **Connect to Git** (no «Upload assets»).
3. Autoriza la aplicación **Cloudflare Pages** en GitHub y concede acceso al repositorio `piezod/MiniVerse`
   (basta con ese repositorio).
4. Selecciona `piezod/MiniVerse` y pulsa **Begin setup**.

## 2. Parámetros

| Campo | Valor |
| --- | --- |
| Project name | `miniverse-staging` (define la URL `miniverse-staging.pages.dev`; si está ocupado, Cloudflare propone otra) |
| Production branch | `develop` |
| Framework preset | `None` |
| Build command | `npm run build:ci` (tests + tipos + build; si algún test falla no se publica) |
| Build output directory | `dist` |
| Root directory | vacío |
| Variables de entorno | ninguna necesaria (Node se toma de `.node-version`) |

Si prefieres no ejecutar tests en Cloudflare, usa `npm run build` (también comprueba tipos).

Pulsa **Save and Deploy**.

## 3. Ramas: solo `develop`

Tras crear el proyecto: **Settings → Builds → Branch control**:

- **Production branch**: `develop`.
- **Automatic preview branch deployments**: *None* (desactiva los despliegues de `feature/*` y de cualquier otra rama).
- Opcional: en **Preview deployments** → *Pull request previews* déjalo desactivado.

Con esto, cada push o merge a `develop` publica staging y ninguna otra rama genera despliegue.
No cambies nada en GitHub Pages: `main` sigue publicándose solo con su workflow.

## 4. Verificar el primer despliegue

1. En **Workers & Pages → miniverse-staging → Deployments** debe aparecer el despliegue con rama `develop`
   y estado *Success*.
2. Abre la URL pública (ver abajo) y comprueba:
   - Abajo a la izquierda aparece `MiniVerse — STAGING · <7 caracteres>` y el commit coincide con el último
     de `develop` (`git rev-parse --short origin/develop`).
   - `https://<tu-proyecto>.pages.dev/robots.txt` muestra `Disallow: /`.
   - En las herramientas de desarrollo → Red, la respuesta de `/` incluye `x-robots-tag: noindex, nofollow, noarchive`.
   - Carga el mapa de capítulos, el Prólogo, la tienda y un nivel (sin errores 404 en la consola).
3. Comprueba que https://piezod.github.io/MiniVerse/ no muestra el aviso.

## 5. URL pública

En **Deployments**, el despliegue de producción (`develop`) muestra su dominio `*.pages.dev`; también está
en la tarjeta del proyecto. Cada despliegue tiene además una URL propia con el hash del commit.

## 6. Errores de compilación

**Workers & Pages → proyecto → Deployments → (despliegue fallido) → View build log**. Causas habituales:
tests que fallan (`npm run build:ci`), errores de TypeScript, o versión de Node (comprueba `.node-version`).
Un despliegue fallido no sustituye al último correcto. Puedes reproducirlo en local con
`CF_PAGES=1 npm run build:ci` (en PowerShell: `$env:CF_PAGES='1'; npm run build:ci`; después
`Remove-Item Env:CF_PAGES`).

## 7. Persistencia y pruebas funcionales

`localStorage` está separado por origen: staging (`*.pages.dev`) y producción (`piezod.github.io`) no
comparten estrellas, compras, armas ni progreso, y las claves (`miniverse.platformer.profile`,
`miniverse.platformer.progress`) no cambian. Staging usa HTTPS siempre.

Lista de validación en la URL de staging (móvil y escritorio):

1. Mapa de capítulos: Prólogo disponible; Estación espacial y Planeta alienígena en «Proximamente».
2. Niveles: solo el bosque abierto; al completarlo se abren las ruinas; vuelta a capítulos con `Esc`.
3. Tienda: comprar, mejorar, equipar en F/R, pantalla de afinidades.
4. Armas: Rayo, Lanzallamas y Cañón láser (requiere completar el nivel de hielo).
5. Táctil: botones de movimiento, salto y armas; mantener y soltar para cargar el láser; dos dedos a la vez.
6. Recargar la página y comprobar que estrellas, compras, armas F/R y niveles completados se conservan.
7. Comprobar que el progreso de staging no aparece en producción.

## 8. Desactivar staging

- **Pausar publicaciones**: Settings → Builds → *Branch control* → desactiva *Automatic deployments*
  (o en Settings → Builds, *Pause builds* si está disponible).
- **Eliminar**: proyecto → **Settings → Delete project**. No afecta a GitHub Pages.
- **Desconectar GitHub**: GitHub → Settings → Applications → *Cloudflare Pages* → Configure → quita
  el acceso al repositorio.

## Notas de seguridad

- `noindex` evita que los buscadores indexen staging, pero **no restringe el acceso**: cualquiera con la URL puede
  jugar. Si más adelante hace falta limitarlo, Cloudflare Access (plan gratuito) puede proteger el dominio
  `*.pages.dev` sin cambiar el código.
- El repositorio no contiene tokens de Cloudflare ni secretos; la integración Git usa la autorización de la
  aplicación de GitHub. No hay funciones de administración en el juego.
- Plan gratuito de Cloudflare Pages: 500 builds al mes y ancho de banda de ficheros estáticos sin límite, de sobra
  para este uso (los límites exactos pueden cambiar; consúltalos en la documentación de Cloudflare).
