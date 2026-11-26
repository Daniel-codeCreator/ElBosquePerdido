# Audio y medios externos

El juego no descarga ni referencia archivos externos. Todos los sonidos actuales se generan con Web Audio y `speechSynthesis`; las fogatas, personajes y objetos son primitivas de Babylon.js.

Para sustituir o complementar el audio procedural, colocar únicamente medios verificados en `public/audio/` y cargar rutas locales relativas. Formatos recomendados: `.ogg` para ambiente/efectos en bucle y `.mp3` como alternativa de compatibilidad. Mantener versiones `.wav` sin pérdida fuera del paquete de producción.

Antes de añadir un archivo, registrar autor, URL de origen, licencia, atribución exigida, modificaciones y fecha de verificación. Usar solo audio propio, dominio público verificable o una licencia que permita distribución comercial dentro de este proyecto. No usar material de juegos, películas, bibliotecas sin licencia clara ni enlaces remotos.

Medios que aún se necesitarían, si se verifican legalmente: viento y bosque, río, fuego, pasos, manipulaciones de inventario, voces interpretadas, criatura, Eco y música. Este documento no afirma que esos recursos ya existan o estén licenciados.
