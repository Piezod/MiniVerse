# MiniVerse — Auditoría y hoja de ruta de campaña

> Estado: rama `feature/campaign-system` (octubre 2026). La Parte 0 describe lo implementado; las Partes A-D son la auditoría y la propuesta originales, con las marcas ya actualizadas.
> Leyenda: ✅ implementado · 🟡 parcial · ❌ no existe.

---

## Parte 0 — Sistema de campaña implementado

### 0.1 Visión general

```
levels.json (registro de archivos) ──► LevelManager  (niveles válidos, mejores resultados, guardado)
campaign.json (capítulos)          ──► CampaignManager (capítulos, desbloqueos derivados, progreso)
                                          │
              ChapterSelect ──► LevelSelect (por capítulo) ──► Level + HUD
```

| Pieza | Archivo | Responsabilidad |
| --- | --- | --- |
| Registro de capítulos | `public/assets/platformer/campaign.json` | Capítulos declarativos |
| Validación y gestor | `level/CampaignManager.ts` | `buildCampaign` valida; `CampaignManager` consulta y desbloquea |
| Vistas y navegación | `level/campaignView.ts` | Datos de las tarjetas, rejilla y movimiento de selección (sin Phaser, probado) |
| Progreso | `level/LevelManager.ts` | Único dueño de resultados y guardado; el gestor de campaña no guarda nada |
| Carga | `level/levelLoader.ts` | `buildCampaignManager`, `getCampaign` |
| Pantallas | `scenes/PlatformerChapterSelectScene.ts`, `PlatformerLevelSelectScene.ts` | Mapa de capítulos y lista de niveles |
| Variantes | `biomes/createBiome.ts`, `biomes/index.ts` | Herencia de biomas |

Flujo: `Preload → ChapterSelect → LevelSelect(capítulo) → Level`. Desde el nivel, *Niveles* vuelve a la
lista del capítulo; al completar un capítulo el botón es *Capítulos*. La tienda sigue accesible (`T`) desde
ambas pantallas.

### 0.2 Esquema de `campaign.json`

```json
{
  "chapters": [
    {
      "id": "prologue",
      "name": "Prologo",
      "description": "Texto corto para la tarjeta",
      "order": 0,
      "biome": null,
      "levels": ["forest-1", "ruins-1", "ice-1", "volcano-1"],
      "unlock": null,
      "rewards": { "abilities": [{ "id": "jetpack", "level": 1 }] }
    },
    { "id": "station", "name": "...", "order": 1, "planned": true, "plannedLevels": 4,
      "biome": "station", "levels": [], "unlock": { "chapters": ["prologue"] } }
  ]
}
```

- `levels` usa los **ids de nivel** (campo `id` del JSON del nivel), no nombres de archivo.
- `biome`: bioma principal; si no es `null`, todos los niveles deben usarlo. `null` = cada nivel declara el suyo (Prólogo).
- `unlock`: `null` o `{ "chapters": [...] }`. Un capítulo se desbloquea cuando **todos** los capítulos requeridos están completados.
- `planned: true` + `plannedLevels`: capítulo anunciado sin contenido. Debe tener `levels: []`, se muestra como «Proximamente» y nunca es jugable, así que no hay referencias a niveles inexistentes.
- `rewards.abilities`: se validan contra `abilities.json` y se exponen con `earnedRewards()` (derivadas de los capítulos completados).
- Estados: `ready` (jugable), `planned`, `broken` (con errores: se lista, nunca se puede jugar y se informa por consola `[campaign]`; el juego sigue arrancando).
- Se avisa de cualquier nivel válido de `levels.json` que no pertenezca a un capítulo jugable.

### 0.3 Reglas de desbloqueo (todo derivado)

- Un nivel está abierto si su capítulo está desbloqueado y es el primero del capítulo o el anterior está completado.
- Un capítulo está completado cuando todos sus niveles lo están.
- No se guarda «desbloqueado»: solo los mejores resultados. Así no pueden existir estados contradictorios.
- `LevelManager.setUnlockRule` sustituye la regla lineal por la del `CampaignManager`; sin campaña mantiene la regla lineal anterior.

### 0.4 Variantes de bioma

```ts
export const STATION = createBiome({
  id: 'station', /* paleta, estilo, decoraciones... del bioma base */
  variants: {
    hangar:    { palette: { sky: [[0, '#0b1a33'], [1, '#2a4a7a']] }, lighting: { vignette: 0.3 } },
    corridors: { ambient: [/* vapor */], lighting: { overlay: { color: 0xffaa33, alpha: 0.06, blend: 'add' } } },
    reactor:   { palette: { glow: '#7dff9a' }, decorations: [/* ... */] },
    boss:      { files: { tiles: 'assets/platformer/biomes/station/boss-tiles.png' } },
  },
});
```

Cada variante puede sobrescribir `name`, `accentColor`, `palette`, `style`, `decorations`, `decorationDensity`,
`ambient`, `lighting`, `dust`, `files` (PNG) y `seed`. Lo que no se indica se hereda. Paleta, estilo e iluminación
se mezclan campo a campo; las listas (decoraciones, partículas, polvo) sustituyen a las del base.

Texturas: una variante **solo genera las partes que cambian**. Si únicamente cambia iluminación, partículas
o decoraciones, reutiliza las claves de textura del bioma base (0 texturas nuevas); un cambio de paleta regenera
todo; un cambio de estilo regenera todo salvo la niebla; un PNG en `files` o un `seed` distinto afectan solo a su parte.
Los temas existentes (`forest`, `ruins`, `ice`, `volcano`) no cambian de ids ni de claves.

Los niveles eligen variante con `"variant": "hangar"` junto a `"biome": "station"`; el validador rechaza variantes
inexistentes. `getBiome(id, variant)` resuelve el tema y `BIOME_THEMES` lista bases y variantes (precarga y descarga).

