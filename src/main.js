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
const state = { inventory: {}, journal: ["La cabaña de vigilancia sigue en pie. Daniel dejó algo sobre la mesa."], collected: [], documents: [], health: 100, energy: 100, hunger: 70, flashlight: true, battery: 100, rifleAmmo: 0, settings: { quality: "high" } };
const stored = loadGame();
if (stored) Object.assign(state, stored);
state.rifleAmmo ??= 0;
let nearest = null;
let noteOpen = false;
let escaped = false;
let nearExit = false;
let creatureHealth = 3;
let audioContext = null;
let nextFootstep = 0;
let lastShotAt = 0;
let muzzleUntil = 0;
let windGain = null;
let waterGain = null;
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
flashlight.intensity = state.flashlight && state.battery > 0 ? 3.5 : 0;
flashlightGlow.intensity = state.flashlight && state.battery > 0 ? .18 : 0;
const muzzleFlash = new PointLight("rifle muzzle flash", new Vector3(), scene);
muzzleFlash.diffuse = new Color3(1, .72, .28);
muzzleFlash.intensity = 7;
muzzleFlash.range = 8;
muzzleFlash.setEnabled(false);
const world = buildWorld(scene, state.settings?.quality || "high");
const { creature, escapePoint } = world;
const interactables = world.pickups.filter((mesh) => !state.collected.includes(mesh.metadata.id));
world.pickups.filter((mesh) => state.collected.includes(mesh.metadata.id)).forEach((mesh) => mesh.dispose());

