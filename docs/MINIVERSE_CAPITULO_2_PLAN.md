# MiniVerse — Plan maestro de implementación del capítulo 2

> **Documento operativo para GitHub Copilot** · Capítulo 2: **El planeta de las sombras**  
> **Estado:** bloques 1–6 implementados; bloque 7 en validación · Gates automatizados correctos; recorridos manuales/móvil pendientes · **Stack:** Phaser 3 + TypeScript + Vite  
> **Regla principal:** este archivo es la fuente de verdad para el avance. **Marca cada casilla `[x]` solo cuando el trabajo esté implementado y verificado.**

## 0. Cómo trabajar con este documento

1. Antes de cada sesión, lee este archivo completo y revisa `git status`, la rama actual y el código existente. No presupongas que las rutas o las API siguen siendo idénticas a las del capítulo 1.
2. Busca el **primer bloque con tareas `[ ]`** y trabaja solo en ese bloque, salvo que el usuario autorice expresamente un alcance mayor. Divide internamente los cambios para evitar sesiones largas.
3. En modo implementación rápida, marca `[x]` solo las tareas cuya implementación esté terminada y anota `IMPLEMENTADO — PENDIENTE DE VALIDACIÓN`; mantén las comprobaciones sin ejecutar como `[ ]` para el bloque 7. Fuera de ese modo, registra evidencia de verificación antes de cerrar tareas.
4. Conserva el avance en disco. Si hay un error de red, sesión interrumpida o contexto perdido, reanuda leyendo este documento y los archivos existentes: **no dupliques implementaciones ni empieces de cero**.
5. En modo implementación rápida no ejecutes pruebas, typecheck, build ni navegador antes del bloque 7. Reserva allí la validación completa y distingue pruebas automatizadas de comprobaciones manuales.
6. **No hagas commit, push, merge, cambio de rama ni despliegue sin autorización explícita.** No modifiques producción (`main`). No desarrolles el capítulo 3.
7. Si una tarea requiere un cambio arquitectónico importante, documenta la decisión y pide confirmación antes de realizarlo. Reutiliza primero la arquitectura existente.
8. Al finalizar cada sesión, entrega un resumen breve: tareas marcadas, archivos cambiados, pruebas, bloqueos y **siguiente casilla pendiente**.

### Registro de sesiones

| Fecha | Bloque trabajado | Evidencia / pruebas | Próximo paso |
|---|---|---|---|
| 2026-10-27 | Bloque 7, validación automatizada parcial | `npm test` 436/436; ambos typechecks; build correcto; selector cargó 2.4. No se completó el combate en navegador ni se habilitó toque CDP; staging no desplegado | Bloque 7, resolver incidencias de arena y completar validación manual posible |
| 2026-10-27 | Bloque 6 implementado — pendiente de validación | 2.4 con seis secciones, 9 enemigos previos, Reina de tres fases, nodos, apoyo limitado, arena y cierre narrativo; incidencia de JSON corregida; sin tests/build/typecheck/browser por modo rápido | Bloque 7, validación integral |
| 2026-10-27 | Bloque 5 implementado — pendiente de validación | `c2-3-lab`: nueve secciones, 32 enemigos, cápsulas/archivos, peligros, nodos, señales, checkpoints y 7 beats; sin tests/build/typecheck/browser por modo rápido | Bloque 6, episodio 2.4 y Reina del Enjambre |
| 2026-10-27 | Bloque 4 implementado — pendiente de validación | 2.1 y 2.2: ocho secciones por nivel, 18/25 enemigos, objetos, señales, narrativa, checkpoints y salidas configurados; sin tests/build/typecheck/browser por modo rápido | Bloque 5, episodio 2.3 |
| 2026-10-27 | Bloque 3 completado: planta impulsora, suelo tóxico y nodos orgánicos | `build:ci`: 425/425 tests + build; ambos typechecks; 169/169 regresión de objetos/niveles/capítulos; `git diff --check` correcto | Bloque 4, episodio 2.1: Caída en territorio hostil |
| 2026-10-27 | Bloque 2 completado: cinco enemigos configurables y probados | `build:ci`: 417/417 tests y build correcto; ambos typechecks; 131/131 pruebas focalizadas; `git diff --check` correcto | Bloque 3, Planta impulsora |
| 2026-10-27 | Bloque 2, Guardián orgánico | Hereda `armored-guardian`; arte propio, flanco/frente/recuperación verificados; 48/48 pruebas y ambos typechecks correctos | Bloque 2, Técnico biológico |
| 2026-10-27 | Bloque 2, Murciélago NÉXAR | Vuelo `hover` limitado, picado telegrafiado y spritesheet propio; 47/47 pruebas focalizadas; ambos typechecks correctos | Bloque 2, Guardián orgánico |
| 2026-10-27 | Bloque 2, Escupidor de esporas | Ráfaga telegráfica y proyectil `spore` integrado; 46/46 pruebas focalizadas; ambos typechecks correctos | Bloque 2, Murciélago NÉXAR |
| 2026-10-27 | Bloque 2, Acechador | Configuración `stalker`, sprite procedural propio y `Enemy` compartido; `tests/enemies.test.ts` + `tests/chapter2.test.ts`: 44/44; `npm run typecheck` correcto | Bloque 2, Escupidor de esporas |
| 2026-10-27 | Bloque 1 completado: arquitectura, campaña, bioma y esqueletos | 409 tests / 13 archivos; ambos typechecks, build y `build:ci` correctos; Canvas 36/36 texturas; lámina visual local | Bloque 2, primera casilla: Acechador |

### Estado global

