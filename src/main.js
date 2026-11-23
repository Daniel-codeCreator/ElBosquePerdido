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
import { createPlayer, updatePlayer } from "./game/player.js";
import { buildWorld, createPickup } from "./game/world.js";
import { addItem, inventoryWeight, renderInventory, renderJournal } from "./game/inventory.js";
import { loadGame, saveGame } from "./game/save.js";

const canvas = document.querySelector("#render-canvas");
const engine = new Engine(canvas, true, { stencil: true });
const state = { inventory: {}, journal: ["La cabaña de vigilancia sigue en pie. Daniel dejó algo sobre la mesa."], collected: [], documents: [], health: 100, energy: 100, hunger: 70, flashlight: true, battery: 100, settings: { quality: "high" } };
const stored = loadGame();
if (stored) Object.assign(state, stored);
let nearest = null;
let noteOpen = false;
const pressedKeys = new Set();
const touchInput = { forward: 0, back: 0, left: 0, right: 0, run: false, crouch: false, jump: false };

const scene = new Scene(engine);
scene.clearColor = new Color4(0.055, 0.12, 0.09, 1);
scene.fogMode = Scene.FOGMODE_EXP2;
scene.fogDensity = 0.025;
scene.fogColor = new Color3(0.055, 0.12, 0.08);
new HemisphericLight("moon", new Vector3(.2, 1, .1), scene).intensity = .55;
const moon = new DirectionalLight("moonlight", new Vector3(-.45, -1, .25), scene); moon.position = new Vector3(20, 35, -20); moon.intensity = .7;
new GlowLayer("atmosphere", scene).intensity = .35;
const player = createPlayer(scene, canvas);
scene.activeCamera = player.camera;
const flashlight = new SpotLight("flashlight", new Vector3(0, -.1, 0), new Vector3(0, 0, 1), Math.PI / 3, 2, scene);
flashlight.intensity = 3.5;
flashlight.range = 18;
flashlight.diffuse = new Color3(1, .84, .58);
const flashlightGlow = new PointLight("flashlight glow", new Vector3(0, 0, .2), scene);
flashlightGlow.diffuse = new Color3(1, .72, .4);
flashlightGlow.range = 3;
flashlightGlow.intensity = .18;
flashlight.setEnabled(state.flashlight);
flashlightGlow.setEnabled(state.flashlight);
const world = buildWorld(scene, state.settings?.quality || "high");
const interactables = world.pickups.filter((mesh) => !state.collected.includes(mesh.metadata.id));
world.pickups.filter((mesh) => state.collected.includes(mesh.metadata.id)).forEach((mesh) => mesh.dispose());

