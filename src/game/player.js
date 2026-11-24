import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

export const velocidadesMovimiento = {
  caminar: 6.3,
  correr: 9.7,
  agachado: 2,
};

// Crea y configura la cámara que representa al jugador.
export function crearJugador(escena, lienzo) {
  const camara = new UniversalCamera(
    "player",
    new Vector3(0, 1.7, -1.5),
    escena,
  );
  camara.setTarget(new Vector3(0, 1.7, 3));
  camara.attachControl(lienzo, true);
  camara.angularSensibility = 3800;
  camara.minZ = 0.1;
  camara.inputs.removeByType("FreeCameraKeyboardMoveInput");
  return {
    camera: camara,
    velocity: new Vector3(),
    verticalVelocity: 0,
    crouching: false,
    onGround: true,
    upstairs: false,
    bob: 0,
  };
}

// Indica si una posición choca con un obstáculo del mundo.
function estaBloqueado(posicion, obstaculos) {
  return obstaculos.some(({ x, z, radius, halfX, halfZ }) =>
    radius
      ? Math.abs(posicion.x - x) < radius && Math.abs(posicion.z - z) < radius
      : Math.abs(posicion.x - x) < halfX && Math.abs(posicion.z - z) < halfZ,
  );
}

// Actualiza movimiento, colisiones, salto y balanceo del jugador.
export function actualizarJugador(jugador, entrada, delta, mundo) {
  const { camera: camara } = jugador;
  const adelante = camara.getDirection(Vector3.Forward());
  const derecha = camara.getDirection(Vector3.Right());
  adelante.y = 0;
  derecha.y = 0;
  adelante.normalize();
  derecha.normalize();
  const direccion = adelante
    .scale(entrada.forward - entrada.back)
    .add(derecha.scale(entrada.right - entrada.left));
  if (direccion.lengthSquared() > 0) direccion.normalize();
  jugador.crouching = entrada.crouch;
  const velocidadObjetivo = jugador.crouching
    ? velocidadesMovimiento.agachado
    : entrada.run
      ? velocidadesMovimiento.correr
      : velocidadesMovimiento.caminar;
  const suavizado = direccion.lengthSquared() ? 12 : 9;
  jugador.velocity.x +=
    (direccion.x * velocidadObjetivo - jugador.velocity.x) *
    Math.min(1, suavizado * delta);
  jugador.velocity.z +=
    (direccion.z * velocidadObjetivo - jugador.velocity.z) *
    Math.min(1, suavizado * delta);
  if (entrada.jump && jugador.onGround && !jugador.crouching) {
    jugador.verticalVelocity = 5.2;
    jugador.onGround = false;
  }
  jugador.verticalVelocity -= 13 * delta;
  const siguiente = camara.position.add(
    new Vector3(jugador.velocity.x * delta, 0, jugador.velocity.z * delta),
  );
  if (!estaBloqueado(siguiente, mundo.obstacles)) camara.position.copyFrom(siguiente);
  const escalera = mundo.stairs?.find(
    ({ x, z, halfX, halfZ }) =>
      Math.abs(siguiente.x - x) < halfX && Math.abs(siguiente.z - z) < halfZ,
  );
  if (escalera) {
    const progreso = Math.max(
      0,
      Math.min(1, (escalera.startZ - siguiente.z) / (escalera.startZ - escalera.endZ)),
    );
    jugador.upstairs = progreso > 0.12;
  }
  const suelo = mundo.groundHeight
    ? mundo.groundHeight(camara.position.x, camara.position.z, jugador.upstairs)
    : mundo.alturaTerreno(camara.position.x, camara.position.z);
  const altura = jugador.crouching ? 1.15 : 1.7;
  camara.position.y += jugador.verticalVelocity * delta;
  if (camara.position.y <= suelo + altura) {
    camara.position.y = suelo + altura;
    jugador.verticalVelocity = 0;
    jugador.onGround = true;
  }
  const moviendose =
    Math.abs(jugador.velocity.x) + Math.abs(jugador.velocity.z) > 0.25 &&
    jugador.onGround;
  jugador.bob += moviendose ? delta * (entrada.run ? 13 : 9) : 0;
  camara.cameraDirection.y = moviendose ? Math.sin(jugador.bob) * 0.0012 : 0;
}