- [x] Bloque 1 — Arquitectura, campaña y bioma. Evidencia: registro de validaciones y notas del bloque 1.
- [x] Bloque 2 — Enemigos del planeta. Evidencia: cinco tipos instanciables y combatibles en `Enemy`; tests de IA, daño, señales, proyectiles y limpieza; `build:ci` 417/417 + build.
- [x] Bloque 3 — Objetos y mecánicas ambientales. Evidencia: tres objetos registrados, señales/membranas integradas, reinicio y limpieza probados; `build:ci` 425/425 + build.
- [x] Bloque 4 — Episodios 2.1 y 2.2. **IMPLEMENTADO — PENDIENTE DE VALIDACIÓN**; la validación queda reservada al bloque 7.
- [x] Bloque 5 — Episodio 2.3. **IMPLEMENTADO — PENDIENTE DE VALIDACIÓN**; pruebas y verificación reservadas al bloque 7.
- [x] Bloque 6 — Episodio 2.4 y Reina del Enjambre. **IMPLEMENTADO — PENDIENTE DE VALIDACIÓN**; validación integral reservada al bloque 7.
- [ ] Bloque 7 — Integración, regresión y validación móvil.

---

## 1. Objetivo, alcance y criterios de diseño

Crear **cuatro episodios completos y jugables** para el capítulo 2, «El planeta de las sombras», conservando el prólogo y el capítulo 1. Se debe reutilizar tanto como sea razonable el sistema existente de niveles JSON, campaña, escenas, renderizado, `Enemy`, daño, armas, checkpoints, guardado, diálogos, señales y objetos interactivos, además de los patrones de `OmegaController` y `BossEncounter`.

**Identidad del capítulo:** planeta alienígena bioluminiscente, fauna controlada por una inteligencia colectiva, tecnología NÉXAR incrustada en materia orgánica, humanos cautivos y un misterio sobre el pasado de PIEZOD. No basta con recolorear la estación: cada episodio debe tener encuentros, plataformas, peligros y situaciones propias.

**Criterios generales:**

- Combates frecuentes, con alternancia de presión y descanso; no repetir niveles vacíos.
- Dificultad progresiva y ataques anticipados visualmente; siempre debe existir una respuesta posible del jugador.
- Buen rendimiento y controles legibles en móvil; evitar acumulación ilimitada de proyectiles o enemigos.
- Todas las armas funcionales actuales deben poder completar los niveles; no imponer compras o mejoras como requisito.
- Respetar la configuración **real** de acceso libre o progresión vigente cuando se implemente el capítulo 2; no revertirla por accidente.
- Checkpoints antes de tramos exigentes y antes del jefe; limpieza correcta al morir, reiniciar o cambiar de escena.
- Mantener compatibilidad con partidas guardadas y registro de niveles completados.
- Capítulo 3: solo anticipación narrativa y estado «Próximamente».

### Historia y continuidad

PIEZOD llega al planeta tras obtener las coordenadas al derrotar a OMEGA-7. LUMA detecta restos humanos y una red biológica que conecta a las criaturas. Los NÉXAR emplean a la **Reina del Enjambre** para proteger una instalación desde la que trasladan prisioneros hacia **La forja de los cautivos**. Los registros sugieren que PIEZOD ya estuvo allí y que sus recuerdos han sido alterados.

Los diálogos deben ser **breves, opcionales cuando proceda y compatibles con móvil**. Durante diálogos, respawn y transiciones no deben quedar peligros activos de manera injusta.

---

## 2. Bloque 1 — Inspección, campaña y bioma

**Objetivo:** registrar la estructura completa del capítulo y establecer su identidad visual antes de construir combates.

- [x] Inspeccionar estructura real del repositorio, formatos/validadores JSON, sistema de campaña, escenas, variantes de bioma, `Enemy`, objetos y pruebas. Evidencia: `LevelValidator`, `CampaignManager`, `createBiome`, `Enemy`, `OmegaController` y `objects/builtin.ts`; reutilización anotada debajo.
- [x] Comprobar el estado actual de las opciones de armas y selección de niveles. Evidencia: `progression/accessPolicy.ts`, `Profile`, `gameData` y `levelLoader`; `freeWeapons` y `freeLevels` siguen en `true`, sin editar la política ni el guardado.
- [x] Registrar el capítulo 2 en la campaña y catálogo de niveles con cuatro identificadores estables. Evidencia: `campaign.json`, `levels.json:plannedLevels` y pruebas de referencias en `tests/chapter2.test.ts`:
  - `c2-1-landing` — **Caída en territorio hostil**.
  - `c2-2-caves` — **Las cavernas vivas**.
  - `c2-3-lab` — **El laboratorio de la colmena**.
  - `c2-4-queen` — **El corazón del Enjambre**.
- [x] Crear el bioma `alien` con variantes `jungle`, `caves`, `lab` y `nest`. Evidencia: `biomes/definitions/alien.ts`, registro en `biomes/index.ts` y pruebas de carga/atlas.
- [x] Reutilizar fondos, tiles, decoraciones, parallax y herramientas de renderizado existentes. Evidencia: `biomeArt.ts` añade estilos `organic`, `sporeGroves`, `tendrils` y frames 22/23 para membrana y costilla; hongos, helechos, cristales y tecnología reutilizados; 36/36 texturas no vacías en Canvas.
- [x] Verificar contraste y coste visual acotado. Evidencia: cuatro tests con contraste mínimo 3:1 entre capas de fondo, bordes y colores de combate actuales; un emisor por variante, presupuesto de hasta 12 partículas y sin overlay. Lámina local de escritorio/móvil revisada; los enemigos nuevos y rendimiento móvil físico se verificarán en sus bloques.
- [x] Crear esqueletos JSON válidos de los cuatro episodios, sin declararlos «jugables». Evidencia: cuatro archivos en `levels/chapter2/`, `validateLevel` sin incidencias y exclusión del selector incluso con acceso libre.
- [x] Añadir pruebas de esquema, referencias de campaña y carga de variantes del bioma. Evidencia: `tests/chapter2.test.ts`; regresión de biomas anteriores en `tests/campaign.test.ts` y `tests/chapter1.test.ts`.
- [x] Ejecutar pruebas focalizadas, ambos typechecks, build y validación completa. Evidencia: `tests/chapter2.test.ts` 9/9; regresión capítulo 1 + 2 80/80; `build:ci` 409/409 tests en 13 archivos y build correcto; `git diff --check` correcto.

