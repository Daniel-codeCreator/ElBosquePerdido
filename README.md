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
- `C`: agacharse.
- Clic en el escenario: activar control de cámara con ratón.
- `E`: recoger objetos, activar paneles, leer o cerrar una nota.
- `F`: encender y apagar la linterna.
- `L`: alternar entre haz cercano y haz de largo alcance.
- `Q`: activar o desactivar los binoculares de visión nocturna cuando se hayan encontrado. Apagan temporalmente la linterna y restauran su estado al salir.
- `M`: abrir o cerrar la mochila.
- `J`: alternar entre las armas encontradas. El arma equipada se muestra abajo a la derecha.
- `G`: atacar con el arma equipada: dispara el rifle o usa el cuchillo.
- `R`: con el rifle vacío, consume un cargador y carga sus tres balas.
- `H`: usar un botiquín.
- Los botones `USAR` de la mochila consumen vendas, comida, agua, bayas y baterías.
- `E` junto a una fogata: enciende con una leña; una vez encendida permite descansar y calentar una conserva.
- Cada cargador de rifle contiene exactamente tres balas; no hay munición suelta en la mochila.
- Ciervos y zorros se pueden cazar: un tiro de rifle o cinco golpes de cuchillo dejan carne cruda. Cocínala en una fogata encendida antes de usarla.
- Las trampas visibles inmovilizan: corta la cuerda con cuchillo o pulsa `E` y completa `Arriba, Derecha, Abajo, Izquierda` antes de que termine el tiempo.
- `P`: pausar o reanudar la partida.
- `Esc`: cerrar el mapa o la mochila.
- `Ctrl + A`: guardar la partida localmente.

## Cómo jugar

Sigue el objetivo mostrado en pantalla y los marcadores del mapa. Los objetos de misión emiten luz y se activan al acercarte y pulsar `E`.

La cabaña inicial es un refugio elevado con escalera, cama, radio, estantes y telescopio. La linterna se recoge junto a la cama; el telescopio es una observación opcional que añade una entrada de bitácora sin cambiar la misión.

La historia tiene seis capítulos: la cabaña, la estación de bombeo, las señales falsas, Valleverde, la caverna bajo el río y el rescate de Daniel. El progreso y el inventario se guardan localmente en el navegador.

La supervivencia es deliberadamente suave: una barra completa de saciedad dura 40 minutos por defecto. La comida no se consume si la saciedad está llena; queda guardada. La carne cocinada recupera mucho y ralentiza temporalmente el hambre. El receptor de campo (cable + herramienta) y la caja del cazador (llave) son rompecabezas opcionales y no bloquean los seis capítulos.

## Ajuste De Supervivencia

Los valores de equilibrio están centralizados en `src/game/config.js`: `flashlight.batteryDurationSeconds` (1500 segundos, 25 minutos con haz normal), `flashlight.longBeamDrainMultiplier`, `hunger.fullDurationSeconds` (2400 segundos, 40 minutos) y el beneficio de carne cocinada.

Las balizas de Capítulo III son postes luminosos altos en las coordenadas exactas del marcador y permanecen activos mientras su señal sea la misión actual. Las partidas guardadas en `signal-1`, `signal-2` o `signal-3` recuperan el transmisor actual si estaba marcado erróneamente como recogido.

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
- [Guía de audio y licencias](./AUDIO_ASSETS.md)
