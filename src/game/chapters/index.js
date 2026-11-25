import { objetivosCapitulo1, puntosCapitulo1 } from "./chapter1.js";
import { objetivoCapitulo2, puntosCapitulo2 } from "./chapter2.js";
import { objetivosCapitulo3, puntosCapitulo3 } from "./chapter3.js";
import { objetivosCapitulo4, puntosCapitulo4 } from "./chapter4.js";
import { objetivosCapitulo5, puntosCapitulo5 } from "./chapter5.js";
import { objetivosCapitulo6, puntosCapitulo6 } from "./chapter6.js";

// Devuelve el texto de misión correspondiente a cualquier capítulo activo.
export function obtenerObjetivo(fase, estado) {
  return (
    objetivosCapitulo1[fase] ||
    objetivoCapitulo2(fase, estado) ||
    objetivosCapitulo3[fase] || objetivosCapitulo4[fase] || objetivosCapitulo5[fase] || objetivosCapitulo6[fase] ||
    "Explora el bosque y sigue las pistas de Daniel."
  );
}

// Devuelve las coordenadas del marcador para una fase de misión.
export function obtenerPuntoObjetivo(fase) {
  return puntosCapitulo1[fase] || puntosCapitulo2[fase] || puntosCapitulo3[fase] || puntosCapitulo4[fase] || puntosCapitulo5[fase] || puntosCapitulo6[fase];
}
