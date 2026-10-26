# Sistema de combate de MiniVerse (plataformas)

Este documento describe el modelo de daño unificado, las afinidades elementales, los efectos de
estado, las armas modulares y el equipamiento F/R, y explica cómo ampliarlos **solo con JSON**
(o con un módulo nuevo cuando la mecánica no exista todavía).

## Archivos

| Qué | Dónde |
| --- | --- |
| Afinidades (elementos y matriz) | `public/assets/platformer/combat/elements.json` |
| Efectos de estado | `public/assets/platformer/combat/status-effects.json` |
| Enemigos | `public/assets/platformer/enemies/enemies.json` |
| Armas y pasivas | `public/assets/platformer/abilities/abilities.json` |
| Cálculo de daño | `src/games/platformer/combat/damage.ts` |
| Matriz de afinidades | `src/games/platformer/combat/elements.ts` |
| Estados | `src/games/platformer/combat/status.ts` |
| Carga y validación cruzada | `src/games/platformer/progression/gameData.ts` (`buildCatalogs`) |
| Guardado y equipamiento | `src/games/platformer/progression/Profile.ts` |

Todos los catálogos se validan al cargar. Los errores salen en la consola del navegador y los
tests (`npm test`) fallan si algún JSON del juego tiene errores.

## Forma frente a afinidad

Cada golpe (`Hit`) tiene dos ejes independientes:

- **Forma** (`form`): *cómo* llega el golpe. `contact`, `stomp`, `projectile`, `area`, `status`.
- **Afinidad** (`element`): *de qué* está hecho. `energy`, `laser`, `plasma`, `cryo`, `fire`, o
  ninguna (`null`).

Un pisotón no tiene elemento; un rayo es `projectile` + `energy`; el lanzallamas es `area` + `fire`;
la quemadura es `status` + `fire`. Las resistencias por forma (`formResist`) y por elemento
(`resist`) se configuran por separado y nunca se mezclan.

## Orden de cálculo

`computeDamage(hit, defense, chart)` aplica cada factor **una sola vez** y en este orden:

1. **Daño base** (`hit.amount`, admite decimales).
2. **Inmunidad**: si el defensor es inmune al elemento o a la forma → 0 (y no recibe estados).
3. **Afinidad**: `chart.multiplier(elemento del golpe, elemento del defensor)` (tipo contra tipo).
4. **Resistencia/vulnerabilidad personal por elemento**: `defense.resist[elemento]`.
5. **Resistencia por forma**: `defense.formResist[forma]`.
6. **Modificadores situacionales** (`hit.situational`): guardia frontal, vulnerabilidad por
   Sobrecarga, bonus futuros (carga, golpe crítico...).
7. **Armadura plana** (`defense.armor`), salvo `ignoreArmor` (los estados la ignoran). Nunca baja de 0.

`damageBreakdown` devuelve todos los factores intermedios, útil para depurar el equilibrio.

## Afinidades (`elements.json`)

```json
{
  "elements": { "energy": { "name": "Energia", "color": "#ffe14d" }, "...": {} },
  "cycle": ["energy", "laser", "plasma", "cryo", "fire"],
  "advantage": 1.5,
  "disadvantage": 0.5,
  "overrides": { "fire": { "fire": 0.75 } }
}
```

- Cada elemento del `cycle` vence al siguiente (×`advantage`) y el último vence al primero.
- La relación inversa inflige ×`disadvantage`. El resto es neutro (×1).
- `overrides` (opcional) fija multiplicadores concretos y se aplica al final.

### Añadir un tipo elemental

1. Añádelo a `elements` con nombre y color.
2. Colócalo en `cycle` o define sus relaciones en `overrides`.
3. Ya se puede usar en `element`/`resist`/`immune` de enemigos, armas y estados. La tienda y la
   pantalla de afinidades lo muestran automáticamente.

No hace falta tocar código.

## Efectos de estado (`status-effects.json`)