function toast(text) { const el = document.querySelector("#toast"); el.textContent = text; el.classList.add("show"); setTimeout(() => el.classList.remove("show"), 3600); }
function updateVitals() { ["health", "energy", "hunger"].forEach((key) => document.querySelector(`#${key}-bar`).style.width = `${state[key]}%`); }
function updateBattery() { document.querySelector("#battery-value").textContent = `${Math.ceil(state.battery)}%`; }
function updateNearby() { nearest = null; let distance = 3.2; const forward = player.camera.getDirection(Vector3.Forward()); interactables.forEach((mesh) => { if (!mesh.isDisposed()) { const offset = mesh.position.subtract(player.camera.position); const current = offset.length(); if (current < distance && Vector3.Dot(forward, offset.normalize()) > .58) { nearest = mesh; distance = current; } } }); const prompt = document.querySelector("#interaction"); prompt.textContent = nearest ? `[E] ${nearest.metadata.label}` : ""; prompt.classList.toggle("show", Boolean(nearest)); }
function dropPosition() { const forward = player.camera.getDirection(Vector3.Forward()); forward.y = 0; forward.normalize(); return player.camera.position.add(forward.scale(1.25)); }
function dropItem(type, label, noteText = "") { const id = `dropped-${type}-${Date.now()}`; const position = dropPosition(); position.y = type === "note" ? 1.1 : .4; const pickup = createPickup(scene, id, type, position, label, "Recuperaste el objeto descartado.", noteText); interactables.push(pickup); }
function showNote(text, title = "Nota de Daniel") { noteOpen = true; document.querySelector("#note-title").textContent = title; document.querySelector("#note-content").innerHTML = text.split("\n\n").map((paragraph) => `<p>${paragraph}</p>`).join(""); document.querySelector("#note-modal").hidden = false; }
function closeNote() { noteOpen = false; document.querySelector("#note-modal").hidden = true; }
function toggleFlashlight() { if (!state.flashlight && state.battery <= 0) return toast("La linterna no tiene batería."); state.flashlight = !state.flashlight; flashlight.setEnabled(state.flashlight); flashlightGlow.setEnabled(state.flashlight); document.querySelector("#flashlight-button").classList.toggle("active", state.flashlight); }
function updateFlashlight() { const forward = player.camera.getDirection(Vector3.Forward()); flashlight.position.copyFrom(player.camera.position.add(forward.scale(.18))); flashlight.direction.copyFrom(forward); flashlightGlow.position.copyFrom(player.camera.position.add(forward.scale(.12))); }
function toggleQuality() { state.settings.quality = state.settings.quality === "high" ? "low" : "high"; engine.setHardwareScalingLevel(state.settings.quality === "high" ? 1 : 1.5); document.querySelector("#quality-button").textContent = `CALIDAD: ${state.settings.quality === "high" ? "ALTA" : "BAJA"}`; toast("Calidad gráfica actualizada."); }
function openBackpack() { document.querySelector("#inventory").classList.add("open"); }
function showBatteryPrompt() { const modal = document.querySelector("#battery-modal"); const amount = state.inventory.battery || 0; document.querySelector("#battery-question").textContent = amount ? `Tienes ${amount} batería${amount === 1 ? "" : "s"} en la mochila.` : "No tienes baterías en la mochila."; document.querySelector("#replace-battery").disabled = !amount; modal.hidden = false; }
function replaceBattery() { if (!state.inventory.battery) return; state.inventory.battery--; if (!state.inventory.battery) delete state.inventory.battery; state.battery = 100; state.flashlight = true; flashlight.setEnabled(true); flashlightGlow.setEnabled(true); document.querySelector("#flashlight-button").classList.add("active"); document.querySelector("#battery-modal").hidden = true; renderInventory(state); saveCurrentGame(); toast("Instalaste una batería nueva."); }
function closeBackpack() { document.querySelector("#inventory").classList.remove("open"); }
function saveCurrentGame() { saveGame(state); toast("Partida guardada en este dispositivo."); }
function updateMinimap() {
  const clamp = (value) => Math.max(8, Math.min(92, value));
  const marker = document.querySelector("#player-marker");
  marker.style.left = `${clamp(50 + player.camera.position.x * 1.4)}%`;
  marker.style.top = `${clamp(50 + player.camera.position.z * 1.4)}%`;
}
function interact() { if (!nearest || noteOpen) return; const { id, type, label, message, noteText } = nearest.metadata; if (type === "berries") { state.hunger = Math.min(100, state.hunger + 28); state.collected.push(id); nearest.dispose(); nearest = null; updateVitals(); saveGame(state); return toast("Comiste frutas silvestres. Recuperaste saciedad."); } if (inventoryWeight(state) >= 12) return toast("La mochila está llena. No puedes cargar más objetos."); addItem(state, type); state.collected.push(id); if (type === "note") { state.documents.push({ id, title: label, text: noteText }); state.journal.push("Encontraste una nota de Daniel."); document.querySelector("#objective").textContent = "Sal de la cabaña y sigue las pistas hacia el vehículo."; showNote(noteText, label); } nearest.dispose(); nearest = null; renderInventory(state); renderJournal(state); saveGame(state); toast(message); }
function discardItem(type) { if (!state.inventory[type]) return; const label = type === "wood" ? "Ramas secas" : type === "berries" ? "Bayas oscuras" : "Batería de linterna"; state.inventory[type]--; if (!state.inventory[type]) delete state.inventory[type]; dropItem(type, label); renderInventory(state); saveGame(state); toast("El objeto quedó en el suelo junto a ti."); }
function discardNote(id) { const index = state.documents.findIndex((document) => document.id === id); if (index < 0) return; const [document] = state.documents.splice(index, 1); state.inventory.note--; if (!state.inventory.note) delete state.inventory.note; dropItem("note", document.title, document.text); renderInventory(state); saveGame(state); toast("La nota quedó en el suelo junto a ti."); }
function inputState() { return { forward: touchInput.forward || pressedKeys.has("KeyW") || pressedKeys.has("ArrowUp"), back: touchInput.back || pressedKeys.has("KeyS") || pressedKeys.has("ArrowDown"), left: touchInput.left || pressedKeys.has("KeyA") || pressedKeys.has("ArrowLeft"), right: touchInput.right || pressedKeys.has("KeyD") || pressedKeys.has("ArrowRight"), run: state.energy > 0 && (touchInput.run || pressedKeys.has("ShiftLeft") || pressedKeys.has("ShiftRight")), crouch: touchInput.crouch || pressedKeys.has("ControlLeft") || pressedKeys.has("ControlRight"), jump: touchInput.jump || pressedKeys.has("Space") }; }

