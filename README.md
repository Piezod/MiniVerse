# MiniVerse

Plataforma de minijuegos 2D para móvil y PC con Phaser 3, TypeScript y Vite.

## Ejecutar

```bash
npm install
npm run dev        # http://localhost:5173 (también accesible desde el móvil en la misma red)
npm run build      # typecheck + build de producción en dist/
npm run preview    # sirve dist/
```

En VS Code: **F5** (“MiniVerse (Chrome)” o “(Edge)”) arranca Vite y abre el navegador con depuración.
Añade `?debug` a la URL en desarrollo para ver las cajas de colisión.

## Controles (Aventuras Pixel)

| Acción | Teclado | Móvil |
| --- | --- | --- |
| Moverse | ← → / A D | Botones ◀ ▶ |
| Saltar (mantener = más alto) | Espacio / ↑ / W | Botón ▲ |
| Pausa | Esc / P | Botón II |
| Silenciar | M | Botón S |

## Estructura

```
public/assets/platformer/
  spritesheets/ sounds/                         # personajes, objetos y audio comunes
  worlds/<mundo>/{tilesets,backgrounds,decorations}/
src/
  core/            # reutilizable por todos los minijuegos
    art/           # utilidades pixel art (dithering, contornos, círculos nítidos)
    minigame/      # registro, carga diferida y salida al menú
    assets/        # manifiesto tipado + placeholders procedurales
    animation/     # animaciones declarativas por índice de frame
    input/         # acciones teclado + táctil
    audio/ ui/     # sonido, fuente pixel art y botones
  scenes/          # menú principal
  games/
    index.ts       # lista de minijuegos (único punto a tocar para añadir uno)
    platformer/
      assets/      # paleta maestra, sprites de personajes/objetos/FX/UI, animaciones
      worlds/      # temas visuales (tileset, decoración, parallax, partículas)
      level/       # niveles ASCII, parser y autotiling
      view/        # parallax, decoración procedural y partículas
      entities/ scenes/
```

## Estilo visual

- Resolución lógica 320x180 con zoom entero (pixel-perfect) y cámara con suavizado y anticipación.
- Todo el arte actual es **original y procedural** (generado en código con una paleta común), sin assets de terceros.
- Mundo "Bosque Crepuscular": 8 capas parallax, autotiling de terreno, decoración procedural
  (hierba animada, flores, rocas, setas y cristales luminosos, lianas), luciérnagas y pétalos.
- Partículas al saltar, aterrizar, correr, recoger estrellas, derrotar enemigos, morir y activar checkpoints.

## Sustituir gráficos por arte definitivo (p. ej. generado con IA)

1. Genera el PNG respetando el tamaño de frame y el orden documentados:
   - Personajes y objetos: [animations.ts](src/games/platformer/assets/animations.ts) (héroe 32x32, 20 frames en una fila).
   - Tileset: [tileset.ts](src/games/platformer/level/tileset.ts) (256x64, autotile por máscara de vecinos).
   - Decoración y fondos: [worlds/forest/art.ts](src/games/platformer/worlds/forest/art.ts) (fondos 320x180 que encajan en horizontal).
2. Cópialo en `public/assets/platformer/...` y añade `url` y `credit` (autor, origen, licencia) en
   [manifest.ts](src/games/platformer/assets/manifest.ts) o en [worlds/forest/index.ts](src/games/platformer/worlds/forest/index.ts).
3. Si el orden de frames difiere, ajusta solo los arrays `frames` de las animaciones.

Los sonidos funcionan igual (`urls` en `AUDIO`); sin archivo se usa un tono sintetizado.

## Niveles y biomas

- Niveles: archivos JSON en `public/assets/platformer/levels/`, en el orden de `levels.json`.
  Completar un nivel desbloquea el siguiente; el progreso (desbloqueos y mejores estrellas) se guarda en `localStorage`.
- Biomas: `src/games/platformer/biomes/definitions/` (bosque, ruinas, hielo, volcán). Cada uno define paleta,
  estilo de fondos/tileset, decoración, partículas e iluminación; el nivel solo indica `"biome": "<id>"`.
- `npm test` valida todos los niveles (estructura + simulación de saltos con las físicas reales del héroe).

### Añadir un nivel

1. Crea `public/assets/platformer/levels/05-mi-nivel.json`:
   ```json
   { "id": "mi-nivel", "name": "Mi nivel", "biome": "ruins", "height": 14,
     "sections": [ { "rows": ["..P.....S.....O", "###############", "###############"] } ] }
   ```
   Leyenda: `#` suelo, `X` bloque, `=` plataforma atravesable, `P` inicio, `S` estrella, `E` enemigo,
   `K` checkpoint, `O` meta, `1-9` carteles (textos en `"signs"`). Las filas se alinean abajo.
2. Añade `"05-mi-nivel.json"` a `levels.json`.
3. Ejecuta `npm test`: indica saltos imposibles, objetivos inalcanzables y errores de formato.

Límites del héroe (de `physics.ts`): sube hasta 3 tiles, salta huecos de hasta 4 tiles en llano
(3 si además sube 2), y la plataforma de destino debe dejar 2 tiles libres encima.

### Añadir un bioma

Copia un archivo de `biomes/definitions/`, cambia `id`, paleta y estilo, y regístralo en `biomes/index.ts`.
Para usar arte real, indica rutas en `files` (`tiles`, `decorations`, `sky`, `mountains`, ...).

## Añadir un minijuego

1. Crea `src/games/<id>/index.ts` exportando un `MiniGameModule` (escenas con `static KEY`).
2. Regístralo en `src/games/index.ts` con `load: () => import('./<id>')`.
3. Sal al menú con `exitToMenu(scene)`.