### 0.5 Persistencia

- Progreso de niveles (`miniverse.platformer.progress`): **v2** `{ version: 2, best }`. La migración v1 → v2 conserva los mejores resultados y descarta la lista `unlocked` (ahora derivada); se reescribe al cargar.
- Perfil (`miniverse.platformer.profile`): v2 sin cambios (estrellas, compras, mejoras, pasivas y armas F/R).

### 0.6 Cómo añadir

**Un nivel**
1. Crea `levels/<archivo>.json` con `id` único (`variant` opcional) y añádelo al final de `levels.json`.
2. Añade su `id` a la lista `levels` de un capítulo jugable. `npm test` comprueba validez, bioma y que no queden niveles huérfanos.

**Un capítulo** (p. ej. Estación espacial)
1. Crea el bioma (y variantes) y registra la definición en `biomes/index.ts` (`FAMILIES`).
2. Crea los 4 niveles y regístralos en `levels.json`.
3. En `campaign.json`, sustituye `"planned": true`/`plannedLevels` por la lista `levels` con los ids y revisa `unlock` y `rewards`.
4. `npm test`: la validación cruzada detecta niveles inexistentes, biomas distintos, ciclos de desbloqueo y recompensas inválidas.

**Una variante de bioma**: añade una entrada en `variants` del bioma (0.4) y úsala con `"variant"` en los niveles.

### 0.6b Capítulo 1: La estación fantasma (Hangar disponible desde el inicio)

Campaña: **MiniVerse — La última señal** (`campaign` en `campaign.json`: título, sinopsis, protagonista y reparto:
PIEZOD, LUMA, NÉXAR, OMEGA-7). El capítulo `station` publica los cuatro episodios:
Hangar, Pasillos, Reactor y Protocolo OMEGA, con su jefe OMEGA-7.
Prólogo y capítulo 1 están disponibles desde una partida nueva, sin requisitos entre ellos y con el mismo
acceso en local, staging y producción. El capítulo declara cuatro **episodios**:

| Episodio (id del futuro nivel) | Título | Variante | Notas |
| --- | --- | --- | --- |
| `c1-1-hangar` | Despertar en el Hangar | `hangar` | implementado; disponible desde el selector normal |
| `c1-2-corridors` | Pasillos de seguridad | `corridors` | implementado; se abre al completar Hangar |
| `c1-3-reactor` | El reactor inestable | `reactor` | implementado; se abre al completar Pasillos |
| `c1-4-omega` | Protocolo OMEGA | `boss` | implementado; requiere completar Reactor; jefe `omega-7` |

- `episodes` es metadato: `id` (el id que tendrá el nivel), `title`, `summary`, `variant` y `boss` opcionales. En un
  capítulo `planned` no se carga ningún nivel; `plannedLevels` debe coincidir con el número de episodios.
- Se valida que las variantes existan en el bioma del capítulo, que los ids de episodio no se repitan ni choquen con
  niveles registrados, y, al pasar a jugable, que `levels` sea un prefijo de `episodes` en orden, que el nivel use la
  variante declarada y que el jefe sea un enemigo con `boss: true`.
- `CampaignManager.episodesOf(capítulo)` devuelve cada episodio con su nivel, si es jugable y si está completado
  (Hangar disponible; después Pasillos, Reactor y OMEGA en orden). `CampaignManager.meta` expone los metadatos de campaña.
- El bioma `station` y sus cuatro variantes están en `biomes/definitions/station.ts` (arte procedural provisional;
  carpetas `public/assets/platformer/biomes/station/*` listas para PNG vía `files`).

**Hangar recuperado (`feature/level-objects`)**
- `levels/chapter1/01-hangar.json`: seis secciones, 380 x 24 tiles, 27 estrellas, dos checkpoints y doce drones.
- Tres plataformas móviles, tres láseres cíclicos, un suelo eléctrico, un interruptor y dos puertas enlazadas.
- Dron explorador: 1 de vida, velocidad 56, patrulla de 28 px y embestida de 132 px/s tras 0.65 s de aviso.
- Centinela: 3 de vida (sin aumento), velocidad 22, distancia preferida de 96 px y disparo de 82 px/s;
  avisa 0.8 s y recarga durante 3.2 s. Los drones fijan el objetivo al comenzar el aviso, sin perseguirlo durante el ataque.
- Enemigos por sección: 2, 3, 1, 1, 3 y 2. Exploradores separados en altura, centinela junto al suelo eléctrico,
  encuentro mixto entre contenedores y final breve; se conservan refugios y espacio de salto.
- Descanso antes de la terminal, fuera del alcance combinado de patrulla, persecución y disparo de los enemigos finales.
- Ambientación: evacuación incompleta, cápsulas vacías, seguridad alterada por invasores y transmisión fragmentada
  antes del final. Los mensajes ambientales son de una frase y no bloquean el juego.
- Arte provisional: alarmas, consolas, cápsulas, contenedores, paneles y tecnología alienígena en el atlas existente;
  sin colisiones, shaders ni dependencias nuevas. Los frames originales mantienen sus índices; la hoja completa
  tiene ahora 22 frames de 16 x 16 y sigue admitiendo sustitución mediante `files.decorations`.
- Los avisos se apartan del jugador entre los bordes superior e inferior; la terminal conserva su panel pausado.
- LUMA presenta el despertar y las zonas. La terminal reproduce la transmisión y pausa la acción hasta terminar;
  tiene prioridad sobre mensajes ambientales y puede avanzarse con Enter, Espacio o toque.
- Se reutilizan rayo de energía, lanzallamas y cañón láser cargable; no se conceden compras ni armas automáticamente.
- Acceso: Aventuras Pixel -> La estación fantasma -> Despertar en el Hangar, usando la selección normal.
  No existen atajos especiales ni filtros por entorno para el Hangar.
