import "./ui/styles.css";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { SpotLight } from "@babylonjs/core/Lights/spotLight";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
import { createPlayer } from "./game/player.js";
import { buildWorld, createPickup } from "./game/world.js";
import { addItem, inventoryWeight, renderInventory, renderJournal } from "./game/inventory.js";
import { loadGame, saveGame } from "./game/save.js";

const canvas = document.querySelector("#render-canvas");
const engine = new Engine(canvas, true, { stencil: true });
const state = { inventory: {}, journal: ["La cabaña de vigilancia sigue en pie. Daniel dejó algo sobre la mesa."], collected: [], documents: [], health: 100, energy: 100, hunger: 8, flashlight: true };
const stored = loadGame();
if (stored) Object.assign(state, stored);
let nearest = null;
let noteOpen = false;
const pressedKeys = new Set();

const scene = new Scene(engine);
scene.clearColor = new Color4(0.055, 0.12, 0.09, 1);
scene.fogMode = Scene.FOGMODE_EXP2;
scene.fogDensity = 0.025;
scene.fogColor = new Color3(0.055, 0.12, 0.08);
new HemisphericLight("moon", new Vector3(.2, 1, .1), scene).intensity = .55;
const moon = new DirectionalLight("moonlight", new Vector3(-.45, -1, .25), scene); moon.position = new Vector3(20, 35, -20); moon.intensity = .7;
new GlowLayer("atmosphere", scene).intensity = .35;
const player = createPlayer(scene, canvas);
const flashlight = new SpotLight("flashlight", new Vector3(0, -.1, 0), new Vector3(0, 0, 1), Math.PI / 3, 2, scene);
flashlight.parent = player;
flashlight.intensity = 12;
flashlight.diffuse = new Color3(1, .84, .58);
const flashlightGlow = new PointLight("flashlight glow", new Vector3(0, 0, .2), scene);
flashlightGlow.parent = player;
flashlightGlow.diffuse = new Color3(1, .72, .4);
flashlightGlow.range = 4;
flashlightGlow.intensity = .45;
flashlight.setEnabled(state.flashlight);
flashlightGlow.setEnabled(state.flashlight);
const interactables = buildWorld(scene).filter((mesh) => !state.collected.includes(mesh.metadata.id));
interactables.forEach((mesh) => { if (state.collected.includes(mesh.metadata.id)) mesh.dispose(); });

function toast(text) { const el = document.querySelector("#toast"); el.textContent = text; el.classList.add("show"); setTimeout(() => el.classList.remove("show"), 3600); }
function updateVitals() { ["health", "energy", "hunger"].forEach((key) => document.querySelector(`#${key}-bar`).style.width = `${state[key]}%`); }
function updateNearby() { nearest = null; let distance = 3.1; interactables.forEach((mesh) => { if (!mesh.isDisposed()) { const current = Vector3.Distance(player.position, mesh.position); if (current < distance) { nearest = mesh; distance = current; } } }); const prompt = document.querySelector("#interaction"); prompt.textContent = nearest ? `[E] ${nearest.metadata.label}` : ""; prompt.classList.toggle("show", Boolean(nearest)); }
function validPosition(position) {
  const inVerticalWall = Math.abs(Math.abs(position.x) - 4) < .28 && position.z > -3.55 && position.z < 3.55;
  const inBackWall = Math.abs(position.z - 3.5) < .28 && Math.abs(position.x) < 4;
  const inFrontWall = Math.abs(position.z + 3.5) < .28 && Math.abs(position.x) > 1.25 && Math.abs(position.x) < 4;
  return !inVerticalWall && !inBackWall && !inFrontWall;
}
function attemptMove(direction) {
  const candidate = player.position.add(direction);
  if (Math.abs(candidate.x) > 72 || Math.abs(candidate.z) > 72) { player.position.set(0, 1.7, 1.5); toast("MAPA EN DESARROLLO. Regresaste a la cabaña."); return; }
  if (validPosition(candidate)) player.position.copyFrom(candidate);
}
function dropPosition() { const forward = player.getDirection(Vector3.Forward()); forward.y = 0; forward.normalize(); return player.position.add(forward.scale(1.25)); }
function dropItem(type, label, noteText = "") { const id = `dropped-${type}-${Date.now()}`; const position = dropPosition(); position.y = type === "note" ? 1.1 : .4; const pickup = createPickup(scene, id, type, position, label, "Recuperaste el objeto descartado.", noteText); interactables.push(pickup); }
function showNote(text, title = "Nota de Daniel") { noteOpen = true; document.exitPointerLock?.(); document.querySelector("#note-title").textContent = title; document.querySelector("#note-content").innerHTML = text.split("\n\n").map((paragraph) => `<p>${paragraph}</p>`).join(""); document.querySelector("#note-modal").hidden = false; }
function closeNote() { noteOpen = false; document.querySelector("#note-modal").hidden = true; canvas.requestPointerLock?.(); }
function toggleFlashlight() { state.flashlight = !state.flashlight; flashlight.setEnabled(state.flashlight); flashlightGlow.setEnabled(state.flashlight); const button = document.querySelector("#flashlight-button"); button.textContent = `LINTERNA: ${state.flashlight ? "ON" : "OFF"}`; button.classList.toggle("active", state.flashlight); }
function openBackpack() { document.exitPointerLock?.(); document.querySelector("#inventory").classList.add("open"); }
function closeBackpack() { document.querySelector("#inventory").classList.remove("open"); }
function saveCurrentGame() { saveGame(state); toast("Partida guardada en este dispositivo."); }
function updateMinimap() {
  const clamp = (value) => Math.max(8, Math.min(92, value));
  const marker = document.querySelector("#player-marker");
  marker.style.left = `${clamp(50 + player.position.x * 1.4)}%`;
  marker.style.top = `${clamp(50 + player.position.z * 1.4)}%`;
}
function interact() { if (!nearest || noteOpen) return; if (inventoryWeight(state) >= 12) return toast("La mochila está llena. No puedes cargar más objetos."); const { id, type, label, message, noteText } = nearest.metadata; addItem(state, type); state.collected.push(id); if (type === "note") { state.documents.push({ id, title: label, text: noteText }); state.journal.push("Encontraste una nota de Daniel."); document.querySelector("#objective").textContent = "Sal de la cabaña y sigue las pistas hacia el vehículo."; showNote(noteText, label); } nearest.dispose(); nearest = null; renderInventory(state); renderJournal(state); saveGame(state); toast(message); }
function discardItem(type) { if (!state.inventory[type]) return; const label = type === "wood" ? "Ramas secas" : "Bayas oscuras"; state.inventory[type]--; if (!state.inventory[type]) delete state.inventory[type]; dropItem(type, label); renderInventory(state); saveGame(state); toast("El objeto quedó en el suelo junto a ti."); }
function discardNote(id) { const index = state.documents.findIndex((document) => document.id === id); if (index < 0) return; const [document] = state.documents.splice(index, 1); state.inventory.note--; if (!state.inventory.note) delete state.inventory.note; dropItem("note", document.title, document.text); renderInventory(state); saveGame(state); toast("La nota quedó en el suelo junto a ti."); }
function moveTouch(direction) { const forward = player.getDirection(Vector3.Forward()); forward.y = 0; forward.normalize(); const right = player.getDirection(Vector3.Right()); right.y = 0; right.normalize(); const amount = .6; if (direction === "forward") attemptMove(forward.scale(amount)); if (direction === "back") attemptMove(forward.scale(-amount)); if (direction === "left") attemptMove(right.scale(-amount)); if (direction === "right") attemptMove(right.scale(amount)); }
function moveKeyboard() {
  const forward = player.getDirection(Vector3.Forward());
  const right = player.getDirection(Vector3.Right());
  forward.y = 0; right.y = 0; forward.normalize(); right.normalize();
  const amount = engine.getDeltaTime() * 0.0045;
  if (pressedKeys.has("KeyW") || pressedKeys.has("ArrowUp")) attemptMove(forward.scale(amount));
  if (pressedKeys.has("KeyS") || pressedKeys.has("ArrowDown")) attemptMove(forward.scale(-amount));
  if (pressedKeys.has("KeyA") || pressedKeys.has("ArrowLeft")) attemptMove(right.scale(-amount));
  if (pressedKeys.has("KeyD") || pressedKeys.has("ArrowRight")) attemptMove(right.scale(amount));
}