**Criterio de cierre:** los cuatro niveles están registrados y sus datos son válidos; el bioma se puede cargar sin romper los anteriores. **Esto no implica que los episodios estén terminados.**

### Decisiones verificadas del bloque 1

- Se conserva el id de capítulo `alien` para no romper referencias ni partidas. La campaña conserva sus estados
  `ready`/`planned`/`broken`; el capítulo 2 permanece `planned` hasta construir recorridos reales.
- El catálogo añade `plannedLevels` como lista separada de rutas. `queueLevels` carga ambos grupos y `releaseLevels`
  los retira; solo `levels` entra en `LevelManager`. Prueba focalizada: `tests/chapter2.test.ts`.
- Se reutilizan parser y validadores de nivel, campaña y narrativa; las escenas existentes; `createBiome`, su atlas,
  parallax y generación de pixel-art; `Enemy` con carga, ráfagas y daño compartidos; `ObjectRegistry`, `SignalBus`,
  puertas y peligros actuales. `OmegaController` y `BossEncounter` quedan como referencia para el bloque 6.
- Acceso vigente: Rayo, Lanzallamas y Cañón láser funcionales a nivel 1 sin compra, F/R persistentes, mejoras pagadas,
  ocho niveles publicados directamente seleccionables. Los borradores no entran en ese acceso libre.
- Las modificaciones previas de acceso libre y la documentación ya presentes al iniciar se conservan; no se cambia
  de rama (`develop`) ni se realizan operaciones de publicación.
- Los cuatro esqueletos tienen una sección mínima de 32 x 12 tiles, inicio, estrella y salida alcanzable solo para
  validar el formato. No son recorridos terminados, no tienen combates ni checkpoints y no se publican en el selector.
- `alien/jungle` comparte las texturas base; cavernas, laboratorio y nido reciben claves propias. La generación sigue
  siendo bajo demanda, con parallax y atlas existentes. El laboratorio combina arcos, consolas y cápsulas con tejido
  orgánico; selva/nido usan hongos gigantes y tendriles; cavernas conserva estalactitas, cristales y membranas.
- Comprobación de navegador limitada al arte: generación Canvas de 36 texturas con píxeles visibles y lámina temporal
  en viewport 1280 x 720 y 390 x 844 sin desbordamiento horizontal. Niebla y primer plano son monocromos por diseño.
  No se ha jugado el capítulo 2, no se ha probado móvil físico y no se ha medido FPS. El entorno mostró un aviso de
  AudioContext del dispositivo al abrir el navegador; no se ha modificado el sistema de sonido.
- Estado al cerrar el bloque 1: la siguiente casilla era bloque 2, Acechador; el avance posterior queda registrado en las secciones de los bloques 2 y 3. El capítulo 3 no se ha implementado.

---

## 3. Bloque 2 — Enemigos del planeta

**Objetivo:** enemigos con identidad propia aprovechando patrones ya implementados. Primero inspeccionar las IA existentes y parametrizar antes de crear clases nuevas.

- [x] **Acechador:** terrestre, detecta y salta o carga hacia PIEZOD, avisa y queda expuesto tras fallar; reutilizar lógica de carga del guardián cuando sea viable. Evidencia: `enemies.json` usa `chase` + `lunge`; `Enemy` compartido aporta aviso, embestida, recuperación, daño y limpieza; sprite procedural `stalker`; prueba de esquiva, ventana vulnerable y muerte en `tests/enemies.test.ts`.
- [x] **Escupidor de esporas:** atacante fijo, proyectiles tóxicos en ráfagas anticipadas; reutilizar torreta y su temporización. Evidencia: configuración `spore-spitter` reutiliza aviso, ráfagas de tres y recuperación; `CombatSystem` crea proyectiles `spore` con arte/animación propia y daño plasma común; tests de temporización, configuración, daño y muerte.
- [x] **Murciélago NÉXAR:** volador con patrulla y picado anticipado; reutilizar IA de dron. Evidencia: `nexar-bat` usa `hover` acotado y `lunge` telegrafiado; pruebas de límite de patrulla, destino fijado, recuperación y muerte; textura procedural exclusiva.
- [x] **Guardián orgánico:** protección frontal y flanco trasero vulnerable; reutilizar el guardián blindado, evitando una copia de su lógica. Evidencia: `extends: armored-guardian` mantiene escudo, lunge y recuperación; sprite procedural exclusivo; prueba de golpes frontales/traseros y muerte.
- [x] **Técnico biológico:** activa peligros o nodos y puede atacar; reutilizar técnico NÉXAR y señales. Evidencia: `activeSignal: bio-hive` se emite mientras quede un técnico vivo, se apaga al morir el último y durante pausa, diálogo y muerte; activa peligros existentes después de su aviso; ataque por esporas reutilizado.
- [x] Añadir definiciones y parámetros configurables al registro existente de enemigos (`enemies.json` si sigue siendo el archivo vigente). Evidencia: catálogo valida estadísticas, ataques, afinidad, herencia, aspecto de proyectil y señales; los cinco tipos se registran en `enemies.json`.
- [x] Diferenciar visualmente los cinco tipos; telegráficos visibles, hitboxes y colisiones coherentes. Evidencia: cinco familias de sprites procedurales, cajas de cuerpo registradas, animaciones de ataque/recuperación y proyectil de espora.
- [x] Asegurar muerte, daño elemental, invulnerabilidad, pausa, respawn y limpieza sin regresiones. Evidencia: rutas existentes de `Enemy`/`CombatSystem`; señal de peligros sincronizada con pausa, diálogo, muerte y respawn; regresión capítulo 1 incluida en suite completa.
- [x] Crear pruebas focalizadas para detección, ataque, vulnerabilidad, proyectiles y eliminación de cada tipo. Evidencia: `tests/enemies.test.ts` (41 tests), `tests/chapter2.test.ts` (10 tests), `tests/objects.test.ts` y `tests/levels.test.ts`.