- El prólogo conserva sus cuatro niveles y progresión interna. No se completa ningún nivel automáticamente,
  no se conceden compras o recompensas y no se modifican partidas guardadas para abrir el capítulo 1.
- El equipamiento inicial se conserva sin compras; el nivel es alcanzable sin habilidades y los drones
  pueden vencerse saltando sobre ellos. Las armas ya adquiridas siguen funcionando.
- Completar Hangar persiste sus estrellas y abre Pasillos, pero no completa el capítulo (1/4) ni abre el capítulo 2.
- `tests/chapter1.test.ts` cubre contenido real, narrativa, drones, acceso uniforme, progresión y compatibilidad del prólogo.

### 0.6c Episodio 2: Pasillos de seguridad

- Archivo `levels/chapter1/02-corridors.json`; bioma `station`, variante `corridors`, 1120 x 28 tiles.
- Siete secciones: entrada y registro, defensa alterada, dos circuitos de puertas, defensa mixta,
  ascenso de mantenimiento, bloqueo combinado y sala de registros.
- 51 estrellas opcionales, 24 enemigos y un checkpoint antes del ascenso. Entrada, checkpoint y zona del
  registro final fuera de los radios de persecución y ataque.
- Enemigos por sección: 2, 4, 4, 4, 4, 4 y 2. Se combinan exploradores, torretas y guardianes en grupos
  separados; el ascenso tiene cuatro exploradores en distintas alturas y el registro final conserva su refugio.
- `auto-turret`: fija, 2 de vida, aviso de 0.6 s y ráfaga de tres disparos horizontales a 132 px/s,
  separados por 0.25 s; pausa de 1.7 s entre ráfagas. Solo detecta al frente. `auto-turret-right` invierte la orientación.
- `armored-guardian`: robot terrestre de 4 de vida, velocidad 18 px/s y patrulla limitada a 24 px del origen.
  Embiste a 208 px/s tras un aviso de 0.85 s en una dirección fija. Después permanece inmóvil 1.5 s sin girarse.
  El escudo bloquea todo golpe frontal, incluidos láser penetrante y elementos, también durante la recuperación;
  hay que saltar la carga y atacar por detrás. Cada guardián conserva al menos seis tiles libres por lado.
- Configuración reutilizable en `enemies.json`: `facing`, `fixedFacing`, `patrolRange`, `attack.telegraph`,
  `attack.cooldown`, `attack.recovery`, `attack.burstCount` y `attack.burstInterval`; vida, daño de contacto, velocidad, elemento y resistencias usan los campos
  existentes. No hay un segundo sistema de IA. Los nuevos sprites son placeholders sustituibles por spritesheets.
- El rayo de nivel 1 puede derrotar a ambos enemigos; saltar, flanquear o aprovechar la recuperación evita
  depender de compras. Dañar al enemigo durante el aviso interrumpe el ataque y reinicia una pausa segura.
- `tests/enemies.test.ts` ejecuta la entidad Enemy real con un entorno Phaser mínimo: aviso previo al disparo,
  orientación, cadencia, embestida terrestre, escudo, interrupción, muerte única y limpieza de barra, flash y tween.
- Las ráfagas no usan temporizadores independientes ni recuperan disparos atrasados de golpe. Morir o destruir
  un enemigo retira sus proyectiles; la muerte del jugador vacía los disparos enemigos y el reinicio recrea los grupos.
- Tres plataformas móviles, cuatro láseres con aviso, cinco interruptores permanentes y cinco puertas.
  Los circuitos finales abren sus puertas y desactivan láseres; no hay ventanas temporizadas que invaliden un respawn.
- Tres registros cuentan la reprogramación NÉXAR, la captura y el transporte humano fuera de la estación.
  Solo el registro final pausa la acción; la salida usa el portal y la victoria existentes.
- El recorrido no exige armas compradas ni habilidades. El validador comprueba meta, estrellas y checkpoint;
  los tests simulan también puertas cerradas para comprobar el orden de acceso a las palancas.
- Acceso normal: completar Hangar -> La estación fantasma -> Pasillos de seguridad. Las partidas anteriores
  con Hangar completado lo desbloquean al cargar, sin migraciones ni recompensas artificiales.
- Completar Pasillos guarda su resultado (2/4) y desbloquea el Reactor. OMEGA se desbloquea al completar el Reactor.
- Objetivo orientativo de primera exploración: 8-12 minutos. La duración y el ajuste fino de dificultad
  requieren una partida completa cronometrada; no se deducen de la validación automática.

### 0.6d Episodio 3: El reactor inestable

- Archivo `levels/chapter1/03-reactor.json`; bioma `station`, variante `reactor`, 1600 x 28 tiles.
- Ocho secciones: acceso, suelos electrificados, transporte sobre conductores, drones, regulación,
  defensas combinadas, sobrecarga y escape al núcleo de seguridad.
- 64 estrellas opcionales y 28 enemigos, distribuidos expresamente. Dron eléctrico y técnico NÉXAR
  se presentan por separado en dos claros, antes de combinarlos con conductores, plataformas y defensas existentes.
  Enemigos por sección: 2, 4, 4, 5, 2, 5, 2 y 4. Acceso, regulación, sobrecarga y terminal conservan
  zonas de descanso entre grupos para leer y recuperar el ritmo; los cuatro checkpoints siguen fuera de detección.
- Trece suelos eléctricos, cinco láseres, seis plataformas móviles, cuatro controles permanentes y cinco puertas.
  Todos los peligros anuncian la descarga, mantienen ventanas de apagado y tienen tramos de espera entre ellos.
- Cuatro checkpoints: al final del acceso, antes de la regulación, antes de la sobrecarga y antes del escape, fuera del alcance
  de los enemigos y lejos de las franjas peligrosas.
