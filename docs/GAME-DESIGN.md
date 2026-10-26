# Diseño del primer minijuego: Aventuras Pixel

## Concepto
Plataformas 2D retro, alegre y original. Un pequeño explorador atraviesa un bosque mecánico para recuperar estrellas perdidas. Evitar similitudes reconocibles con personajes o niveles existentes.

## Bucle principal
Explorar → saltar obstáculos → recoger estrellas → evitar o superar enemigos → alcanzar el portal final.

## MVP
- Un nivel de 2 a 3 minutos, con principio, sección de aprendizaje, reto y meta.
- Movimiento horizontal, salto variable (si es viable), gravedad y colisiones sólidas.
- Cámara horizontal con límites del mapa.
- Estrellas coleccionables y contador.
- Un enemigo patrulla; el contacto hace perder vida o reinicia en checkpoint.
- Tres vidas o salud equivalente, un checkpoint, pausa, victoria y derrota.
- Controles: A/D o flechas para moverse, espacio para saltar; botones táctiles equivalentes.
- HUD legible en 320x180.

## Sensación de control
Prioriza control preciso y predecible. Considera coyote time (~100 ms) y jump buffering (~100 ms). Ajusta velocidades jugando, no por números arbitrarios.

## Diseño del nivel
Inicio seguro con tutorial visual; primeras plataformas fáciles; después enemigo y salto combinado; checkpoint a mitad; tramo final y portal. Evita saltos imposibles y apariciones fuera de cámara.

## Extensión futura
Más niveles, biomas, habilidades, enemigos, secretos y guardado. No implementarlos en el MVP.