renderInventory(state); renderJournal(state); updateVitals();
document.querySelector("#start-button").addEventListener("click", () => document.querySelector("#intro").classList.add("hidden"));
canvas.addEventListener("click", () => { if (!noteOpen && !document.querySelector("#inventory").classList.contains("open")) canvas.requestPointerLock?.(); });
document.querySelector("#save-button").addEventListener("click", saveCurrentGame);
document.querySelector("#flashlight-button").addEventListener("click", toggleFlashlight);
document.querySelector("#backpack-button").addEventListener("click", openBackpack);
document.querySelector("#close-backpack").addEventListener("click", closeBackpack);
document.querySelector("#close-note").addEventListener("click", closeNote);
document.querySelector("#items").addEventListener("click", (event) => { const read = event.target.closest("[data-read-note]"); const deleteNote = event.target.closest("[data-delete-note]"); const deleteItem = event.target.closest("[data-delete-item]"); if (read) { const document = state.documents.find((entry) => entry.id === read.dataset.readNote); if (document) showNote(document.text, document.title); } if (deleteNote) discardNote(deleteNote.dataset.deleteNote); if (deleteItem) discardItem(deleteItem.dataset.deleteItem); });
document.querySelector("#touch-interact").addEventListener("click", interact);
document.querySelectorAll("[data-move]").forEach((button) => { button.addEventListener("pointerdown", () => moveTouch(button.dataset.move)); });
window.addEventListener("keydown", (event) => { if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault(); if (event.ctrlKey && event.code === "KeyA") { event.preventDefault(); saveCurrentGame(); return; } pressedKeys.add(event.code); if (event.code === "KeyE") noteOpen ? closeNote() : interact(); if (event.code === "KeyM" && !event.repeat) openBackpack(); if ((event.code === "KeyF" || event.code === "Space") && !noteOpen && !event.repeat) toggleFlashlight(); });
window.addEventListener("keyup", (event) => pressedKeys.delete(event.code));
window.addEventListener("blur", () => pressedKeys.clear());
scene.onBeforeRenderObservable.add(() => { try { if (!noteOpen) moveKeyboard(); updateNearby(); updateMinimap(); state.energy = Math.max(10, state.energy - engine.getDeltaTime() / 120000); state.hunger = Math.min(100, state.hunger + engine.getDeltaTime() / 180000); updateVitals(); } catch (error) { console.error(error); document.querySelector("#objective").textContent = `Error de escena: ${error.message}`; } });
engine.runRenderLoop(() => scene.render());
window.addEventListener("resize", () => engine.resize());