- Tres reguladores abren las puertas en orden y anulan peligros concretos. El control elevado de aislamiento
  detiene la extracción, abre la salida y apaga la sobrecarga. Las defensas del escape usan reserva y conservan sus
  ciclos con aviso y apagado. No se puede llegar al
  anuncio de estabilización ni al final sin activar los cuatro controles.
- `electric-drone`: volador de 2 de vida, velocidad 26, patrulla vertical corta (`patrol.axis: y`), distancia
  preferida 72 px y resistencia a energía de 0.5. Dispara energía a 80 px/s tras 1 s de aviso, con 1.25 s de recuperación inmóvil.
- `nexar-technician`: alienígena terrestre de 2 de vida, velocidad 14 y patrulla limitada a 20 px. Prepara durante
  1.15 s un único disparo de energía a 84 px/s y queda expuesto 1.3 s; no invoca ni crea enemigos adicionales.
- Ambos reutilizan Enemy, los proyectiles y el daño elemental existentes. `attack.projectile: energy` cambia
  solo la apariencia del disparo enemigo; el rayo básico puede vencer a ambos sin plasma, criogenia ni mejoras.
- El último tramo combina un transporte sobre electricidad, dron y técnico, un ascensor obligatorio sobre una
  compuerta dañada y un segundo encuentro de dron y guardián. Hay refugios entre grupos y una zona final fuera
  del alcance de enemigos y proyectiles antes del anuncio OMEGA.
- Sin cuenta atrás de escape: se conservan las señales al reaparecer en el checkpoint; al reiniciar el nivel
  se restablecen puertas, señales y ciclos mediante el sistema de objetos existente.
- LUMA relaciona los registros de Pasillos con una máquina NÉXAR alimentada por el reactor para transportar
  prisioneros. Al terminar anuncia: «Protocolo OMEGA activado. Unidad de defensa OMEGA-7 en funcionamiento».
- Acceso normal: completar Pasillos -> La estación fantasma -> El reactor inestable. Los guardados anteriores
  con Pasillos completado lo desbloquean al cargar, sin recompensas o progreso artificiales.
- Completar Reactor registra 3/4 y desbloquea Protocolo OMEGA, sin completar todavía el capítulo.
- Objetivo orientativo de primera exploración: 10-15 minutos. La duración real y el balance requieren una
  partida completa cronometrada; los tests no certifican el tiempo de juego.

### 0.6e Episodio 4: Protocolo OMEGA

- Archivo `levels/chapter1/04-omega.json`; bioma `station`, variante `boss`, 740 x 28 tiles, 20 estrellas.
- Ocho enemigos en total: siete defensas en la aproximación y OMEGA-7, con dos controles, checkpoint y salida segura.
  La arena mide 20 tiles de ancho; la cámara se fija para mostrarla entera durante el combate.
- La arena conserva al jefe como único enemigo: no se añaden apoyos dentro de los láseres y conductores laterales.
- `omega-7` está registrado con `boss: true`, sprite provisional propio de 48 x 48, barra fija y 20 de vida.
  Usa Enemy, Health, afinidades y proyectiles compartidos. Solo recibe daño con el núcleo abierto en recuperación.
- Máquina recuperada `OmegaController`: fase 1 por encima del 70%, fase 2 entre 70% y 35%, fase 3 desde el 35%.
  Patrones: disparo y embestida; disparo/láseres/embestida; combinaciones más rápidas. Todos tienen aviso y pausa
  de recuperación. Los golpes de transición cancelan los proyectiles y apagan las señales del escenario.
- `bossEncounter` declara arena, enemigo, señales externas e identificadores de diálogos. Las puertas, dos láseres
  y dos conductores laterales son objetos existentes, no una implementación paralela de peligros.
- Introducción, transiciones, muerte del jugador, derrota y destrucción de escena retiran los peligros del jefe.
  Morir durante la arena reinicia salud y fase en el checkpoint; reiniciar el nivel recrea todos los recursos.
- La introducción reconoce la armadura y revela que el despertar no fue accidental. La derrota recupera las
  coordenadas del planeta y transmite: «PIEZOD... tú ya estuviste allí. Ellos te estaban esperando».
- El portal espera al jefe derrotado y al final del diálogo. Registra la victoria y muestra «Capítulo completado»;
  el capítulo 2 sigue como Próximamente y no se conceden armas ni recompensas artificiales.
- El rayo de nivel 1 y la regeneración normal bastan en la simulación de combate. También se conserva el salto
  sobre el jefe para no imponer compras a un perfil nuevo. No se modifican las armas, F/R ni la tienda.
- Objetivo orientativo de primera exploración: 8-12 minutos. La duración real exige un recorrido cronometrado.

### 0.6f Integración y revisión del capítulo 1

- Cuatro JSON registrados, variantes station validadas, desbloqueo secuencial y progreso v2 conservado.
- Prólogo y capítulo 1 disponibles desde una partida nueva, sin completar niveles automáticamente.
- Objetivos de dificultad: Hangar 2/10, Pasillos 4/10, Reactor 7/10, OMEGA 9/10; no son métricas verificadas.
- Se prueban referencias de objetos, saltos sin habilidades, checkpoints seguros y controles antes de sus puertas.
- Las pruebas distinguen simulación automática, pruebas de humo en Phaser y recorridos humanos completos.
  El balance fino y las duraciones siguen pendientes de partidas completas, especialmente en móvil físico.
- Selectores: descripciones de capítulo limitadas a dos líneas, texto dinámico normalizado para la fuente pixelada
  y título de niveles acotado para no solaparse con navegación o tienda.
- Corregido el cierre de escena cuando Phaser ya ha destruido los grupos de enemigos o proyectiles;
  el reinicio del encuentro no depende del orden de destrucción de esos recursos.