| Campo | Significado |
| --- | --- |
| `kind` | `dot` (daño periódico), `slow` (velocidad ×intensity), `stun` (sin moverse ni atacar), `vulnerable` (daño recibido ×intensity) |
| `duration` / `maxDuration` | segundos; ninguna duración puede superar 20 s |
| `intensity` | daño por tick y acumulación (`dot`), multiplicador de velocidad 0..1 (`slow`) o de daño 1..5 (`vulnerable`) |
| `tick` | segundos entre ticks (`dot`) |
| `stacking` | `refresh` (reinicia), `intensity` (+1 acumulación hasta `maxStacks`), `extend` (suma duración hasta `maxDuration`), `ignore` (no se reaplica mientras dure: evita bloqueos permanentes) |
| `element` | elemento del daño periódico (usa la matriz de afinidades) |
| `blockedBy` | elementos de defensor inmunes (p. ej. un enemigo de fuego no se quema) |
| `tint` | color mientras está activo (efecto visual mínimo) |

Garantías contra efectos permanentes: duración máxima limitada, `maxDuration` en `extend`,
`maxStacks` en `intensity`, `ignore` para la congelación y vulnerabilidad total limitada a ×3.
Al morir un enemigo se limpian sus estados.

Estados incluidos: `burn` (Quemadura), `chill` (Ralentización), `freeze` (Congelación),
`overload` (Sobrecarga) y `plasma-residue` (Residuo de plasma).

## Enemigos (`enemies.json`)

Campos de combate nuevos (los anteriores siguen igual):

```json
"bat-frost": {
  "extends": "bat",
  "element": "cryo",
  "resist": { "fire": 2 },
  "formResist": { "stomp": 1 },
  "immune": [],
  "statusImmune": ["chill"],
  "attack": { "kind": "shoot", "element": "fire" }
}
```

- `element` (obligatorio): tipo principal.
- `resist`: multiplicadores personales **por elemento** (0.5 resistente, 2 vulnerable, 0 anula).
- `formResist`: multiplicadores por forma de ataque.
- `immune`: elementos y/o formas que no hacen daño.
- `statusImmune`: estados que nunca recibe.
- `attack.element`: elemento de sus disparos (por defecto, el del enemigo).
- `extends` combina `resist` y `formResist` con los del padre.

Un jefe no puede ser inmune al pisotón (ni por `stomp: "immune"`, ni por `immune`, ni por
`formResist.stomp: 0`): todos los niveles deben poder completarse sin armas.

### Añadir un enemigo

1. Añade la entrada en `enemies.json` (o usa `extends` para una variante).
2. Colócalo en un nivel con la leyenda de enemigos del nivel.
3. `npm test` valida el JSON y los niveles.

Para jefes de varias fases, el modelo ya admite cambiar defensa por fase: `Enemy` construye su
`Defense` desde la definición, así que una fase futura solo necesita sustituir esa defensa (o la
definición) al cruzar un umbral de vida.

## Armas (`abilities.json`)

```json
"flamethrower": {
  "name": "Lanzallamas",
  "module": "flamethrower",
  "slot": "active",
  "element": "fire",
  "defaultSlot": "secondary",
  "available": true,
  "requires": "ruins-1",
  "levels": [
    { "cost": 20, "energy": 40, "cooldown": 0, "params": { "range": 34 }, "effects": [{ "id": "burn", "chance": 0.15 }] }
  ],
  "assets": { "icon": 2, "fx": "flame" }
}
```

- `module`: comportamiento reutilizable (`projectile`, `flamethrower`...). Varias armas pueden usar
  el mismo módulo con otros parámetros, y dos armas pueden compartir elemento.
- `element`: afinidad de todos sus golpes (obligatoria en armas).
- `defaultSlot`: ranura preferida al comprarla (`primary` = F, `secondary` = R). El jugador puede
  cambiarla.
- `available: false`: arma planificada. No aparece en la tienda, no se puede comprar ni equipar.
  Es la única forma de referenciar un módulo aún no implementado (`PLANNED_MODULE_IDS`).
- Por nivel: `cost`, `energy` (por uso o por segundo), `cooldown`, `params` (daño, alcance,
  velocidad...) y `effects` (estados con probabilidad opcional).

### Añadir un arma

- **Con un módulo existente** (p. ej. otro proyectil con otro elemento): solo JSON.
- **Con una mecánica nueva**: crea `abilities/modules/<id>.ts` con la firma `AbilityModule`,
  regístralo en `modules/index.ts`, mueve el id de `PLANNED_MODULE_IDS` a `ABILITY_MODULE_IDS` y
  cambia el arma a `available: true`. El módulo recibe `def.element` y `stats.effects` y debe
  pasarlos al golpe (`combat.firePlayerShot` o `combat.damageArea`).

