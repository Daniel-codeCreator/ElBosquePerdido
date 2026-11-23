import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexBuffer } from "@babylonjs/core/Meshes/buffer";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PointLight } from "@babylonjs/core/Lights/pointLight";

function mat(scene, name, color, emissive) { const value = new StandardMaterial(name, scene); value.diffuseColor = Color3.FromHexString(color); value.specularColor = Color3.Black(); if (emissive) value.emissiveColor = Color3.FromHexString(emissive); return value; }
export function terrainHeight(x, z) { if (Math.abs(x) < 7 && z > -15 && z < 8) return 0; return Math.sin(x * .11) * .65 + Math.cos(z * .09) * .5; }

export function buildWorld(scene, quality = "high") {
  const obstacles = []; const pickups = []; const density = quality === "low" ? 115 : 230;
  const ground = MeshBuilder.CreateGround("forest terrain", { width: 160, height: 160, subdivisions: 72 }, scene);
  const positions = ground.getVerticesData(VertexBuffer.PositionKind);
  for (let i = 0; i < positions.length; i += 3) positions[i + 1] = terrainHeight(positions[i], positions[i + 2]);
  ground.updateVerticesData(VertexBuffer.PositionKind, positions); ground.material = mat(scene, "mossy ground", "#213421");
  const path = MeshBuilder.CreateGround("old path", { width: 5, height: 70, subdivisions: 1 }, scene); path.position.z = -35; path.material = mat(scene, "path", "#403728");
  const trunk = mat(scene, "trunks", "#241a12"); const needles = mat(scene, "needles", "#173b23"); const rockMat = mat(scene, "rocks", "#42504a"); const bushMat = mat(scene, "bushes", "#315333");
  const treeSource = MeshBuilder.CreateCylinder("tree source", { height: 7, diameter: .55 }, scene); treeSource.material = trunk; treeSource.position.y = -1000;
  const crownSource = MeshBuilder.CreateCylinder("crown source", { height: 6, diameterTop: 0, diameterBottom: 4.3 }, scene); crownSource.material = needles; crownSource.position.y = -1000;
  for (let i = 0; i < density; i++) {
    const x = ((i * 47) % 150) - 75; const z = ((i * 79) % 150) - 75;
    if ((Math.abs(x) < 9 && z > -17 && z < 10) || Math.abs(x) < 3 && z < 2 && z > -70) continue;
    const scale = .7 + (i % 6) * .12; const base = terrainHeight(x, z); const tree = treeSource.createInstance(`tree-${i}`); tree.position.set(x, base + 3.5 * scale, z); tree.scaling.setAll(scale); const crown = crownSource.createInstance(`crown-${i}`); crown.position.set(x, base + 7.5 * scale, z); crown.scaling.setAll(scale); if (i % 3 === 0) obstacles.push({ x, z, radius: .65 * scale });
    if (i % 4 === 0) { const bush = MeshBuilder.CreateSphere(`bush-${i}`, { diameter: 1.1 + (i % 3) * .3, segments: 6 }, scene); bush.position.set(x + 1.5, base + .45, z - 1); bush.material = bushMat; }
  }
  for (let i = 0; i < 36; i++) { const x = ((i * 19) % 120) - 60; const z = ((i * 29) % 120) - 60; const rock = MeshBuilder.CreateSphere(`rock-${i}`, { diameter: 1 + (i % 4) * .45, segments: 6 }, scene); rock.position.set(x, terrainHeight(x, z) + .35, z); rock.scaling.y = .65; rock.material = rockMat; obstacles.push({ x, z, radius: .7 }); }
  const log = MeshBuilder.CreateCylinder("fallen log", { height: 5, diameter: .45 }, scene); log.rotation.z = Math.PI / 2; log.position.set(-11, terrainHeight(-11, -10) + .4, -10); log.material = trunk; obstacles.push({ x: -11, z: -10, radius: 1.8 });
  createCabin(scene, obstacles); createSky(scene, quality);
  pickups.push(createPickup(scene, "note-1", "note", new Vector3(1.6, 1.3, -.4), "Nota sobre la mesa", "Encontraste una nota de Daniel.", "La primera noche escuché a alguien gritar mi nombre desde el río. Seguí la voz hasta la niebla... y entonces me respondió desde detrás de mí.\n\nNo sigas mi voz. Si regreso a esta cabaña, busca el vehículo."));
  pickups.push(createPickup(scene, "battery-cabin", "battery", new Vector3(-1.5, 1.1, -.4), "Batería sobre el estante", "Encontraste una batería de linterna."), createPickup(scene, "wood-1", "wood", new Vector3(5, .5, -5), "Leña junto al sendero", "Recogiste leña."), createPickup(scene, "wood-2", "wood", new Vector3(-6, terrainHeight(-6, -7) + .4, -7), "Tronco seco", "Recogiste leña."), createPickup(scene, "berries-1", "berries", new Vector3(8, terrainHeight(8, -8) + .5, -8), "Frutas silvestres", "Recogiste frutas silvestres."), createPickup(scene, "berries-2", "berries", new Vector3(-13, terrainHeight(-13, -18) + .5, -18), "Frutas silvestres", "Recogiste frutas silvestres."), createPickup(scene, "battery-forest", "battery", new Vector3(-9, terrainHeight(-9, -16) + .6, -16), "Batería abandonada", "Encontraste una batería de linterna."), createPickup(scene, "note-2", "note", new Vector3(-1.3, 1.25, -12), "Nota junto al vehículo", "Encontraste otra nota.", "La cosa escucha los pasos y aprende las voces. La carretera no es segura, pero hay una luz al norte.\n\nDaniel"));
  return { pickups, obstacles, terrainHeight };
}