El capítulo 2 no se implementa en esta fase.

### 0.7 Pendiente de esta fase

- Aplicar las recompensas de capítulo al perfil (hoy solo se declaran y se consultan con `earnedRewards()`).
- Capítulo 2: bioma `alien`, niveles, enemigos y jefe. Sigue sin implementarse ni ser jugable.
- Validación humana de balance y duración del capítulo 1, y sustitución del arte procedural provisional.

---

## Parte A — Estado actual

### A.1 Niveles JSON y LevelManager ✅

| Pieza | Archivo | Qué hace |
| --- | --- | --- |
| Registro de campaña | `public/assets/platformer/levels/levels.json` | Lista **ordenada** de archivos de nivel. El orden define la progresión. |
| Formato de nivel | `levels/0X-*.json` | `id`, `name`, `biome`, `height` (10–40), `sections[]` de filas ASCII alineadas abajo, `signs` (carteles 1–9), `enemies` (leyenda letra → tipo). |
| Parser | `src/games/platformer/level/LevelParser.ts` | Concatena secciones, produce terreno (`ground`/`stone`/`oneway`), inicio, estrellas, enemigos con tipo, checkpoints, portales y carteles. |
| Autotiling | `level/tileset.ts` | Índices de tile por máscara de vecinos (layout común 256×64 para todos los biomas). |
| Validador | `level/LevelValidator.ts` | Estructura + **simulación de saltos con las físicas reales** (`physics.ts`): detecta metas, estrellas y checkpoints inalcanzables. Comprueba que los tipos de enemigo existen. |
| LevelManager | `level/LevelManager.ts` | Orden, desbloqueo lineal (completar N desbloquea N+1), mejor resultado de estrellas, `isCompleted`. Persistencia en `localStorage` (`miniverse.platformer.progress`). |
| Carga | `level/levelLoader.ts` | Carga registro + niveles en el preload, valida, marca inválidos y duplicados. |
| Transiciones | `level/levelFlow.ts` | Fundido y cambio de nivel / vuelta a la selección. |
| Selección | `scenes/PlatformerLevelSelectScene.ts` | Tarjetas (4 por fila), candado, mejores estrellas, acceso a tienda. |

Métricas de los niveles actuales:

| # | Archivo | Bioma | Tamaño (tiles) | Estrellas | Checkpoints | Enemigos |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 01-forest | forest | 154×14 | 37 | 1 | 4 walker |
| 2 | 02-ruins | ruins | 104×14 | 19 | 1 | 1 walker-fast, 2 hopper, 2 shellbot |
| 3 | 03-ice | ice | 110×18 | 23 | 1 | 4 walker-fast, 2 bat, 1 bat-frost, 1 spitter |
| 4 | 04-volcano | volcano | 140×16 | 31 | 1 | 2 walker-fast, 1 spitter, 1 golem, 1 bat, **1 magma-king (jefe)** |

Limitaciones: ✅ el concepto de **capítulo** ya existe (Parte 0) y el desbloqueo es por capítulo; una única meta por nivel (`O`); terreno de una sola capa sin objetos dinámicos.

### A.2 Biomas ✅ (variantes ✅, ver Parte 0)

- Definición declarativa en `biomes/definitions/*.ts` → `createBiome({ palette, style, decorations, ambient, lighting, dust, files? })`.
- Generador común `biomes/biomeArt.ts`: **todo procedural** (pixel art con paleta, dithering, contornos):
  - Tileset 256×64 (suelo/bloque autotile, plataforma atravesable, variantes de relleno).
  - 16 decoraciones de 16×16 (hierba animada, flores, rocas, setas/cristales con luz, lianas o carámbanos, cartel...).
  - 7 fondos 320×180 en 8 capas parallax (cielo, montañas, niebla ×2, colinas, lejano, cercano, primer plano).
- `style` elige formas: cielo (luna/sol/ninguno), picos (montañas/cueva/mesetas), siluetas, superficie (hierba/nieve/ceniza), bloques (ladrillo/hielo/basalto/tallado), primer plano.
- Iluminación: viñeta + capa de color (add/multiply). Partículas ambientales por bioma.
- Las texturas se generan **al entrar en un nivel del bioma**; `files` permite sustituirlas por PNG reales.
- Biomas: `forest`, `ruins`, `ice`, `volcano`.
- ✅ **Variantes visuales dentro de un bioma** (hangar / reactor...): implementadas, ver Parte 0.4.

### A.3 Enemigos ✅ (arquitectura) / 🟡 (variedad)

Configuración en `public/assets/platformer/enemies/enemies.json` (con herencia `extends`), validada por `enemies/EnemyCatalog.ts`. Entidad genérica `entities/Enemy.ts`; IA en `enemies/ai.ts` (`idle`, `patrol`, `chase`, `attack`, `hurt`, `death`).

| Tipo | Sprite | Vida | Daño contacto | Velocidad | Movimiento | Ataque | Salto encima | Resistencias / defensa | Recompensa (energía) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| walker | walker | 1 | 1 | 28 | patrulla | — | muere | — | 10 |
| walker-fast | walker | 1 | 1 | 55 | patrulla | — | muere | — | 10 |
| hopper | walker | 1 | 1 | 34 | patrulla | salto (cd 1.8 s, rango 80) | muere | — | 10 |
| shellbot | walker | 2 | 1 | 32 | patrulla | — | 1 de daño | rayo ×0.5 | 20 |
| bat | bat | 1 | 1 | 42 | vuela y persigue (110 px) | — | muere | — | 15 |
| bat-frost | bat | 2 | 1 | 50 | vuela y persigue | — | 1 de daño | fuego ×2 (débil) | 15 |
| spitter | spitter | 2 | 1 | 0 | estático | disparo (cd 2.4 s, rango 150) | 1 de daño | — | 20 |
| golem | golem | 4 | 1 | 18 | patrulla | — | **inmune** (rebota) | escudo frontal ×0.5, fuego ×0.5 | 30 |
| magma-king | golem ×2 | 8 | 1 | 26 | persigue (170 px) | disparo (cd 2.6 s) | 1 de daño | escudo ×0.5, fuego ×0.25 | 100 · **jefe** |