**Criterio de cierre:** los cinco enemigos se pueden instanciar, combatir y destruir en una escena de prueba o nivel sin crear sistemas paralelos.

### Decisiones verificadas del bloque 2

- Los cinco tipos usan el `Enemy` y el daño compartidos. Acechador/Murciélago reutilizan `lunge`, Escupidor reutiliza la ráfaga de torreta, Guardián orgánico hereda `armored-guardian`, y Técnico biológico hereda el disparo/IA de `nexar-technician`.
- Cada tipo tiene spritesheet procedural registrado con hitbox y animación propios. El proyectil de esporas es un aspecto configurable del proyectil enemigo existente y conserva daño plasma; no se añadió un estado persistente de veneno que el jugador no soporta.
- `activeSignal` solo se admite para enemigos colocados en el nivel; `bio-hive` controla puertas/peligros existentes por `SignalBus`. El último técnico muerto la apaga. Pausa, diálogo y muerte también desactivan la señal; al reanudar/respawn, el hazard existente vuelve por su aviso.
- No se añadieron instancias a los borradores del capítulo 2, que siguen sin ser jugables. El navegador local solo se comprobó en el menú; no se afirma una partida manual ni prueba en móvil físico.
- Estado al cierre del bloque 3: la siguiente casilla era bloque 4, episodio 2.1. El avance y la validación pendiente constan en la sección del bloque 4.

---

## 4. Bloque 3 — Mecánicas ambientales

**Objetivo:** introducir solo tres familias nuevas, integradas en el registro de objetos y el bus de señales actuales.

- [x] **Planta impulsora:** al contacto, impulsa al jugador vertical o diagonalmente; dirección/fuerza configurables, feedback visual y sin bloquear controles. Evidencia: `boostPlant` configurable, dispara una vez por contacto y se rearma al salir; arte procedural y FX/sonido reutilizados.
- [x] **Suelo tóxico:** daño periódico y feedback visual, respetando invulnerabilidad; reutilizar el suelo electrificado en lo posible. Evidencia: `toxicFloor` reutiliza `HazardCycle`, gating, caja saltable, `hurtPlayer` y afinidad plasma; intervalos configurables y aviso visible.
- [x] **Nodo orgánico:** se activa mediante la interacción prevista y emite señales para abrir membranas, desactivar peligros o cambiar estados del jefe. Evidencia: `organicNode` usa `SwitchModel`/`SignalBus` en toggle o modo temporizado y sus señales sirven a puertas y hazards existentes.
- [x] Representar **membranas** preferentemente como variante visual de puertas controladas por señales, no como sistema de puertas nuevo. Evidencia: `door.style: membrane` cambia solo la textura; conserva collider y lógica de `door`.
- [x] Integrar limpieza, pausa, destrucción, muerte y respawn; evitar señales activas o temporizadores duplicados tras reinicio. Evidencia: hooks opcionales pause/resume en `LevelObjectManager`; hazards se apagan y vuelven con aviso; muerte pausa objetos y respawn desde checkpoint los reanuda; destroy idempotente y unload por prefijo.
- [x] Crear pruebas de impulso, daño periódico, señalización, colisiones y restauración del estado. Evidencia: `tests/objects.test.ts` cubre activación, fuerza, colisión, i-frames, gating, checkpoint/respawn, reinicio y liberación de recursos/texturas.

**Criterio de cierre:** los tres objetos funcionan de forma aislada y combinados con puertas, plataformas y señales existentes.

### Decisiones verificadas del bloque 3

- Las nuevas mecánicas son tipos del registro/validador actual, no gestores paralelos. `boostPlant` acepta `up`, `up-left`, `up-right` y fuerza 160–520 px/s; el contacto sostenido no relanza y salir rearma la planta.
- `toxicFloor` reutiliza las fases off/warning/active y los gates del suelo eléctrico, limita el intervalo de daño y llama al punto común `damagePlayer`; la invulnerabilidad se conserva. Al pausar se ve apagado, y al volver comienza aviso antes del daño.
- `organicNode` alterna o temporiza `SignalBus`; `door.style: membrane` mantiene la colisión/lógica de puertas actual. La activación es por contacto, con FX/sonido existente.
- El escenario de checkpoint se probó a nivel de gestor de objetos: pausa, jugador muerto, paso de tiempo detenido, reanudación, aviso, i-frames y liberación de sprite. No se realizó una partida manual ni prueba en móvil físico.
- Siguiente casilla pendiente: bloque 4, episodio 2.1 — diseñar el inicio y recorrido completo. El bloque 4 no se ha iniciado.