function createCabin(scene, obstacles) { const cabin = mat(scene, "cabin", "#4d3c28", "#100904"); const floor = MeshBuilder.CreateBox("cabin floor", { width: 8, height: .18, depth: 7 }, scene); floor.position.y = .1; floor.material = mat(scene, "floor", "#342a1d", "#090604"); new PointLight("cabin lamp", new Vector3(0, 3.3, .8), scene).intensity = 1.4; [[-4, 0, .35, 3.5], [4, 0, .35, 3.5], [0, 3.5, 4, .25], [-2.8, -3.5, 1.2, .25], [2.8, -3.5, 1.2, .25]].forEach(([x,z,halfX,halfZ], i) => { const wall = MeshBuilder.CreateBox(`wall-${i}`, { width: halfX * 2, height: 4, depth: halfZ * 2 }, scene); wall.position.set(x,2,z); wall.material=cabin; obstacles.push({x,z,halfX,halfZ}); }); const roof = MeshBuilder.CreateBox("roof", {width:8.5,height:.25,depth:7.5},scene); roof.position.y=4.2; roof.material=mat(scene,"roof","#16120e"); const table=MeshBuilder.CreateBox("table",{width:1.8,height:1.1,depth:.9},scene);table.position.set(1.6,.55,-.4);table.material=mat(scene,"table","#4a3824"); const car=MeshBuilder.CreateBox("vehicle",{width:2.4,height:1.15,depth:4.4},scene);car.position.set(0,.65,-12);car.material=mat(scene,"vehicle","#27312d"); obstacles.push({x:0,z:-12,radius:1.4}); }
function createSky(scene, quality) { const moon=MeshBuilder.CreateSphere("moon",{diameter:5,segments:16},scene);moon.position.set(26,25,-52);moon.material=mat(scene,"moon mat","#d6dbc4","#d6dbc4"); const stars=mat(scene,"stars","#e8f1dc","#e8f1dc"); for(let i=0;i<(quality==="low"?70:180);i++){const a=i*2.399,r=65+i%17,s=MeshBuilder.CreateSphere(`star-${i}`,{diameter:.1,segments:4},scene);s.position.set(Math.cos(a)*r,11+(i*13)%30,Math.sin(a)*r);s.material=stars;} }
export function createPickup(scene,id,type,position,label,message,noteText="") {
  const colors = { note: ["#e7dcba", "#6f5b32"], wood: ["#714624", "#24130a"], berries: ["#b5353d", "#4b0810"], battery: ["#d7b83d", "#5d4800"] };
  let mesh;
  if (type === "note") { mesh = MeshBuilder.CreateBox(id, { width: .55, height: .05, depth: .72 }, scene); }
  else if (type === "wood") { mesh = MeshBuilder.CreateCylinder(id, { height: 1.1, diameter: .26, tessellation: 8 }, scene); mesh.rotation.z = Math.PI / 2; }
  else if (type === "battery") { mesh = MeshBuilder.CreateBox(id, { width: .34, height: .72, depth: .34 }, scene); }
  else { mesh = MeshBuilder.CreateSphere(id, { diameter: .42, segments: 8 }, scene); for (let i = 0; i < 4; i++) { const fruit = MeshBuilder.CreateSphere(`${id}-fruit-${i}`, { diameter: .26, segments: 6 }, scene); fruit.parent = mesh; fruit.position.set(Math.cos(i * 1.57) * .24, .1, Math.sin(i * 1.57) * .24); fruit.material = mat(scene, `${id}-fruit-mat-${i}`, "#cc3943", "#350306"); } }
  mesh.position = position; mesh.material = mat(scene, `${id}-mat`, colors[type][0], colors[type][1]); mesh.metadata = { id, type, label, message, noteText }; return mesh;
}