function toast(text) { const el = document.querySelector("#toast"); el.textContent = text; el.classList.add("show"); setTimeout(() => el.classList.remove("show"), 3600); }
function updateVitals() { ["health", "energy", "hunger"].forEach((key) => document.querySelector(`#${key}-bar`).style.width = `${state[key]}%`); }
function noteCount() { return state.collected.filter((id) => id.startsWith("note-")).length; }
function updateObjective() { const count = noteCount(); document.querySelector("#objective").textContent = count < 3 ? `Encuentra pistas de Daniel (${count}/3).` : !state.inventory.fuse ? "Busca un fusible para activar la radio del norte." : "Lleva el fusible a la radio de emergencia al norte."; }
function updateBattery() { document.querySelector("#battery-value").textContent = `${Math.ceil(state.battery)}%`; }
function updateRifleHud() { const hasRifle = Boolean(state.inventory.rifle); document.querySelector("#ammo-hud").hidden = !hasRifle; document.querySelector("#rifle-ammo").textContent = `${state.rifleAmmo} / 3`; document.querySelector("#ammo-reserve").textContent = `${state.inventory.ammo || 0} RESERVA`; }
function updateNearby() { nearExit = noteCount() >= 3 && Vector3.Distance(player.camera.position, escapePoint) < 4.5; nearest = null; let distance = 3.2; const forward = player.camera.getDirection(Vector3.Forward()); interactables.forEach((mesh) => { if (!mesh.isDisposed()) { const offset = mesh.position.subtract(player.camera.position); const current = offset.length(); if (current < distance && Vector3.Dot(forward, offset.normalize()) > .25) { nearest = mesh; distance = current; } } }); const prompt = document.querySelector("#interaction"); prompt.textContent = nearExit ? "[E] ACTIVAR RADIO DE EMERGENCIA" : nearest ? `[E] ${nearest.metadata.label}` : ""; prompt.classList.toggle("show", nearExit || Boolean(nearest)); }
function dropPosition() { const forward = player.camera.getDirection(Vector3.Forward()); forward.y = 0; forward.normalize(); return player.camera.position.add(forward.scale(1.25)); }
function dropItem(type, label, noteText = "") { const id = `dropped-${type}-${Date.now()}`; const position = dropPosition(); const offset = { note: .05, wood: .16, battery: .36, knife: .1, rifle: .12, ammo: .15 }[type] || .24; position.y = world.terrainHeight(position.x, position.z) + offset; const pickup = createPickup(scene, id, type, position, label, "Recuperaste el objeto descartado.", noteText); interactables.push(pickup); }
function showNote(text, title = "Nota de Daniel") { noteOpen = true; document.querySelector("#note-title").textContent = title; document.querySelector("#note-content").innerHTML = text.split("\n\n").map((paragraph) => `<p>${paragraph}</p>`).join(""); document.querySelector("#note-modal").hidden = false; }
function closeNote() { noteOpen = false; document.querySelector("#note-modal").hidden = true; }
function setFlashlight(enabled) { state.flashlight = Boolean(enabled && state.battery > 0); flashlight.intensity = state.flashlight ? 3.5 : 0; flashlightGlow.intensity = state.flashlight ? .18 : 0; document.querySelector("#flashlight-button").classList.toggle("active", state.flashlight); }
function toggleFlashlight() { if (state.flashlight) return setFlashlight(false); if (state.battery <= 0) return toast("La linterna no tiene batería."); setFlashlight(true); }
function updateFlashlight() { const enabled = state.flashlight && state.battery > 0; flashlight.intensity = enabled ? 3.5 : 0; flashlightGlow.intensity = enabled ? .18 : 0; const forward = player.camera.getDirection(Vector3.Forward()); flashlight.position.copyFrom(player.camera.position.add(forward.scale(.18))); flashlight.direction.copyFrom(forward); flashlightGlow.position.copyFrom(player.camera.position.add(forward.scale(.12))); muzzleFlash.position.copyFrom(player.camera.position.add(forward.scale(.55))); muzzleFlash.setEnabled(performance.now() < muzzleUntil); }
function toggleQuality() { state.settings.quality = state.settings.quality === "high" ? "low" : "high"; engine.setHardwareScalingLevel(state.settings.quality === "high" ? 1 : 1.5); document.querySelector("#quality-button").textContent = `CALIDAD: ${state.settings.quality === "high" ? "ALTA" : "BAJA"}`; toast("Calidad gráfica actualizada."); }
function openBackpack() { document.querySelector("#inventory").classList.add("open"); }
function showBatteryPrompt() { const modal = document.querySelector("#battery-modal"); const amount = state.inventory.battery || 0; document.querySelector("#battery-question").textContent = amount ? `Tienes ${amount} batería${amount === 1 ? "" : "s"} en la mochila.` : "No tienes baterías en la mochila."; document.querySelector("#replace-battery").disabled = !amount; modal.hidden = false; }
function replaceBattery() { if (!state.inventory.battery) return; state.inventory.battery--; if (!state.inventory.battery) delete state.inventory.battery; state.battery = 100; setFlashlight(true); document.querySelector("#battery-modal").hidden = true; renderInventory(state); saveCurrentGame(); toast("Instalaste una batería nueva."); }
function closeBackpack() { document.querySelector("#inventory").classList.remove("open"); }
function saveCurrentGame() { saveGame(state); toast("Partida guardada en este dispositivo."); }
function updateMinimap() {
  const clamp = (value) => Math.max(8, Math.min(92, value));
  const left = `${clamp(50 + player.camera.position.x * .19)}%`;
  const top = `${clamp(50 + player.camera.position.z * .19)}%`;
  ["#player-marker", "#world-player-marker"].forEach((selector) => { const marker = document.querySelector(selector); marker.style.left = left; marker.style.top = top; });
}
function interact() { if (noteOpen) return; if (nearExit) { if (!state.inventory.fuse) return toast("La radio necesita un fusible."); state.inventory.fuse--; if (!state.inventory.fuse) delete state.inventory.fuse; escaped = true; renderInventory(state); saveGame(state); document.querySelector("#ending-modal").hidden = false; document.querySelector("#objective").textContent = "La radio de emergencia está transmitiendo."; return; } if (!nearest) return; const { id, type, label, message, noteText } = nearest.metadata; if (type === "berries") { state.hunger = Math.min(100, state.hunger + 28); state.collected.push(id); nearest.dispose(); nearest = null; updateVitals(); saveGame(state); return toast("Comiste frutas silvestres. Recuperaste saciedad."); } if (type === "battery" && state.battery <= 0) { state.battery = 100; setFlashlight(true); state.collected.push(id); nearest.dispose(); nearest = null; document.querySelector("#battery-modal").hidden = true; saveGame(state); updateBattery(); return toast("Instalaste la batería y encendiste la linterna."); } const amount = type === "ammo" ? (state.inventory.ammo ? 0 : 1) : 1; if (inventoryWeight(state) + amount > 12) return toast("La mochila está llena. No puedes cargar más objetos."); if (type === "rifle") { addItem(state, "rifle"); state.rifleAmmo = 3; } else addItem(state, type, type === "ammo" ? 3 : 1); state.collected.push(id); if (type === "note") { state.documents.push({ id, title: label, text: noteText }); state.journal.push("Encontraste una nota de Daniel."); updateObjective(); showNote(noteText, label); } nearest.dispose(); nearest = null; renderInventory(state); renderJournal(state); updateRifleHud(); saveGame(state); toast(type === "rifle" ? "Encontraste el rifle con 3 balas cargadas." : message); }
function discardItem(type) { if (!state.inventory[type]) return; const label = type === "wood" ? "Ramas secas" : type === "berries" ? "Bayas oscuras" : "Batería de linterna"; state.inventory[type]--; if (!state.inventory[type]) delete state.inventory[type]; dropItem(type, label); renderInventory(state); saveGame(state); toast("El objeto quedó en el suelo junto a ti."); }
function discardNote(id) { const index = state.documents.findIndex((document) => document.id === id); if (index < 0) return; const [document] = state.documents.splice(index, 1); state.inventory.note--; if (!state.inventory.note) delete state.inventory.note; dropItem("note", document.title, document.text); renderInventory(state); saveGame(state); toast("La nota quedó en el suelo junto a ti."); }
function inputState() { return { forward: touchInput.forward || pressedKeys.has("KeyW") || pressedKeys.has("ArrowUp"), back: touchInput.back || pressedKeys.has("KeyS") || pressedKeys.has("ArrowDown"), left: touchInput.left || pressedKeys.has("KeyA") || pressedKeys.has("ArrowLeft"), right: touchInput.right || pressedKeys.has("KeyD") || pressedKeys.has("ArrowRight"), run: state.energy > 0 && (touchInput.run || pressedKeys.has("ShiftLeft") || pressedKeys.has("ShiftRight")), crouch: touchInput.crouch || pressedKeys.has("ControlLeft") || pressedKeys.has("ControlRight"), jump: touchInput.jump || pressedKeys.has("Space") }; }
function enableAudio() { const AudioContext = window.AudioContext || window.webkitAudioContext; if (!AudioContext) return; audioContext ||= new AudioContext(); audioContext.resume(); if (!windGain) { const wind = audioContext.createOscillator(); windGain = audioContext.createGain(); wind.type = "sine"; wind.frequency.value = 47; windGain.gain.value = .008; wind.connect(windGain).connect(audioContext.destination); wind.start(); const water = audioContext.createOscillator(); waterGain = audioContext.createGain(); water.type = "triangle"; water.frequency.value = 92; waterGain.gain.value = 0; water.connect(waterGain).connect(audioContext.destination); water.start(); } }
function updateAmbient() { if (!audioContext || !waterGain) return; const nearRiver = Vector3.Distance(player.camera.position, new Vector3(150, 0, -175)) < 42; waterGain.gain.setTargetAtTime(nearRiver ? .025 : 0, audioContext.currentTime, .4); }
function playCreatureSound() { if (!audioContext) return; const oscillator = audioContext.createOscillator(); const gain = audioContext.createGain(); oscillator.type = "sawtooth"; oscillator.frequency.setValueAtTime(72, audioContext.currentTime); oscillator.frequency.exponentialRampToValueAtTime(32, audioContext.currentTime + .45); gain.gain.setValueAtTime(.04, audioContext.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + .5); oscillator.connect(gain).connect(audioContext.destination); oscillator.start(); oscillator.stop(audioContext.currentTime + .52); }
function updateFootsteps(controls) { const moving = controls.forward || controls.back || controls.left || controls.right; if (!audioContext || !moving || noteOpen || escaped || audioContext.currentTime < nextFootstep) return; const running = controls.run; nextFootstep = audioContext.currentTime + (running ? .27 : .46); const oscillator = audioContext.createOscillator(); const gain = audioContext.createGain(); oscillator.type = "triangle"; oscillator.frequency.value = running ? 84 : 63; gain.gain.setValueAtTime(running ? .042 : .024, audioContext.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + .09); oscillator.connect(gain).connect(audioContext.destination); oscillator.start(); oscillator.stop(audioContext.currentTime + .1); }
function reloadRifle() { if (!state.inventory.rifle) return toast("Necesitas encontrar el rifle de caza."); const needed = 3 - state.rifleAmmo; if (!needed) return toast("El cargador ya está lleno."); if (!state.inventory.ammo) return toast("No tienes munición de reserva."); const loaded = Math.min(needed, state.inventory.ammo); state.rifleAmmo += loaded; state.inventory.ammo -= loaded; if (!state.inventory.ammo) delete state.inventory.ammo; renderInventory(state); updateRifleHud(); saveGame(state); toast(`Recargaste ${loaded} bala${loaded === 1 ? "" : "s"}.`); }
function useMedkit() { if (!state.inventory.medkit) return; if (state.health >= 100) return toast("Tu salud ya está completa."); state.inventory.medkit--; if (!state.inventory.medkit) delete state.inventory.medkit; state.health = Math.min(100, state.health + 55); renderInventory(state); updateVitals(); saveGame(state); toast("Usaste un botiquín."); }
function shootRifle() { if (!state.inventory.rifle) return toast("Necesitas encontrar el rifle de caza."); if (!state.rifleAmmo) return reloadRifle(); const now = performance.now(); if (now - lastShotAt < 450) return; lastShotAt = now; state.rifleAmmo--; updateRifleHud(); saveGame(state); muzzleUntil = now + 70; enableAudio(); if (audioContext) { const oscillator = audioContext.createOscillator(); const gain = audioContext.createGain(); oscillator.type = "sawtooth"; oscillator.frequency.setValueAtTime(140, audioContext.currentTime); oscillator.frequency.exponentialRampToValueAtTime(45, audioContext.currentTime + .14); gain.gain.setValueAtTime(.12, audioContext.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + .16); oscillator.connect(gain).connect(audioContext.destination); oscillator.start(); oscillator.stop(audioContext.currentTime + .17); } const forward = player.camera.getDirection(Vector3.Forward()); const target = creature.position.subtract(player.camera.position); const distance = target.length(); if (creature.isVisible && distance < 30 && Vector3.Dot(forward, target.normalize()) > .9) { creatureHealth--; if (creatureHealth <= 0) { creature.metadata.disabledUntil = now + 18000; creature.isVisible = false; creature.metadata.alerted = false; toast("La criatura cayó. Tienes unos segundos."); } else { creature.metadata.alerted = true; toast(`Impacto. La criatura resiste (${creatureHealth}/3).`); } } else { creature.metadata.alerted = true; toast(`El disparo resonó. Cargador: ${state.rifleAmmo}/3.`); } }
function openMap() { document.querySelector("#world-map").hidden = false; }
function closeMap() { document.querySelector("#world-map").hidden = true; }
function updateCreature(delta, controls) { const now = performance.now(); if (creature.metadata.disabledUntil > now) return; if (!creature.isVisible) { creature.isVisible = true; creatureHealth = 3; creature.position.copyFrom(creature.metadata.home); toast("Algo se levantó entre los árboles."); } if (escaped) return; const playerPosition = player.camera.position; const offset = playerPosition.subtract(creature.position); offset.y = 0; const distance = offset.length(); const runningNearby = controls.run && (controls.forward || controls.back || controls.left || controls.right) && distance < 32; if (!creature.metadata.alerted && (runningNearby || distance < 9)) { creature.metadata.alerted = true; playCreatureSound(); toast("Algo te ha escuchado entre los árboles."); } if (!creature.metadata.alerted) return; if (distance > 1.4) { offset.normalize(); creature.position.addInPlace(offset.scale(Math.min(distance - 1.4, delta * 2.65))); creature.position.y = world.terrainHeight(creature.position.x, creature.position.z) + 1.4; creature.rotation.y = Math.atan2(offset.x, offset.z); } if (distance < 2.2) state.health = Math.max(0, state.health - delta * 24); if (state.health === 0) { state.health = 100; player.camera.position.set(0, 1.7, -1.5); creature.position.copyFrom(creature.metadata.home); creature.metadata.alerted = false; toast("La oscuridad te devolvió a la cabaña."); } }