---

## 5. Bloque 4 — Episodios 2.1 y 2.2 — IMPLEMENTADO — PENDIENTE DE VALIDACIÓN

### 5.1 `c2-1-landing` — Caída en territorio hostil

**Bioma:** selva bioluminiscente. **Dificultad objetivo:** 5/10. **Extensión:** 7–8 secciones. **Enemigos distribuidos:** aproximadamente 16–22 (no simultáneos).

- [x] Diseñar inicio tras el aterrizaje, recorrido completo y salida funcional. Implementación: ocho secciones, cápsula rota, terreno vertical, portal final.
- [x] Introducir gradualmente acechadores, enemigos voladores y escupidores. Implementación: 18 actores en encuentros crecientes, alternando descansos.
- [x] Enseñar las plantas impulsoras mediante un tramo seguro antes de exigirlas en combate. Implementación: impulso diagonal seguro al inicio; variantes vertical/diagonal posteriores.
- [x] Añadir restos de una nave, primeras pistas de humanos y diálogos breves de LUMA. Implementación: señal física de cápsula y beats de señal/huellas humanas.
- [x] Distribuir combates variados, descansos y checkpoints. Implementación: 18 enemigos, dos checkpoints y segmentos de exploración.
- [ ] Comprobar que los enemigos no aparecen encima del jugador y que las rutas se pueden completar sin mejoras obligatorias. RESERVADO PARA BLOQUE 7.
- [ ] Verificar salida, victoria, guardado y reinicio. RESERVADO PARA BLOQUE 7.

### 5.2 `c2-2-caves` — Las cavernas vivas

**Bioma:** cuevas orgánicas. **Dificultad objetivo:** 7/10. **Extensión:** 8 secciones. **Enemigos distribuidos:** aproximadamente 22–28.

- [x] Diseñar recorrido con plataformas, altura, rutas alternativas sencillas y salida funcional. Implementación: ocho secciones, ascensos y rutas elevadas; portal al final.
- [x] Combinar voladores, escupidores y guardianes orgánicos en encuentros crecientes. Implementación: 25 actores, incluidos dos guardianes y técnicos biológicos.
- [x] Introducir suelo tóxico y membranas controladas por nodos, con avisos claros. Implementación: hazard tóxico periódico, nodo de corte y puerta membrane; segunda zona de hazard sostenida por bio-hive.
- [x] Añadir un secreto o ruta opcional con recompensa existente, sin inventar sistemas de economía. Implementación: ruta de cornisa con estrellas existentes.
- [x] Distribuir checkpoints antes de los tramos más exigentes. Implementación: dos checkpoints previos a encuentros y hazards.
- [ ] Verificar que los guardianes pueden esquivarse y atacarse por detrás, incluso en pasillos estrechos. RESERVADO PARA BLOQUE 7.
- [ ] Verificar salida, victoria, guardado y reinicio. RESERVADO PARA BLOQUE 7.

### Cierre del bloque 4

- [x] Contar enemigos reales por episodio y documentar el resultado; las cifras propuestas son orientativas, no objetivos ciegos. Recuento de datos: 18 en 2.1 y 25 en 2.2.
- [ ] Ejecutar pruebas de carga, referencias, checkpoints, finales y regresión focalizada. RESERVADO PARA BLOQUE 7; no se ejecutaron ni crearon pruebas en modo rápido.
- [ ] Realizar recorrido de navegador si el entorno lo permite; anotar explícitamente lo no comprobado manualmente. RESERVADO PARA BLOQUE 7.

**Estado:** IMPLEMENTADO — PENDIENTE DE VALIDACIÓN. Ambos episodios están configurados; no se afirma todavía que sean jugables de principio a fin.

---

## 6. Bloque 5 — Episodio 2.3 — IMPLEMENTADO — PENDIENTE DE VALIDACIÓN

### `c2-3-lab` — El laboratorio de la colmena

**Bioma:** instalación NÉXAR incrustada en tejido vivo. **Dificultad objetivo:** 8/10. **Extensión:** 8–9 secciones. **Enemigos distribuidos:** aproximadamente 26–34.

- [x] Construir recorrido completo con inicio, salida, checkpoints y progresión clara. Implementación: nueve secciones, inicio/portal, tres checkpoints, recorrido vertical y zonas de descanso.
- [x] Combinar enemigos tecnológicos existentes y enemigos orgánicos nuevos, sin saturar la pantalla. Implementación: 32 actores distribuidos entre torretas, guardianes, drones, acechadores, escupidores y técnicos.
- [x] Integrar torretas, nodos, barreras, membranas y peligros combinados. Implementación: laser, suelo tóxico, dos nodos, dos puertas membrane, dos bulkheads y plataformas móviles.
- [x] Añadir cápsulas humanas, registros y terminales con información sobre el traslado de prisioneros a la Forja. Implementación: variante de bioma `lab`, letreros/archivos y beat de signos vitales usados como energía y traslado a La Forja.
- [x] Introducir una pista concreta de que PIEZOD ya estuvo en el planeta y LUMA oculta o desconoce parte de la verdad. Implementación: beat de archivo vincula el ID PIEZOD y LUMA reconoce huecos en sus registros.
- [x] Diseñar al menos dos encuentros que exijan utilizar cobertura, plataformas, esquiva o desactivación de peligros. Implementación: nueve salas con combinaciones de hazards y enemigos, nodos que despejan rutas y plataformas sobre tramos tóxicos.
- [ ] Verificar que la presión del combate no impide resolver los mecanismos y que los checkpoints son justos. RESERVADO PARA BLOQUE 7.
- [ ] Validar victoria, guardado, muerte, respawn y salida. RESERVADO PARA BLOQUE 7.
- [ ] Ejecutar pruebas focalizadas y registrar resultados. RESERVADO PARA BLOQUE 7; no se crearon ni ejecutaron tests en modo rápido.

