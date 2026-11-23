import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PointLight } from "@babylonjs/core/Lights/pointLight";

function material(scene, name, color, emissive = null) {
  const mat = new StandardMaterial(name, scene); mat.diffuseColor = Color3.FromHexString(color); mat.specularColor = Color3.Black(); if (emissive) mat.emissiveColor = Color3.FromHexString(emissive); return mat;
}
function collider(mesh) { mesh.checkCollisions = true; return mesh; }

export function buildWorld(scene) {
  const ground = MeshBuilder.CreateGround("forest floor", { width: 180, height: 180, subdivisions: 2 }, scene);
  ground.material = material(scene, "ground", "#1a281b"); collider(ground);
  const moon = MeshBuilder.CreateSphere("moon", { diameter: 5, segments: 16 }, scene); moon.position.set(26, 25, -52); moon.material = material(scene, "moon material", "#d6dbc4", "#d6dbc4");
  const starMaterial = material(scene, "star material", "#e8f1dc", "#e8f1dc");
  for (let i = 0; i < 180; i++) { const angle = i * 2.399; const radius = 65 + (i % 17); const star = MeshBuilder.CreateSphere(`star-${i}`, { diameter: .08 + (i % 4) * .025, segments: 4 }, scene); star.position.set(Math.cos(angle) * radius, 11 + ((i * 13) % 30), Math.sin(angle) * radius); star.material = starMaterial; }
  const trunk = material(scene, "trunk", "#17130f"); const foliage = material(scene, "foliage", "#102619");
  for (let i = 0; i < 145; i++) {
    const x = ((i * 37) % 150) - 75; const z = ((i * 61) % 150) - 75;
    if (Math.abs(x) < 10 && z > -14 && z < 10) continue;
    const height = 5 + (i % 4) * 1.4;
    const t = MeshBuilder.CreateCylinder(`tree-trunk-${i}`, { height, diameter: 0.45 }, scene); t.position.set(x, height / 2, z); t.material = trunk;
    const crown = MeshBuilder.CreateCylinder(`tree-crown-${i}`, { height: height * .9, diameterTop: 0, diameterBottom: 3.8 }, scene); crown.position.set(x, height + height * .3, z); crown.material = foliage;
  }
  const cabin = material(scene, "cabin", "#4d3c28"); cabin.emissiveColor = Color3.FromHexString("#120c06");
  const floor = MeshBuilder.CreateBox("cabin floor", { width: 8, height: .18, depth: 7 }, scene); floor.position.set(0, .1, 0); floor.material = material(scene, "floor", "#342a1d", "#080603");
  const cabinLamp = new PointLight("cabin lamp", new Vector3(0, 3.3, .8), scene); cabinLamp.diffuse = Color3.FromHexString("#e8b768"); cabinLamp.intensity = 1.5; cabinLamp.range = 14;
  [[-4, 2, 0, .25, 4, 7], [4, 2, 0, .25, 4, 7], [0, 2, 3.5, 8, 4, .25], [-2.8, 2, -3.5, 2.4, 4, .25], [2.8, 2, -3.5, 2.4, 4, .25]].forEach(([x, y, z, width, height, depth], index) => { const wall = MeshBuilder.CreateBox(`cabin wall ${index}`, { width, height, depth }, scene); wall.position.set(x, y, z); wall.material = cabin; });
  const roof = MeshBuilder.CreateBox("cabin roof", { width: 8.5, height: .25, depth: 7.5 }, scene); roof.position.set(0, 4.2, 0); roof.material = material(scene, "roof", "#16120e");
  const table = MeshBuilder.CreateBox("cabin table", { width: 1.8, height: 1.1, depth: .9 }, scene); table.position.set(1.6, .55, -.4); table.material = material(scene, "table", "#4a3824");
  const car = MeshBuilder.CreateBox("daniel vehicle", { width: 2.4, height: 1.15, depth: 4.4 }, scene); car.position.set(0, .65, -12); car.material = material(scene, "vehicle", "#202825");
  const cabinLight = MeshBuilder.CreateSphere("cabin light", { diameter: .32 }, scene); cabinLight.position.set(-2.5, 2.5, 3.25); cabinLight.material = material(scene, "warm window", "#432a12", "#d87921");
  return [
    createPickup(scene, "note-1", "note", new Vector3(1.6, 1.3, -.4), "Nota sobre la mesa", "Encontraste una nota de Daniel.", "La primera noche escuché a alguien gritar mi nombre desde el río. Seguí la voz hasta la niebla... y entonces me respondió desde detrás de mí.\n\nNo sigas mi voz. Si regreso a esta cabaña, busca el vehículo."),
    createPickup(scene, "wood-1", "wood", new Vector3(5, .45, -4), "Ramas secas", "Recogiste madera."),
    createPickup(scene, "wood-2", "wood", new Vector3(-7, .45, -5), "Ramas secas", "Recogiste madera."),
    createPickup(scene, "berries-1", "berries", new Vector3(8, .4, -8), "Bayas oscuras", "Recogiste bayas."),
    createPickup(scene, "note-2", "note", new Vector3(-1.3, 1.25, -12), "Nota junto al vehículo", "Encontraste otra nota.", "La cosa escucha los pasos y aprende las voces. La carretera no es segura, pero hay una luz al norte.\n\nDaniel")
  ];
}

export function createPickup(scene, id, type, position, label, message, noteText = "") {
  const mesh = MeshBuilder.CreateSphere(id, { diameter: type === "note" ? .45 : .7, segments: 8 }, scene); mesh.position = position;
  mesh.material = material(scene, `${id}-material`, type === "note" ? "#c9b98b" : type === "berries" ? "#682c39" : "#6f573a", type === "note" ? "#3d3524" : null);
  mesh.metadata = { id, type, label, message, noteText }; return mesh;
}
