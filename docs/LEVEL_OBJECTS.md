# Objetos de nivel

Sistema modular de objetos interactivos configurables por JSON: plataformas móviles, láseres, suelos
electrificados, interruptores y puertas. Los objetos se declaran en el nivel (`"objects"`), se validan al cargar
y los crea un registro de constructores; añadir un tipo nuevo no toca el gestor ni la escena.

> Estado: implementado y probado con Vitest (lógica, validación y ciclo de vida). **El comportamiento visual y de
> colisiones en el navegador aún no se ha comprobado**; ver «Pruebas manuales» y «Limitaciones».

## Arquitectura

```
levels/*.json  "objects": [...]
        │  validateObjects()  (objects/validate.ts, sin Phaser)  ← también la ejecuta LevelValidator
        ▼
LevelObjectManager (objects/LevelObjectManager.ts)
   ├─ ObjectRegistry: tipo → constructor        (objects/builtin.ts registra los cinco tipos)
   ├─ SignalBus: señales on/off compartidas      (objects/models.ts)
   └─ LevelObject { config, update(dt), destroy() }
        │
        ▼
PlatformerLevelScene  ── update(dt) cada fotograma sin pausa / pause·resume / destroy al cerrar
```

| Archivo | Responsabilidad |
| --- | --- |
| `objects/types.ts` | Tipos de configuración normalizada (`LevelObjectConfig`) |
| `objects/validate.ts` | Validación, valores por defecto, referencias entre objetos |
| `objects/models.ts` | Lógica pura: `SignalBus`, `HazardCycle`, `PathMotion`, `SwitchModel`, `doorShouldBeOpen` |
| `objects/LevelObjectManager.ts` | Registro, ciclo de vida, pausa, destrucción |
| `objects/builtin.ts` | Vistas Phaser de los cinco tipos (sprites, cuerpos Arcade, efectos) |
| `objects/objectArt.ts` | Texturas pixel art procedurales (`platformer.obj.*`) |
| `objects/sceneHost.ts` | Lo que los objetos reciben de la escena: `scene`, `player`, `fx`, `damagePlayer` |

Decisiones de diseño:

- **Modelo separado de la vista**: tiempos, estados y recorridos son clases puras y comprobables sin Phaser.
- **Sin jerarquía de clases**: cada tipo es una función `(config, ctx) => { config, update, destroy }`.
- **Pausa**: los objetos avanzan solo con `update(dt)`, que la escena llama únicamente si no está pausada. El gestor
  además ignora los fotogramas mientras `pause()` está activo, y recorta cada paso a 0,1 s para que un fotograma
  largo no teletransporte plataformas ni peligros.
- **Daño**: pasa por `damagePlayer` de la escena (mismo camino que los enemigos), que respeta las
  invulnerabilidad temporal; los peligros no golpean mientras `player.isInvulnerable` o si ha muerto.
- **Limpieza**: al reiniciar o cambiar de nivel la escena destruye el gestor (sprites, cuerpos, colliders y señales);
  el nivel nuevo crea uno limpio, sin señales ni tiempos heredados.
- **Errores visibles**: la validación rechaza tipos y campos desconocidos, y `LevelObjectManager.load` lanza
  `ObjectConfigError` listando todos los problemas en lugar de ignorarlos.

## Coordenadas

`col` / `row` son coordenadas de **tile** de la rejilla del nivel (la fila 0 es la superior; las secciones se
alinean por abajo como siempre). Un tile mide 16 px. Los id son minúsculas, números y guiones.

## Tipos y esquemas

Campos comunes: `type` (obligatorio), `id` (único; obligatorio solo en `switch`), `col`, `row` (obligatorios).
Un campo que no figura en el esquema del tipo es un error.

### `movingPlatform`

Losa que sólo colisiona por arriba (se puede atravesar saltando desde abajo y nunca aplasta) y que transporta al jugador.