engine.setHardwareScalingLevel(state.settings.quality === "high" ? 1 : 1.5); renderInventory(state); renderJournal(state); updateVitals(); updateBattery(); updateRifleHud(); updateObjective();
document.querySelector("#start-button").addEventListener("click", () => { enableAudio(); document.querySelector("#intro").classList.add("hidden"); });
document.querySelector("#save-button").addEventListener("click", saveCurrentGame);
document.querySelector("#flashlight-button").addEventListener("click", toggleFlashlight);
document.querySelector("#quality-button").addEventListener("click", toggleQuality);
document.querySelector("#backpack-button").addEventListener("click", openBackpack);
document.querySelector("#close-backpack").addEventListener("click", closeBackpack);
document.querySelector("#close-note").addEventListener("click", closeNote);
document.querySelector("#minimap").addEventListener("click", openMap);
document.querySelector("#minimap").addEventListener("keydown", (event) => { if (event.code === "Enter" || event.code === "Space") { event.preventDefault(); openMap(); } });
document.querySelector("#close-map").addEventListener("click", closeMap);
document.querySelector("#replace-battery").addEventListener("click", replaceBattery);
document.querySelector("#decline-battery").addEventListener("click", () => document.querySelector("#battery-modal").hidden = true);
document.querySelector("#restart-game").addEventListener("click", () => { escaped = false; document.querySelector("#ending-modal").hidden = true; player.camera.position.set(0, 1.7, -1.5); updateObjective(); });
document.querySelector("#items").addEventListener("click", (event) => { const read = event.target.closest("[data-read-note]"); const deleteNote = event.target.closest("[data-delete-note]"); const use = event.target.closest("[data-use-item]"); const deleteItem = event.target.closest("[data-delete-item]"); if (read) { const document = state.documents.find((entry) => entry.id === read.dataset.readNote); if (document) showNote(document.text, document.title); } if (deleteNote) discardNote(deleteNote.dataset.deleteNote); if (use?.dataset.useItem === "medkit") useMedkit(); if (deleteItem) discardItem(deleteItem.dataset.deleteItem); });
document.querySelector("#touch-interact").addEventListener("click", interact);
[["#touch-run", "run"], ["#touch-jump", "jump"]].forEach(([selector, key]) => { const button = document.querySelector(selector); button.addEventListener("pointerdown", () => touchInput[key] = true); ["pointerup", "pointerleave", "pointercancel"].forEach((event) => button.addEventListener(event, () => touchInput[key] = false)); });
document.querySelectorAll("[data-move]").forEach((button) => { const key = button.dataset.move; button.addEventListener("pointerdown", () => touchInput[key] = 1); ["pointerup", "pointerleave", "pointercancel"].forEach((event) => button.addEventListener(event, () => touchInput[key] = 0)); });
window.addEventListener("keydown", (event) => { if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault(); if (event.ctrlKey && event.code === "KeyA") { event.preventDefault(); saveCurrentGame(); return; } pressedKeys.add(event.code); if (event.code === "Escape") closeMap(); if (event.code === "KeyE") noteOpen ? closeNote() : interact(); if (event.code === "KeyM" && !event.repeat) openBackpack(); if (event.code === "KeyF" && !noteOpen && !event.repeat) toggleFlashlight(); if (event.code === "KeyG" && !noteOpen && !event.repeat) shootRifle(); if (event.code === "KeyR" && !noteOpen && !event.repeat) reloadRifle(); if (event.code === "KeyH" && !noteOpen && !event.repeat) useMedkit(); });
window.addEventListener("keyup", (event) => pressedKeys.delete(event.code));
window.addEventListener("blur", () => pressedKeys.clear());
scene.onBeforeRenderObservable.add(() => { try { const delta = engine.getDeltaTime() / 1000; const controls = inputState(); if (!noteOpen && !escaped) updatePlayer(player, controls, delta, world); updateFlashlight(); if (Math.abs(player.camera.position.x) > 224 || Math.abs(player.camera.position.z) > 224) { player.camera.position.set(0, 1.7, -1.5); toast("El bosque termina aquí. Regresaste a la cabaña."); } if (state.flashlight) { state.battery = Math.max(0, state.battery - delta * .35); if (!state.battery) { setFlashlight(false); showBatteryPrompt(); } } const moving = controls.forward || controls.back || controls.left || controls.right; state.energy = controls.run && moving ? Math.max(0, state.energy - delta * 12) : Math.min(100, state.energy + delta * 7); state.hunger = Math.max(0, state.hunger - delta * 1.2); updateFootsteps(controls); updateAmbient(); updateCreature(delta, controls); updateNearby(); updateMinimap(); updateVitals(); updateBattery(); } catch (error) { console.error(error); document.querySelector("#objective").textContent = `Error de escena: ${error.message}`; } });
engine.runRenderLoop(() => scene.render());
window.addEventListener("resize", () => engine.resize());