**Estado:** IMPLEMENTADO — PENDIENTE DE VALIDACIÓN. El episodio combina tecnología y biología y prepara narrativamente el encuentro con la Reina.

### Decisiones de implementación del bloque 5

- `c2-3-lab` usa nueve secciones de recorrido y 32 enemigos según los símbolos de la leyenda, distribuidos sin spawnear grupos simultáneos desde un sistema nuevo.
- Las cápsulas, consolas y tecnología se representan mediante el bioma `alien/lab`; los objetos reutilizan `movingPlatform`, `toxicFloor`, `organicNode`, puertas `membrane`, láseres y señales existentes.
- Los beats revelan extracción de energía humana, red de inteligencia colectiva, traslado a La Forja y vínculo previo de PIEZOD; el último dirige al núcleo donde se espera a la Reina.
- No se ejecutó validador de niveles, pruebas, typecheck, build ni navegador. Salida alcanzable, densidad, colocación exacta de enemigos, checkpoint/guardado, dificultad 8/10 y recorrido completo quedan pendientes del bloque 7.

---

## 7. Bloque 6 — Episodio 2.4 y Reina del Enjambre — IMPLEMENTADO — PENDIENTE DE VALIDACIÓN

### `c2-4-queen` — El corazón del Enjambre

**Bioma:** nido central. **Dificultad objetivo:** 9/10. **Enemigos previos:** 6–10 aproximadamente; apoyos limitados durante el jefe. Implementación actual: 9 enemigos previos.

- [x] Construir aproximación al nido, checkpoint previo, arena funcional y salida/portal final condicionado a la victoria. Implementación: cuatro secciones de aproximación, checkpoint antes de arena de 40 tiles, puerta de entrada y portal/puerta de salida gobernados por señales.
- [x] Diseñar la **Reina del Enjambre** reutilizando la arquitectura de `OmegaController` y `BossEncounter`, extrayendo comportamientos comunes solo si es seguro y necesario. Implementación: controlador pequeño `SwarmQueenController`; `Enemy`, `BossEncounter`, `CombatSystem` y la lógica de arena siguen compartidos.
- [x] Añadir barra de vida propia, señales de ataque claras, ventanas de vulnerabilidad y colisiones. Implementación: vida de 32, barra en HUD, tintes/animaciones propios, hitbox boss en el mismo `Enemy`.
- [x] **Fase 1 (100–70 %):** proyectiles orgánicos y ataques anticipados con ventanas de respuesta. Implementación: disparo dirigido, picado telegrafiado y recuperación vulnerable.
- [x] **Fase 2 (70–35 %):** nodos orgánicos que protegen temporalmente al jefe, peligros del escenario y enemigos de apoyo limitados. Implementación: dos nodos obligatorios, hazard por señal y oleadas limitadas.
- [x] **Fase 3 (35–0 %):** combinaciones más rápidas de patrones anteriores, sin daño inevitable ni proyectiles ilimitados. Implementación: telegráficos más breves, ráfagas abiertas, hazard, picado y apoyo acotado.
- [x] Implementar desactivación de nodos para exponer al jefe, con feedback inequívoco de protegido/vulnerable. Implementación: ambas señales requeridas; nodos brillantes, Reina/barra moradas protegida y verdes vulnerable.
- [x] Gestionar transiciones de fase, diálogos, muerte, respawn y destrucción de escena: limpiar proyectiles, señales, peligros y temporizadores. Implementación: reset nodos/apoyos y `clearBossShots` en transición, suspensión, derrota y destroy; hazard gobernado por señales del encounter.
- [x] Crear secuencia final: liberar o localizar pistas sobre prisioneros, revelar transporte a **La Forja de los Cautivos** y anticipar capítulo 3 sin implementarlo. Implementación: diálogo tras victoria informa traslado, registro PIEZOD y portal; no se registra capítulo 3.
- [x] Registrar victoria del episodio y finalización del capítulo 2 sin marcar capítulo 3 como jugable. Implementación: 2.4 último nivel de `alien`, gate de portal usa `BossEncounter`, `CampaignManager.complete` conserva el progreso común.
- [ ] Añadir y ejecutar pruebas de umbrales, nodos, vulnerabilidad, fases, limpieza, muerte, respawn, victoria y guardado. RESERVADO PARA BLOQUE 7; no se crearon ni ejecutaron tests en modo rápido.

**Estado:** IMPLEMENTADO — PENDIENTE DE VALIDACIÓN. No se afirma todavía que el boss sea vencible ni que el episodio esté completo de principio a fin.

### Decisiones de implementación del bloque 6

- La Reina es una variante de jefe dentro de `Enemy`, no un sistema de combate paralelo. `SwarmQueenController` aporta solo fases/patrones; disparos, daño, barra, cámara, intro/victory, portal y guardado reutilizan los sistemas existentes.
- `BossEncounter.vulnerableBy` requiere señales de `organicNode` del nivel; ambas deben activarse. La escena valida su existencia y el bus las restablece en cambio de fase, muerte y checkpoint.
- Oleadas limitadas a dos apoyos por fase y máximo cuatro apoyos vivos; los actores usan tipos existentes (Acechador/Murciélago). Transiciones, derrota, suspensión y salida limpian apoyos y proyectiles.
- El último diálogo revela La Forja y el vínculo de PIEZOD; el capítulo 3 continúa sin registro ni selector.
- Incidencia corregida durante implementación: un parche de filas duplicó suelo y dañó el JSON de 2.4; se reescribieron únicamente sus seis secciones. Una lectura estructural posterior confirmó JSON parseable, diez filas por sección y suelo hasta el ancho máximo; no equivale a ejecutar `LevelValidator`.
- No se ejecutó validador de nivel, tests, typecheck, build, navegador ni prueba móvil. Hitboxes, alcanzabilidad, equilibrio, reinicio de nodos, tres fases y secuencia completa quedan pendientes del bloque 7.

