import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

export function createPlayer(scene, canvas) {
  const camera = new UniversalCamera("player", new Vector3(0, 1.7, 1.5), scene);
  camera.rotation.y = Math.PI;
  camera.attachControl(canvas, true);
  camera.speed = 0.28;
  camera.angularSensibility = 3600;
  camera.minZ = 0.1;
  // The first playable slice uses direct movement; physics is added with the survival world.
  camera.applyGravity = false;
  camera.checkCollisions = false;
  camera.keysUp = [87, 38];
  camera.keysDown = [83, 40];
  camera.keysLeft = [65, 37];
  camera.keysRight = [68, 39];
  // Movement is handled in main.js so keyboard focus is not tied to the canvas.
  camera.inputs.removeByType("FreeCameraKeyboardMoveInput");
  return camera;
}