Sistema común de daño (`combat/damage.ts`): tipos `contact`, `stomp`, `beam`, `fire`, `projectile`; armadura plana + multiplicadores; barra de vida para enemigos con más de 1 de vida.

Limitaciones: los comportamientos están en un `switch` dentro de `Enemy.update` (no son módulos combinables); solo 4 familias de sprite (registradas en código, `assets/enemySprites.ts`); dos tipos de ataque (`shoot` horizontal o apuntado si vuela, `hop`).

### A.4 Habilidades ✅

Configuración en `public/assets/platformer/abilities/abilities.json`; módulos reutilizables en `abilities/modules/` (`jetpack`, `projectile`, `flamethrower`); orquestación en `abilities/AbilitySystem.ts`. Energía: 100, se recupera a 20/s tras 0.6 s sin uso.

| Habilidad | Tipo | Tecla | Requisito | Niveles (coste) | Efecto por nivel |
| --- | --- | --- | --- | --- | --- |
| Propulsión | pasiva | Espacio (en el aire / mantener) | completar nivel 1 | 2 (12, 25) | doble salto 270→300; planeo 0.6→1.2 s |
| Rayo de energía | activa | **F** | ninguno | 3 (8, 18, 30) | daño 1→1.5→2; energía 15→12→10; cd 0.45→0.3→0.25 s |
| Lanzallamas | activa (mantener) | **R** | completar nivel 2 | 2 (20, 35) | daño progresivo hasta 0.8→1.2 por tick; 40→32 energía/s; al vaciarse hay que soltar R |

Coste total de mejorarlo todo: **148 estrellas**; la campaña actual ofrece **110** → no se puede comprar todo (decisión de diseño a confirmar).

### A.5 Estrellas, tienda y persistencia ✅

- `progression/Profile.ts` (`localStorage: miniverse.platformer.profile`): cada estrella cuenta **una sola vez** (clave `nivel + columna,fila`); saldo = ganadas − gastadas. Se registran **solo al completar** el nivel.
- Tienda (`scenes/PlatformerShopScene.ts`): comprar/mejorar con validación de saldo, requisito y nivel máximo; equipar/quitar (una habilidad activa por botón).
- Datos guardados saneados al cargar (ids desconocidos, saldo negativo, niveles fuera de rango).
- 🟡 Riesgos: si se mueve una estrella en un nivel, su clave cambia y se puede ganar de nuevo; no hay versión/migración de guardado más allá de `version: 1`.

### A.6 Dificultad 🟡

Existe:
- Enemigos y variantes por nivel mediante la leyenda `enemies` del JSON (nivel 1 sencillo → nivel 4 combinado con jefe).
- Vida del jugador (3 corazones) + 3 vidas + checkpoints.
- Validador que impide saltos imposibles; test que verifica que la dificultad no decrece y que cada nivel introduce comportamientos nuevos.

No existe ❌: plataformas móviles, peligros ambientales (pinchos, lava, láseres), saltos temporizados, interruptores/puertas, ajustes globales de dificultad, encuentros con zona cerrada.

### A.7 Jefes 🟡

Existe: flag `boss`, barra de vida, portal bloqueado hasta derrotar a todos los jefes ("Derrota al guardián"), regla de validación "un jefe no puede ser inmune al salto".

No existe ❌: fases, patrones de ataque secuenciados, invocaciones, arena cerrada, presentación/intro, barra de jefe en el HUD, música.

### A.8 Limitaciones para capítulos de varios niveles

1. ✅ Resuelto: entidad **capítulo** (registro, desbloqueo, selección, recompensas derivadas).
2. ✅ Resuelto: la selección es por capítulo (los 4 niveles de cada capítulo caben en una fila).
3. ✅ Resuelto: **variantes de bioma** con herencia y texturas compartidas.
4. Sin **objetos de nivel** (plataformas móviles, peligros, resortes...): el parser solo conoce terreno, estrellas, enemigos, checkpoints, carteles y portal.
5. IA de enemigos no modular y familias de sprite cableadas en código.
6. Requisitos de habilidad referencian ids de nivel concretos (`"requires": "forest-1"`).
7. El validador no conoce habilidades concedidas ni objetos móviles.
8. Todos los niveles JSON se cargan en el preload (bien hoy, aceptable hasta decenas).

### A.9 Organización de assets

```
public/assets/platformer/
  spritesheets/hero/    ✅ PNG reales (tiras por animación) + hero_manifest.json
  sounds/               ❌ vacío (sonidos sintetizados con Web Audio)
  biomes/<id>/{tilesets,backgrounds,decorations}/  ❌ vacíos (arte procedural)
  enemies/enemies.json  ✅   abilities/abilities.json ✅   levels/*.json ✅
src/games/platformer/assets/
  manifest.ts      claves, créditos y `url` opcional de cada textura/sonido
  actors.ts        héroe de respaldo, estrella, checkpoint, portal, FX y UI (procedural)
  combatArt.ts     PLACEHOLDER: murciélago, gólem, escupefuego, proyectiles, iconos
  enemySprites.ts  familias de sprite de enemigos → animaciones y caja de colisión
  heroSkin.ts      carga del héroe desde hero_manifest.json
  animations.ts    claves de animación del héroe y objetos
view/  ParallaxBackground.ts · Decorations.ts · PlatformerFx.ts (emisores de partículas)
```

### A.10 Refactorizaciones necesarias para una campaña larga