| Campo | Valores | Por defecto |
| --- | --- | --- |
| `width` | entero 1–12 (tiles) | 3 |
| `axis` | `"x"` \| `"y"` | obligatorio |
| `travel` | entero ≠ 0, −40…40; positivo = derecha/abajo, negativo = izquierda/arriba | obligatorio |
| `speed` | 10–160 px/s | 40 |
| `wait` | 0–10 s de espera en cada extremo | 0.5 |
| `offset` | 0–1, posición inicial en el recorrido | 0 |

`col`/`row` es la esquina superior izquierda al inicio del recorrido.

### `laser`

Emisor más haz. Fases: apagado → aviso (haz tenue parpadeante) → activo. Solo daña en la fase activa.

| Campo | Valores | Por defecto |
| --- | --- | --- |
| `orientation` | `"horizontal"` (hacia la derecha) \| `"vertical"` (hacia abajo) | obligatorio |
| `length` | entero 1–40 (tiles tras el emisor) | 4 |
| `damage` | 0.5–3 | 1 |
| `mode` | `"periodic"` \| `"permanent"` | `periodic` |
| `on` / `off` / `warning` | 0.2–30 / 0–30 / 0–5 s | 1.5 / 1.5 / 0.6 |
| `offset` | 0–60 s (adelanta el ciclo) | 0 |
| `enabledBy` / `disabledBy` | id de un `switch` (no ambos) | — |

### `electricFloor`

Placa electrificada en la fila `row` (la fila transitable justo encima del suelo). Solo es peligrosa su franja inferior
(7 px), así que saltar por encima es seguro. Mismos campos de ciclo que el láser (`mode`, `on`, `off`, `warning`,
`offset`, `enabledBy`, `disabledBy`, `damage`) y `width` (entero 1–20, por defecto 3).

### `switch`

Se activa al pisarlo (contacto con el jugador). `id` obligatorio.

| Campo | Valores | Por defecto |
| --- | --- | --- |
| `duration` | 0 = permanente; 0–120 s = tiempo encendido tras la última activación | 0 |

### `door`

Bloquea el paso mientras está cerrada; ocupa `height` tiles hacia abajo desde `row`.

| Campo | Valores | Por defecto |
| --- | --- | --- |
| `height` | entero 1–8 | 3 |
| `opensWith` | id de interruptor o lista; se abre cuando **todos** están encendidos | obligatorio |
| `inverted` | `true` = abierta por defecto y cerrada mientras los interruptores están encendidos | `false` |

Una puerta nunca se cierra sobre el jugador: espera a que despeje el hueco. Varias puertas pueden compartir interruptor.

## Validación

`validateObjects(raw, {width, height})` comprueba: lista válida (máx. 200 objetos), tipos, campos desconocidos,
enteros y rangos, límites del nivel (también el recorrido completo de plataformas y la longitud del haz), ids únicos,
`id` de los interruptores, `opensWith` / `enabledBy` / `disabledBy` apuntando a interruptores existentes, y
`enabledBy`+`disabledBy` a la vez. Un interruptor que nada usa genera un aviso (no un error).
`LevelValidator` la ejecuta con las dimensiones del nivel parseado y antepone `objects[i]:` a cada mensaje.

## Ejemplos

Plataforma horizontal sobre un foso y plataforma vertical (sube 6 tiles):

```json
"objects": [
  { "type": "movingPlatform", "id": "pit", "col": 12, "row": 12, "width": 3, "axis": "x", "travel": 7, "speed": 40, "wait": 0.6 },
  { "type": "movingPlatform", "id": "lift", "col": 51, "row": 12, "width": 3, "axis": "y", "travel": -6, "speed": 35, "wait": 1 }
]
```

Láser periódico que un interruptor temporizado apaga durante 6 s:

```json
"objects": [
  { "type": "switch", "id": "laser-off", "col": 34, "row": 11, "duration": 6 },
  { "type": "laser", "col": 38, "row": 5, "orientation": "vertical", "length": 6,
    "on": 1.2, "off": 1.6, "warning": 0.7, "disabledBy": "laser-off" }
]
```

Suelo electrificado y una puerta con dos interruptores:

