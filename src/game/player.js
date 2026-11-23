import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

export function createPlayer(scene, canvas) {
  const camera = new UniversalCamera("player", new Vector3(0, 1.7, -1.5), scene);
  camera.setTarget(new Vector3(0, 1.7, 3));
  camera.attachControl(canvas, true);
  camera.angularSensibility = 3800;
  camera.minZ = .1;
  camera.inputs.removeByType("FreeCameraKeyboardMoveInput");
  return { camera, velocity: new Vector3(), verticalVelocity: 0, crouching: false, onGround: true, upstairs: false, bob: 0 };
}

function isBlocked(position, obstacles) {
  return obstacles.some(({ x, z, radius, halfX, halfZ }) => radius ? Math.abs(position.x - x) < radius && Math.abs(position.z - z) < radius : Math.abs(position.x - x) < halfX && Math.abs(position.z - z) < halfZ);
}

export function updatePlayer(player, input, delta, world) {
  const { camera } = player;
  const forward = camera.getDirection(Vector3.Forward());
  const right = camera.getDirection(Vector3.Right());
  forward.y = 0; right.y = 0; forward.normalize(); right.normalize();
  const direction = forward.scale(input.forward - input.back).add(right.scale(input.right - input.left));
  if (direction.lengthSquared() > 0) direction.normalize();
  player.crouching = input.crouch;
  const targetSpeed = player.crouching ? 2 : input.run ? 8.7 : 5.7;
  const smoothing = direction.lengthSquared() ? 12 : 9;
  player.velocity.x += (direction.x * targetSpeed - player.velocity.x) * Math.min(1, smoothing * delta);
  player.velocity.z += (direction.z * targetSpeed - player.velocity.z) * Math.min(1, smoothing * delta);
  if (input.jump && player.onGround && !player.crouching) { player.verticalVelocity = 5.2; player.onGround = false; }
  player.verticalVelocity -= 13 * delta;
  const next = camera.position.add(new Vector3(player.velocity.x * delta, 0, player.velocity.z * delta));
  if (!isBlocked(next, world.obstacles)) camera.position.copyFrom(next);
  if (!player.upstairs && world.stairs?.some(({ x, z, halfX, halfZ }) => Math.abs(next.x - x) < halfX && Math.abs(next.z - z) < halfZ)) player.upstairs = true;
  const ground = world.groundHeight ? world.groundHeight(camera.position.x, camera.position.z, player.upstairs) : world.terrainHeight(camera.position.x, camera.position.z);
  const height = player.crouching ? 1.15 : 1.7;
  camera.position.y += player.verticalVelocity * delta;
  if (camera.position.y <= ground + height) { camera.position.y = ground + height; player.verticalVelocity = 0; player.onGround = true; }
  const moving = Math.abs(player.velocity.x) + Math.abs(player.velocity.z) > .25 && player.onGround;
  player.bob += moving ? delta * (input.run ? 13 : 9) : 0;
  camera.cameraDirection.y = moving ? Math.sin(player.bob) * .0012 : 0;
}
