# Tareas secuenciales para Copilot

Trabajar de una fase en una fase. Antes de empezar, inspeccionar el repositorio. Tras cada fase, ejecutar `npm run build` y las pruebas existentes, e indicar cómo verificar manualmente.

## Fase 1 — Auditoría y base
- [ ] Identificar estructura, escenas, assets, scripts y dependencias actuales.
- [ ] Comprobar que el menú abre y cierra el primer minijuego.
- [ ] Configurar pixelArt, resolución lógica 320x180 y escalado responsivo.
- [ ] Crear un nivel de prueba con placeholders y controles de teclado/táctiles.
- [ ] Documentar comandos para iniciar y probar.

**Aceptación:** se puede abrir el minijuego desde el menú y controlar un personaje en PC y móvil sin deformación de píxeles.

## Fase 2 — Jugabilidad
- [ ] Movimiento horizontal, salto, colisiones y cámara.
- [ ] Ajustar sensación de salto; añadir coyote time y jump buffering si es compatible.
- [ ] Añadir coleccionables, enemigo patrulla, daño, vidas y checkpoint.
- [ ] Crear pantallas de victoria, derrota y pausa.

**Aceptación:** completar o perder una partida sin errores; reiniciar no duplica controles ni físicas.

## Fase 3 — Arte
- [ ] Definir y cargar spritesheets del explorador original.
- [ ] Implementar idle/run/jump/fall/hurt/death con fallback.
- [ ] Añadir tileset bosque mecánico 16x16, fondos y parallax.
- [ ] Registrar fuentes y licencias en manifiesto.

**Aceptación:** sprites nítidos, animaciones alineadas y colisiones ajustadas.

## Fase 4 — Primer nivel
- [ ] Construir nivel de 2–3 minutos con introducción, progresión, checkpoint y portal.
- [ ] Distribuir coleccionables y enemigos sin saltos imposibles.
- [ ] Añadir HUD legible y tutorial contextual breve.

**Aceptación:** un jugador nuevo puede terminar el nivel sin instrucciones externas.

## Fase 5 — Audio y móvil
- [ ] Añadir SFX originales/libres y música opcional, con mute.
- [ ] Ajustar controles táctiles, tamaños y áreas seguras.
- [ ] Probar orientación horizontal y pausa al perder foco.

**Aceptación:** jugable en móvil, sin cortes de interfaz ni audio automático no permitido.

## Fase 6 — Calidad
- [ ] Verificar compilación, errores de consola y rendimiento.
- [ ] Revisar reinicios, cambios de escena y limpieza de recursos.
- [ ] Documentar cómo añadir un segundo minijuego sin modificar el primero.

**Aceptación:** build estable y guía de extensión reproducible.