```json
"objects": [
  { "type": "electricFloor", "col": 25, "row": 11, "width": 3, "on": 1.2, "off": 1.6, "warning": 0.7 },
  { "type": "switch", "id": "a", "col": 4, "row": 11 },
  { "type": "switch", "id": "b", "col": 8, "row": 11, "duration": 10 },
  { "type": "door", "col": 20, "row": 9, "height": 3, "opensWith": ["a", "b"] }
]
```

## Compatibilidad

`objects` es opcional: un nivel sin él se valida y juega exactamente igual que antes (los cuatro niveles originales
no se han modificado y hay un test que lo comprueba). Los campos con valores por defecto pueden omitirse.

## Cómo añadir un objeto nuevo

1. Añade su id a `OBJECT_TYPES` y su interfaz de configuración a `LevelObjectConfig` (`objects/types.ts`).
2. Declara sus campos, rangos y valores por defecto en `ALLOWED` y en el `switch` de `validateObjects` (`validate.ts`).
3. Si tiene tiempos o estados, escribe su modelo puro en `models.ts` y pruébalo.
4. Escribe su constructor `(config, ctx) => LevelObject` en `builtin.ts` y regístralo en `createDefaultRegistry()`.
   El contexto trae `scene`, `player`, `fx`, `damagePlayer` y `signals`; `destroy()` debe liberar todo lo creado y ser idempotente.
5. Si necesita arte, añade una textura procedural en `objectArt.ts` (se limpian solas con el prefijo `platformer.obj.`).
6. Añade tests (validación, modelo y ciclo de vida).

## Escenario técnico

Nivel independiente de la campaña (`sandbox/objectsLevel.ts`, id `sandbox-objects`) con: plataforma horizontal sobre un
foso, suelo electrificado, interruptor temporizado que apaga un láser periódico, interruptor y puerta, y plataforma
vertical hasta la meta. No está en `levels.json` ni en `campaign.json`, solo existe en modo desarrollo (no se incluye en
los builds de staging ni producción) y no guarda estrellas, progreso ni nada en `localStorage`.

1. `npm run dev` y abre http://localhost:5173/.
2. Entra en el juego de plataformas.
3. En el mapa de capítulos pulsa el botón **DEV: TEST OBJETOS** o la tecla **O**.
4. Pausa (`Esc`/`P`), reinicia y sal con los menús habituales. La meta no registra progreso.

## Pruebas manuales recomendadas

- La plataforma horizontal transporta al jugador sin vibrar y se puede cruzar el foso; saltar desde ella funciona.
- La plataforma vertical sube y baja con el jugador encima; saltar hacia arriba desde debajo la atraviesa.
- El láser avisa antes de activarse y solo daña cuando el haz es brillante; con invulnerabilidad no encadena golpes.
- El suelo avisa (placas amarillas), descarga con chispas y se puede saltar por encima.
- Pisar el interruptor temporizado apaga el láser unos 6 s (parpadea al final); el otro abre la puerta.
- Pausar durante cualquiera de estos ciclos congela plataformas, hazards y el temporizador, y reanudar continúa.
- Morir y reaparecer, reiniciar y volver a entrar al nivel dejan todo limpio (puerta cerrada, láser en ciclo, plataformas al inicio).

## Limitaciones conocidas

- **No verificado en navegador**: colisiones (carga de la plataforma, puerta, aplastamiento), efectos visuales y
  sensación de juego están pendientes de revisión manual.
- La simulación de alcanzabilidad del validador solo conoce el terreno: en niveles con objetos los avisos de «inalcanzable»
  pasan a ser advertencias y no se garantiza que el nivel sea completable.
- Los enemigos no colisionan con plataformas ni puertas, y los proyectiles las atraviesan; los láseres no se
  detienen ante el terreno ni dañan a los enemigos.
- Las plataformas colisionan solo por arriba (decisión de estabilidad); no hay plataformas sólidas ni que desaparezcan.
- Los interruptores se activan por contacto (no hay botón de interacción ni disparo); sus estados no se reinician al
  reaparecer tras morir, solo al reiniciar el nivel.
- Un peligro permanente con `enabledBy`/`disabledBy` avisa tras reactivarse; sin gating está activo desde el inicio.
- Las texturas son provisionales (arte procedural); no hay sonido propio salvo el del interruptor.