| Prioridad | Refactor | Motivo |
| --- | --- | --- |
| ✅ | `campaign.json` con capítulos | Agrupar niveles, desbloqueo por capítulo, selección por capítulo |
| ✅ | Variantes de bioma | 4 aspectos por bioma sin duplicar biomas |
| Alta | Sistema de **objetos de nivel** (registro de módulos como las habilidades) | Plataformas móviles, peligros, resortes |
| Alta | Comportamientos de enemigo como **módulos componibles** | Nuevas criaturas sin tocar `Enemy.ts` |
| Alta | Framework de **jefes por fases** | Jefes de capítulo |
| Media | Familias de sprite de enemigos en JSON | Añadir enemigos solo con datos + PNG |
| Media | Guardado v2 con migración (capítulos, ids de estrella explícitos) | Robustez del progreso |
| Media | Validador consciente de habilidades concedidas y objetos móviles | Garantizar niveles completables |
| Baja | Carga perezosa de assets por capítulo; música por bioma | Rendimiento y ambientación |

---

## Parte B — Propuesta de campaña espacial

### B.1 Capítulos

**Capítulo 1 — Estación espacial abandonada** (bioma `station`)
Paneles metálicos, luces de emergencia, ventanales con estrellas. Variantes: `hangar` (naves, grúas, frío azul), `corridors` (tuberías, vapor, luz parpadeante), `reactor` (núcleo brillante, rejillas, luz verde/ámbar), `boss` (sala de control roja).

**Capítulo 2 — Planeta alienígena** (bioma `alien`)
Suelo violeta, flora orgánica, cielo con lunas. Variantes: `surface` (dunas y rocas flotantes), `biolum` (bosque bioluminiscente oscuro), `caves` (cuevas húmedas con cristales), `lair` (guarida orgánica con membranas).

### B.2 Los ocho niveles

| # | Nivel | Variante | Enemigos (nuevos en **negrita**) | Mecánicas nuevas | Habilidades recomendadas (nunca obligatorias salvo concesión) | Dificultad (1–10) |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Hangar de atraque | station/hangar | **Dron patrulla** (patrulla, muere al pisarlo) | Plataformas elevadoras lentas, carteles de controles | — | 2 |
| 2 | Corredores de servicio | station/corridors | Dron patrulla, **Torreta centinela** (estática, dispara en ráfaga de 2), **Dron flotante** (vuela, persigue) | Plataformas móviles horizontales, puertas con interruptor | Rayo (F) | 4 |
| 3 | Núcleo del reactor | station/reactor | **Robot escudo** (escudo frontal: pisarlo o atacar por detrás), **Rodador** (carga en línea recta al verte), torretas | Láseres temporizados, suelo electrificado intermitente, saltos sobre plataformas móviles | Rayo, Propulsión | 6 |
| 4 | Sala de control — Jefe **OMEGA-7** | station/boss | Jefe + drones invocados | Arena cerrada, 3 fases | Rayo, Propulsión | 7 |
| 5 | Superficie de Xeno-4 | alien/surface | **Rastreador de esporas** (al morir se divide en 2 pequeños), **Medusa flotante** (vuela en seno, rebote alto al pisarla) | Hongos resorte, plataformas que se desmoronan | — (recibe Propulsión al vencer a OMEGA-7, ver B.4) | 6 |
| 6 | Bosque bioluminiscente | alien/biolum | **Planta lanzadora** (proyectil en arco), **Enjambre de polillas** (grupo volador, débil al fuego), medusas | Oscuridad con radio de luz, corrientes de aire ascendentes (sinergia con planeo) | Lanzallamas (R), Propulsión | 7 |
| 7 | Cuevas de cristal | alien/caves | **Excavador** (emboscada: sale del suelo cerca del jugador), **Escarabajo acorazado** (inmune frontal y al salto, débil al fuego), plantas | Charcos tóxicos, estalactitas que caen, plataformas móviles en vertical | Lanzallamas, Rayo nv2 | 8 |
| 8 | Guarida — Jefa **Reina Colmena** | alien/lair | Jefa + larvas | Arena con techo activo, 3 fases | Todas (opcionales) | 9 |

### B.3 Jefes por fases

**OMEGA-7 (nivel 4)** — 3 fases por porcentaje de vida:
1. *100–60 %*: patrulla la arena, ráfaga de 3 disparos rectos. Al pisarlo recibe daño (nunca inmune al salto).
2. *60–30 %*: cargas de lado a lado (telegrafiadas con chispas 0.6 s) + invoca 2 drones patrulla.
3. *< 30 %*: barrido láser bajo/alto alternado (saltar o agacharse en plataforma), núcleo expuesto tras cada barrido (daño ×2).

**Reina Colmena (nivel 8)**:
1. *100–65 %*: escupe proyectiles en arco y pone larvas (1 de vida).
2. *65–30 %*: se cuelga del techo; caen estalactitas marcadas por sombras; baja a recuperar aliento (ventana de daño).
3. *< 30 %*: furia: cargas rápidas + lluvia de esporas; el punto débil brilla tras cada carga.

Reglas comunes: arena cerrada al entrar; barra de jefe en el HUD; transición de fase con 1 s de invulnerabilidad y aviso visual; checkpoint justo antes de la arena; derrotable solo con salto + esquiva (las habilidades lo aceleran, no lo condicionan).

### B.4 Progresión de dificultad y habilidades

