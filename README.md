# El Bosque Perdido

Prototipo 3D de supervivencia y terror psicológico en primera persona, creado con Babylon.js y Vite.

## Requisitos

- Node.js 20 o superior.
- Un navegador moderno compatible con WebGL.

## Ejecutar el proyecto

1. Abre una terminal en la carpeta del proyecto.
2. Instala las dependencias:

   ```powershell
   npm install
   ```

3. Inicia el servidor de desarrollo:

   ```powershell
   npm run dev
   ```

4. Abre la dirección mostrada en la terminal, normalmente `http://localhost:5173`.

## Controles de juego

- `WASD` o flechas: mover al personaje.
- `Shift`: correr.
- `Espacio`: saltar.
- `Ctrl`: agacharse.
- Clic en el escenario: activar control de cámara con ratón.
- `E`: recoger objetos, activar paneles, leer o cerrar una nota.
- `F`: encender y apagar la linterna.
- `L`: alternar entre haz cercano y haz de largo alcance.
- `M`: abrir la mochila o el mapa.
- `G`: disparar el rifle.
- `R`: recargar el rifle.
- `H`: usar un botiquín.
- `K`: usar el cuchillo.
- `P`: pausar o reanudar la partida.
- `Esc`: cerrar el mapa o la mochila.
- `Ctrl + A`: guardar la partida localmente.

## Cómo jugar

Sigue el objetivo mostrado en pantalla y los marcadores del mapa. Los objetos de misión emiten luz y se activan al acercarte y pulsar `E`.

La historia tiene seis capítulos: la cabaña, la estación de bombeo, las señales falsas, Valleverde, la caverna bajo el río y el rescate de Daniel. El progreso y el inventario se guardan localmente en el navegador.

## Compilación de producción

```powershell
npm run build
```

Los archivos generados quedan en `dist/`.

## Guardado

La partida se guarda localmente en el navegador mediante `localStorage`. No requiere servidor ni base de datos.

## Documentación Del Juego

- [Capítulos actuales y objetivos](./CAPITULOS_ACTUALES.md)
- [Historia completa](./HISTORIA_DEL_JUEGO.md)
