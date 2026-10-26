# Instrucciones permanentes para GitHub Copilot — MiniVerse

## Contexto
MiniVerse es un contenedor modular de minijuegos 2D. Usa Phaser 3, TypeScript y Vite. El primer minijuego es un plataformas retro de desplazamiento lateral con propiedad intelectual original. Debe funcionar en navegador de escritorio y móvil.

## Reglas
- Inspecciona el repositorio antes de implementar; reutiliza escenas, entidades, controles, assets y utilidades existentes.
- Mantén el menú principal desacoplado de los minijuegos; evita dependencias cruzadas entre juegos.
- Usa TypeScript tipado; evita `any` salvo necesidad documentada.
- Separa configuración, escenas, entidades, datos de nivel y recursos.
- Resolución lógica objetivo: 320x180, escalado entero cuando sea posible y pixelArt habilitado; adapta viewport móvil sin distorsionar.
- Movimiento y físicas basados en delta/Arcade Physics; evita lógica dependiente de FPS.
- Soporta teclado y controles táctiles; no dependas de hover.
- Carga y descarga recursos por juego; no dupliques listeners ni timers al reiniciar escenas.
- Conserva licencia, autoría y origen de cada asset en un manifiesto.
- Nunca utilices personajes, música, niveles o sprites protegidos de Mario/Nintendo.
- No agregues librerías grandes sin explicar su utilidad.
- Al finalizar cada tarea: resume archivos cambiados, cómo probar y problemas pendientes. Ejecuta build y tests disponibles; no afirmes haberlos ejecutado si no lo hiciste.

## Definición de terminado
La funcionalidad es jugable, no rompe el menú ni otros minijuegos, se puede probar con teclado y móvil, compila y no deja errores de consola reproducibles.