---

## 8. Bloque 7 — Integración y validación final

- [x] Comprobar registro y carga de los cuatro episodios del capítulo 2 desde el selector normal. Evidencia: tests de campaña/capítulo 2 pasan; el selector normal listó 2.1–2.4 y se cargó `c2-4-queen`.
- [x] Respetar el modo vigente de selección libre/progresión; no bloquear episodios de capítulos anteriores ni alterar equipamiento. Evidencia: pruebas `PLATFORMER_ACCESS` y `STANDARD_ACCESS` pasan; alien disponible según freeLevels y secuencial bajo STANDARD_ACCESS.
- [x] Confirmar que prólogo y capítulo 1 siguen funcionando y que OMEGA-7 no ha sufrido regresiones. Evidencia: `tests/chapter1.test.ts` y `tests/omega.test.ts` pasan dentro de suite completa.
- [x] Confirmar compatibilidad de partidas anteriores, persistencia de equipamiento, checkpoints, progreso y estadísticas. Evidencia: suites de migración/guardado; no se borró storage real. El navegador solo creó el perfil por defecto, sin clave de progreso.
- [ ] Revisar que todos los enemigos nuevos se pueden derrotar con las armas funcionales existentes.
- [ ] Contabilizar enemigos por episodio y comprobar límites de simultaneidad y proyectiles, especialmente en móvil.
- [ ] Revisar legibilidad del pixel-art, avisos de peligro, interfaz, barra del jefe y diálogos en pantallas táctiles.
- [ ] Comprobar inicio, recorrido, checkpoints, muerte, respawn y victoria de cada episodio en navegador si es posible.
- [x] Ejecutar la suite completa de tests y registrar el **número exacto** de pruebas superadas. `npm test`: 436/436, 0 fallidas, 13 archivos.
- [x] Ejecutar typecheck del proyecto y de tests (según scripts reales) y registrar resultados. `npm run typecheck` y `npx tsc --noEmit -p tests/tsconfig.json`: correctos.
- [x] Ejecutar build de producción y `build:ci` si existe; registrar resultados. `npm run build`: correcto; Vite 102 módulos. `build:ci` no se repitió porque ejecuta de nuevo tests y build.
- [ ] Ejecutar `git diff --check` y revisar archivos nuevos, temporales y posibles secretos.
- [ ] Actualizar documentación de campaña y controles si han cambiado; no afirmar que el capítulo está probado en móvil físico si no lo está.
- [ ] Entregar informe final con archivos modificados, sistemas reutilizados, nuevas mecánicas, recuento de enemigos, resultados de pruebas, incidencias y pendientes manuales.

**Criterio de cierre:** cuatro episodios completos y técnicamente validados, sin regresiones conocidas. La jugabilidad y el balance final deben confirmarse jugando, especialmente en móvil físico.

### Estado de validación funcional

- Selector normal: se comprobó que aparecen los cuatro episodios alien y se inicia `c2-4-queen`; el estado inicial del jugador y boss fue correcto.
- No se demostró un recorrido completo. La pestaña compartida suspendida acumuló tiempo de Phaser y PIEZOD murió fuera del mundo; tras recargar, el nivel se inició correctamente, pero no se completó el combate ni se llegó a la victoria. Los recorridos 2.1–2.4, checkpoints, salida y guardado requieren prueba manual.
- Viewport emulado 844×390: canvas y HUD se muestran; `navigator.maxTouchPoints` fue 0. La emulación CDP táctil quedó bloqueada/deferred; no se validó interacción táctil ni móvil físico.
- Reinicio de progreso real no realizado. Perfil local observado: solo `miniverse.platformer.profile` con valores por defecto; `miniverse.platformer.progress` ausente. Staging no se desplegó.

---

## 9. Tabla de seguimiento por episodio

| Episodio | Diseño | JSON válido | Jugable inicio-fin | Enemigos y mecánicas | Checkpoints/guardado | Prueba manual |
|---|---|---|---|---|---|---|
| 2.1 Caída | ✓ implementado | Pendiente validar | ☐ | ✓ implementado | ☐ | ☐ |
| 2.2 Cavernas | ✓ implementado | Pendiente validar | ☐ | ✓ implementado | ☐ | ☐ |
| 2.3 Laboratorio | ✓ implementado | Pendiente validar | ☐ | ✓ implementado | ☐ | ☐ |
| 2.4 Reina | ✓ implementado | Pendiente validar | ☐ | ✓ implementado | ☐ | ☐ |

> Actualiza también esta tabla al completar hitos. Usa `✓` solo si existe evidencia; conserva `☐` para lo pendiente.

## 10. Registro de validaciones