- **Aumentar la exigencia con patrones, no con números**: cada nivel introduce 1–2 comportamientos nuevos y los combina con los anteriores (torreta + plataforma móvil, enjambre + oscuridad, excavador + charco tóxico).
- **Ventanas justas**: todo ataque se telegrafía (≥0.4 s), los peligros temporizados siguen ciclos regulares visibles, y siempre hay un checkpoint antes de cada sección nueva.
- **Habilidades opcionales**: el validador seguirá simulando solo las físicas base, más las habilidades **concedidas** obligatoriamente por la historia.
- **Concesión garantizada (propuesta)**: al derrotar a OMEGA-7 se **regala Propulsión nivel 1** (si ya se tenía, se reembolsan sus estrellas). Así el capítulo 2 puede usar doble salto en secciones obligatorias.
- **Economía**: ajustar estrellas por nivel (~25–35) para que en el capítulo 2 se puedan comprar 2 de las 3 habilidades a nivel 1–2 sin rejugar, y todo al 100 % solo con rejugar y recoger todas las estrellas.
- **Dificultad numérica moderada**: la vida de los enemigos sube como mucho ×2 entre capítulos; el resto del reto lo ponen el entorno y las combinaciones.

---

## Parte C — Arquitectura propuesta

### C.1 Archivos de configuración

```
public/assets/platformer/
  campaign.json            capítulos: id, nombre, bioma, niveles, recompensas, requisito de desbloqueo
  biomes/<id>/variants.json  (opcional) sustituciones de paleta/estilo/capas por variante
  enemies/enemies.json     + "behaviours": [...] componibles y "sprite" apuntando a sprites.json
  enemies/sprites.json     familias de sprite (antes en enemySprites.ts)
  bosses/<id>.json         fases, patrones, invocaciones, arena
  objects/objects.json     plataformas móviles, peligros, resortes (tipos reutilizables)
  levels/<cap>-<n>.json    + "variant", "objects" (leyenda), "grants", "arena"
```

Ejemplo `campaign.json`:

```json
{
  "chapters": [
    {
      "id": "station",
      "name": "Estacion espacial abandonada",
      "biome": "station",
      "levels": ["c1-1-hangar.json", "c1-2-corridors.json", "c1-3-reactor.json", "c1-4-omega.json"],
      "unlock": null,
      "rewards": { "grantAbility": { "id": "jetpack", "level": 1 } }
    },
    { "id": "alien", "name": "Planeta alienigena", "biome": "alien", "levels": ["..."], "unlock": "station" }
  ]
}
```

Ejemplo de nivel con variante y objetos:

```json
{
  "id": "c1-3-reactor",
  "biome": "station",
  "variant": "reactor",
  "enemies": { "E": "drone", "T": "turret", "Z": "shield-bot" },
  "objects": { "M": { "type": "mover", "path": [[0, 0], [6, 0]], "speed": 40 }, "L": { "type": "laser", "on": 1.5, "off": 1.5 } },
  "sections": ["..."]
}
```

### C.2 Código (motor sin cambios por capítulo)

| Módulo | Responsabilidad |
| --- | --- |
| `level/CampaignManager` (amplía LevelManager) | Capítulos, desbloqueos, recompensas, guardado v2 con migración |
| `biomes/createBiome` + variantes | `createBiome(def, variant)` → texturas con clave `biome.variant.*` |
| `objects/` + registro de módulos | `mover`, `laser`, `spring`, `crumble`, `hazardZone` (mismo patrón que `abilities/modules`) |
| `enemies/behaviours/` + registro | `patrol`, `chase`, `fly`, `sine`, `ambush`, `charge`, `shoot`, `lob`, `guard`, `split` combinables desde JSON |
| `bosses/BossController` | Máquina de fases, patrones, invocaciones, arena, barra de HUD |
| `LevelValidator` | Soporte de objetos móviles (soporte temporal), puertas y habilidades concedidas |
| Escenas | `ChapterSelect` → `LevelSelect` por capítulo; HUD con barra de jefe |

**Añadir un Capítulo 3** = 1 definición de bioma (+ variantes), entradas nuevas en `enemies.json`/`sprites.json`, 1 jefe en `bosses/`, 4 JSON de nivel y una entrada en `campaign.json`. Solo habría que escribir código si se necesita un **comportamiento** u **objeto** realmente nuevo, y sería un módulo aislado.

---

## Parte D — Orden de implementación recomendado

| Paso | Contenido | Resultado verificable |
| --- | --- | --- |
| 0 | ✅ Controles F/R (hecho en esta rama) | Tests de teclas, cooldowns y energía |
| 1 | ✅ `campaign.json` + CampaignManager + selección por capítulo + guardado v2 | Los 4 niveles actuales funcionan como "Capítulo 0 / Prólogo" |
| 2 | 🟡 Variantes de bioma ✅; bioma `station` (placeholders) pendiente | 4 aspectos generados desde una definición |
| 3 | Sistema de objetos: plataforma móvil y láser + validador | Tests de alcanzabilidad con plataformas móviles |
| 4 | Comportamientos de enemigo modulares + robots del capítulo 1 | Tests de catálogo e IA por módulo |
| 5 | Framework de jefes + OMEGA-7 | Tests de transición de fases |
| 6 | Niveles 1–4 del capítulo 1 + ajuste jugando | Campaña jugable de principio a fin |
| 7 | Bioma `alien`, objetos (resorte, desmoronable, tóxico), criaturas | — |
| 8 | Reina Colmena + niveles 5–8 | Capítulo 2 completo |
| 9 | Arte final (IA), música, equilibrado de economía | — |

### Decisiones abiertas para revisar

1. ¿Qué hacemos con los 4 niveles actuales: prólogo jugable, contenido extra o retirada?
2. ¿Confirmamos la concesión de Propulsión al vencer a OMEGA-7 (para usar doble salto obligatorio en el capítulo 2)?
3. ¿Queremos selector de dificultad global (p. ej. más vidas) o una sola curva?
4. ¿El jefe bloquea siempre el portal o puede haber niveles de jefe "a contrarreloj"?
5. ¿Presupuesto de estrellas: debe poder comprarse todo en una sola pasada?