engine.setHardwareScalingLevel(state.settings.quality === "high" ? 1 : 1.5); renderInventory(state); renderJournal(state); updateVitals(); updateBattery();
document.querySelector("#start-button").addEventListener("click", () => document.querySelector("#intro").classList.add("hidden"));
document.querySelector("#save-button").addEventListener("click", saveCurrentGame);
document.querySelector("#flashlight-button").addEventListener("click", toggleFlashlight);
document.querySelector("#quality-button").addEventListener("click", toggleQuality);
document.querySelector("#backpack-button").addEventListener("click", openBackpack);
document.querySelector("#close-backpack").addEventListener("click", closeBackpack);
document.querySelector("#close-note").addEventListener("click", closeNote);
document.querySelector("#replace-battery").addEventListener("click", replaceBattery);
document.querySelector("#decline-battery").addEventListener("click", () => document.querySelector("#battery-modal").hidden = true);
document.querySelector("#items").addEventListener("click", (event) => { const read = event.target.closest("[data-read-note]"); const deleteNote = event.target.closest("[data-delete-note]"); const deleteItem = event.target.closest("[data-delete-item]"); if (read) { const document = state.documents.find((entry) => entry.id === read.dataset.readNote); if (document) showNote(document.text, document.title); } if (deleteNote) discardNote(deleteNote.dataset.deleteNote); if (deleteItem) discardItem(deleteItem.dataset.deleteItem); });
document.querySelector("#touch-interact").addEventListener("click", interact);
[["#touch-run", "run"], ["#touch-jump", "jump"]].forEach(([selector, key]) => { const button = document.querySelector(selector); button.addEventListener("pointerdown", () => touchInput[key] = true); ["pointerup", "pointerleave", "pointercancel"].forEach((event) => button.addEventListener(event, () => touchInput[key] = false)); });
document.querySelectorAll("[data-move]").forEach((button) => { const key = button.dataset.move; button.addEventListener("pointerdown", () => touchInput[key] = 1); ["pointerup", "pointerleave", "pointercancel"].forEach((event) => button.addEventListener(event, () => touchInput[key] = 0)); });
window.addEventListener("keydown", (event) => { if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault(); if (event.ctrlKey && event.code === "KeyA") { event.preventDefault(); saveCurrentGame(); return; } pressedKeys.add(event.code); if (event.code === "KeyE") noteOpen ? closeNote() : interact(); if (event.code === "KeyM" && !event.repeat) openBackpack(); if (event.code === "KeyF" && !noteOpen && !event.repeat) toggleFlashlight(); });
window.addEventListener("keyup", (event) => pressedKeys.delete(event.code));
window.addEventListener("blur", () => pressedKeys.clear());
scene.onBeforeRenderObservable.add(() => { try { const delta = engine.getDeltaTime() / 1000; const controls = inputState(); if (!noteOpen) updatePlayer(player, controls, delta, world); updateFlashlight(); if (Math.abs(player.camera.position.x) > 74 || Math.abs(player.camera.position.z) > 74) { player.camera.position.set(0, 1.7, -1.5); toast("MAPA EN DESARROLLO. Regresaste a la cabaña."); } if (state.flashlight) { state.battery = Math.max(0, state.battery - delta * .35); if (!state.battery) { toggleFlashlight(); showBatteryPrompt(); } } const moving = controls.forward || controls.back || controls.left || controls.right; state.energy = controls.run && moving ? Math.max(0, state.energy - delta * 12) : Math.min(100, state.energy + delta * 7); state.hunger = Math.max(0, state.hunger - delta * 1.2); updateNearby(); updateMinimap(); updateVitals(); updateBattery(); } catch (error) { console.error(error); document.querySelector("#objective").textContent = `Error de escena: ${error.message}`; } });
engine.runRenderLoop(() => scene.render());
window.addEventListener("resize", () => engine.resize());
