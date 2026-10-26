# Dirección de arte — Pixel art retro

## Identidad visual
Estética original de plataformas de 16 bits: colores vivos, siluetas claras, iluminación sencilla y contornos coherentes. Personaje principal explorador, no fontanero ni imitaciones de franquicias conocidas.

## Especificaciones
- Resolución lógica: 320x180.
- Personaje base: 32x32 px por frame, con caja de colisión ajustada al cuerpo visible.
- Tiles del mundo: 16x16 px; permite combinar 2x2 tiles para elementos mayores.
- Sprites PNG con transparencia y dimensiones exactas.
- Spritesheets en cuadrícula regular, sin márgenes inconsistentes; registrar ancho, alto, orden y FPS de cada animación.
- Filtro nearest-neighbor; no aplicar suavizado bilineal.
- Capas de fondo con parallax discreto y contraste suficiente con el suelo.

## Animaciones iniciales
Idle 4 frames, run 6, jump 1-2, fall 1-2, hurt 2, death 4. Si faltan frames, usar placeholders explícitos sin bloquear jugabilidad.

## Pipeline de assets
1. Priorizar placeholders geométricos para validar físicas.
2. Crear o adquirir assets originales con licencia adecuada (por ejemplo CC0), guardar origen y licencia.
3. Revisar sprites generados por IA: alineación, silueta, transparencia, consistencia de vestuario y tamaño.
4. Recortar y empaquetar spritesheets de forma reproducible, preferiblemente con script versionado.
5. Validar animaciones y colisiones dentro del juego.

## Manifiesto
Mantener `assets-manifest.json` (o formato equivalente) con ruta, dimensiones, autor/origen, licencia y uso. No incorporar assets sin derechos claros.