Armas preparadas (no disponibles):

| Arma | Elemento | Módulo previsto | Idea |
| --- | --- | --- | --- |
| Cañón criogénico | Criogénico | `cryo-spray` | ralentiza (`chill`) y puede congelar (`freeze`) |
| Proyector de plasma | Plasma | `plasma-projector` | daño residual (`plasma-residue`) |

### Cañón láser (`charged-shot`, disponible)

Mantener el botón (F/R o botón táctil) carga; soltar dispara un haz instantáneo horizontal que se
detiene en el terreno sólido y golpea a los `pierce` enemigos más cercanos. Cada golpe pasa por
`applyHit`, así que respeta afinidad, resistencias, inmunidades, guardia y armadura.

| Parámetro | Significado |
| --- | --- |
| `damage` / `chargedDamage` | daño sin carga / a carga completa (lineal entre ambos) |
| `chargeTime` | segundos hasta la carga completa |
| `range`, `pierce`, `beamHeight` | alcance (px), enemigos atravesados y grosor base del haz |
| `energy` | coste de la carga completa; se paga al soltar: 40 % sin carga → 100 % a carga completa |
| `cooldown` | espera tras disparar antes de poder cargar de nuevo |
| `assets.color` | color del haz y del brillo de carga |

Si otra arma gasta energía durante la carga, el máximo de carga baja a lo que se puede pagar; sin
energía para un disparo sin carga no se puede empezar a cargar. Morir cancela la carga.

| Nivel | Coste | Energía | Cooldown | Daño | Carga | Atraviesa |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 25 | 30 | 0.9 s | 1 → 2.5 | 1.2 s | 2 |
| 2 | 35 | 26 | 0.8 s | 1.25 → 3.5 | 1.0 s | 3 |
| 3 | 45 | 22 | 0.7 s | 1.5 → 4.5 | 0.9 s | 4 |

Requiere completar `ice-1`. El Rayo y el Lanzallamas no se han modificado.

## Equipamiento F/R y guardado

- Dos ranuras de arma: **F** (`primary`) y **R** (`secondary`). Las pasivas (Propulsión) van aparte.
- Desde la tienda: `F`/`R` (o los botones *Equipar F / Equipar R*) asignan el arma seleccionada.
  Si ya estaba en la otra ranura, las dos armas se intercambian. `E` quita.
- Los botones táctiles del HUD siguen mapeados a las mismas acciones.

Formato del guardado (`localStorage` `miniverse.platformer.profile`):

- **v1**: `{ collected, spent, owned, equipped: [...] }`
- **v2**: `{ version: 2, collected, spent, owned, passives: [...], weapons: { primary, secondary } }`

`migrateProfile` convierte v1 → v2 conservando estrellas, compras y niveles de mejora; el rayo va a
F y el lanzallamas a R. El perfil migrado se guarda inmediatamente.

## Cambios de equilibrio respecto a la versión anterior

| Enemigo | Antes | Ahora |
| --- | --- | --- |
| Musgobot, veloz, Saltarín | sin tipo | Energía → Lanzallamas ×1.5, Rayo ×1 |
| Acorazado | `resist.beam 0.5` | Plasma + `resist.energy 0.5` → Rayo ×0.5 (igual que antes) |
| Murciélago | sin tipo | Plasma (neutro contra Rayo y Lanzallamas) |
| Murciélago de escarcha | `resist.fire 2` | Criogénico + `resist.fire 2` → Lanzallamas ×1 (antes ×2), inmune a Ralentización |
| Escupefuego | sin tipo | Fuego → Rayo ×0.5, Lanzallamas ×1 |
| Gólem | `resist.fire 0.5` | Energía + `resist.fire 0.5` → Lanzallamas ×0.75 (antes ×0.5) |
| Rey de Magma | `resist.fire 0.25` | Fuego + `resist.fire 0.25` → Rayo ×0.5, Lanzallamas ×0.25; sigue siendo pisable |

El daño del jugador recibido no cambia: el protagonista aún no tiene elemento ni armadura.
Los precios de la tienda no se han modificado.
