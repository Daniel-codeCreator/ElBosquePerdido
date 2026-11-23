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

## Controles

- `WASD` o flechas: mover al personaje.
- Clic en el escenario: activar control de cámara con ratón.
- `E`: recoger objetos, leer o cerrar una nota.
- `Espacio` o `F`: encender y apagar la linterna.
- `M`: abrir la mochila.
- `Ctrl + A`: guardar la partida localmente.

## Compilación de producción

```powershell
npm run build
```

Los archivos generados quedan en `dist/`.

## Guardado

La partida se guarda localmente en el navegador mediante `localStorage`. No requiere servidor ni base de datos.