| Fecha | Comando o comprobación | Resultado | Observaciones |
|---|---|---|---|
| 2026-10-27 | `npx vitest run tests/chapter2.test.ts` | 9/9 correctos | Esquemas, catálogo previsto, referencias, variantes, contraste y presupuesto visual |
| 2026-10-27 | `npx vitest run tests/chapter1.test.ts tests/chapter2.test.ts` | 80/80 correctos | Regresión de carga y biomas anteriores |
| 2026-10-27 | `npm run typecheck` | Correcto | Proyecto |
| 2026-10-27 | `npx tsc --noEmit -p tests/tsconfig.json` | Correcto | Tests y mocks |
| 2026-10-27 | `npm run build` | Correcto | TypeScript + Vite, sin publicación |
| 2026-10-27 | `npm run build:ci` | 409/409 tests; build correcto | 13 archivos de tests; validación final del bloque 1 |
| 2026-10-27 | `git diff --check` | Correcto | Se conservan cambios previos de acceso libre |
| 2026-10-27 | Navegador / viewport móvil | Arte verificado, no jugabilidad | 36/36 texturas no vacías; lámina 1280 x 720 y 390 x 844; sin FPS ni recorrido real |
| 2026-10-27 | `npx vitest run tests/enemies.test.ts` | 35/35 correctos | Comportamiento del Acechador y regresión del motor/catálogo de enemigos |
| 2026-10-27 | `npx vitest run tests/enemies.test.ts tests/chapter2.test.ts` | 44/44 correctos | Registro de enemigo, integración del capítulo 2 y regresión focalizada |
| 2026-10-27 | `npm run typecheck` | Correcto | TypeScript del proyecto tras añadir configuración, sprite y arte |
| 2026-10-27 | `npx vitest run tests/enemies.test.ts tests/chapter2.test.ts` | 46/46 correctos | Acechador, Escupidor, proyectil spore, carga del catálogo y bioma del capítulo 2 |
| 2026-10-27 | `npx tsc --noEmit -p tests/tsconfig.json` | Correcto | Tests focalizados de enemigos |
| 2026-10-27 | `npx vitest run tests/enemies.test.ts tests/chapter2.test.ts` | 47/47 correctos | Patrulla, picado, catálogo y carga del capítulo 2 |
| 2026-10-27 | `npx vitest run tests/enemies.test.ts tests/chapter2.test.ts` | 48/48 correctos | Herencia y vulnerabilidad del Guardián orgánico, catálogo y carga del capítulo 2 |
| 2026-10-27 | `npx vitest run tests/enemies.test.ts tests/chapter2.test.ts tests/objects.test.ts tests/levels.test.ts` | 131/131 correctos | Cinco enemigos, señales bio-hive, validación de niveles/objetos y regresión focalizada |
| 2026-10-27 | `npm run build:ci` | 417/417 tests; build correcto | 13 archivos de tests; compilación Vite de producción sin publicación |
| 2026-10-27 | `npm run typecheck` + `npx tsc --noEmit -p tests/tsconfig.json` | Ambos correctos | Proyecto y tests |
| 2026-10-27 | `git diff --check` | Correcto | No se cambiaron rama ni archivos locales ajenos a la tarea |
| 2026-10-27 | Navegador local | Canvas 320 x 180 visible; no combate manual | El capítulo 2 sigue en borradores no seleccionables; se vio el menú |
| 2026-10-27 | `npx vitest run tests/objects.test.ts` | 65/65 correctos | Fábricas reales; activación, daño, i-frames, señales, membranas, checkpoint/respawn y limpieza |
| 2026-10-27 | `npx vitest run tests/objects.test.ts tests/levels.test.ts tests/chapter1.test.ts tests/chapter2.test.ts` | 169/169 correctos | Regresión de niveles, capítulo 1 y catálogo de capítulo 2 |
| 2026-10-27 | `npm run build:ci` | 425/425 tests; build correcto | 13 archivos; TypeScript + Vite |
| 2026-10-27 | `npm run typecheck` + `npx tsc --noEmit -p tests/tsconfig.json` | Ambos correctos | Proyecto y tests |
| 2026-10-27 | `git diff --check` | Correcto | Sin publicación ni cambio de rama |
| 2026-10-27 | `npx vitest run tests/chapter2.test.ts tests/enemies.test.ts` | 55/55 correctos | Niveles, referencias de nodos, tres fases, protección y apoyo limitado |
| 2026-10-27 | `npx vitest run tests/campaign.test.ts tests/chapter1.test.ts` | 119/119 correctos | Progresión libre/estándar, guardados y regresión estación/OMEGA |
| 2026-10-27 | `npm test` | 436/436 correctos; 0 fallidos | Suite completa, 13 archivos |
| 2026-10-27 | `npm run typecheck` + `npx tsc --noEmit -p tests/tsconfig.json` | Ambos correctos | Proyecto y tests |
| 2026-10-27 | `npm run build` | Correcto | TypeScript + Vite, 102 módulos; sin despliegue |
| 2026-10-27 | Playwright local, selector normal | 2.4 carga; recorrido incompleto | Sesión anterior suspendida provocó caída; reload permitió cargar vivo. No cuenta como prueba de completabilidad |
| 2026-10-27 | Viewport 844 x 390 / emulación táctil | Canvas visible; touch no verificado | `maxTouchPoints=0`; CDP touch quedó deferred. Sin móvil físico |
| — | Móvil físico | Pendiente | Lo probará el usuario |

## 11. Instrucción corta para retomar en una nueva sesión de Copilot

> Lee `MINIVERSE_CAPITULO_2_PLAN.md` completo. Revisa el estado real del repositorio y continúa **solo desde el primer bloque pendiente**, reutilizando lo ya implementado. Actualiza las casillas `[x]` y el registro de sesión únicamente después de verificar cada tarea. Ejecuta pruebas focalizadas, informa de resultados y del siguiente paso. No hagas commit, push, merge, cambio de rama ni despliegue sin autorización. No desarrolles el capítulo 3.
