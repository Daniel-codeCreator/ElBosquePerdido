import "./ui/styles.css";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Ray } from "@babylonjs/core/Culling/ray";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { SpotLight } from "@babylonjs/core/Lights/spotLight";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
import {
  crearJugador,
  actualizarJugador,
} from "./game/player.js";
import { construirMundo, crearRecogible } from "./game/world.js";
import { CONFIG } from "./game/config.js";
import {
  agregarObjeto,
  pesoInventario,
  renderizarInventario,
  renderizarBitacora,
} from "./game/inventory.js";
import {
  borrarPartida,
  cargarPartida,
  guardarPartida,
} from "./game/save.js";
import {
  obtenerObjetivo,
  obtenerPuntoObjetivo,
} from "./game/chapters/index.js";

const lienzo = document.querySelector("#render-canvas");
const motor = new Engine(lienzo, true, { stencil: true });
const state = {
  inventory: {},
  journal: [
    "La cabaña de vigilancia sigue en pie. Daniel dejó algo sobre la mesa.",
  ],
  collected: [],
  readNotes: [],
  documents: [],
  health: 100,
  energy: 100,
  hunger: 70,
  flashlight: false,
  flashlightAcquired: false,
  battery: 100,
  rifleAmmo: 0,
  equippedWeapon: "knife",
  chapter2: false,
  stationPowered: false,
  chapter2Finished: false,
  chapter3: false,
  chapter4: false,
  chapter5: false,
  chapter6: false,
  mission: { phase: "note-1" },
  settings: { quality: "high", flashlightMode: "wide" },
  fires: {},
  receiverRepaired: false,
  crateUnlocked: false,
  killedWildlife: [],
  triggeredTraps: [],
  satiatedUntil: 0,
};
const partidaGuardada = cargarPartida();
if (partidaGuardada) Object.assign(state, partidaGuardada);
state.inventory ??= {};
// Las partidas anteriores ya disponían de linterna; las nuevas deben recogerla.
let linternaMigrada = false;
if (partidaGuardada && state.flashlightAcquired === undefined) {
  state.inventory.flashlight = 1;
  state.flashlightAcquired = true;
  linternaMigrada = true;
}
state.flashlightAcquired ??= false;
const municionAntigua = Math.max(0, Number(state.inventory.ammo) || 0);
if (municionAntigua) {
  state.inventory.ammoMagazine = (state.inventory.ammoMagazine || 0) + Math.ceil(municionAntigua / 3);
}
const municionMigrada = "ammo" in state.inventory;
delete state.inventory.ammo;
state.collected ??= [];
state.rifleAmmo ??= 0;
if (!state.inventory[state.equippedWeapon])
  state.equippedWeapon = state.inventory.knife ? "knife" : "rifle";
state.readNotes ??= [];
state.documents ??= [];
state.fires ??= {};
state.killedWildlife ??= [];
state.triggeredTraps ??= [];
state.satiatedUntil ??= 0;
state.settings ??= { quality: "high", flashlightMode: "wide" };
state.settings.audio ??= { master: 1, effects: 1, ambient: 1, music: 1 };
state.settings.sensitivity ??= 1;
state.mission ??= { phase: state.chapter2 ? "find-card" : "note-1" };
const fasesCapitulo3 = ["signal-1", "signal-2", "signal-3"];
const fasesCapitulo4 = ["hospital-file", "police-file", "gas-record"];
const fasesCapitulo5 = ["cave-entry", "cave-valve", "cave-daniel"];
const fasesPosterioresARadio = ["find-card", "industrial-fuses", "generator", "station-transmitter", ...fasesCapitulo3, ...fasesCapitulo4, ...fasesCapitulo5, "final-panel", "epilogue"];
state.chapter2 ||= fasesPosterioresARadio.includes(state.mission.phase);
state.chapter3 ||= fasesCapitulo3.includes(state.mission.phase) || fasesCapitulo4.includes(state.mission.phase) || fasesCapitulo5.includes(state.mission.phase) || ["final-panel", "epilogue"].includes(state.mission.phase);
state.chapter4 ||= fasesCapitulo4.includes(state.mission.phase) || fasesCapitulo5.includes(state.mission.phase) || ["final-panel", "epilogue"].includes(state.mission.phase);
state.chapter5 ||= fasesCapitulo5.includes(state.mission.phase) || ["final-panel", "epilogue"].includes(state.mission.phase);
state.chapter6 ||= ["final-panel", "epilogue"].includes(state.mission.phase);
// Recupera la siguiente misión si una partida antigua guardó una fase de nota obsoleta.
function sincronizarMisionNotas() {
  const notasPrincipales = ["note-1", "note-2", "note-4"];
  if (!notasPrincipales.includes(state.mission.phase)) return false;
  const siguienteNota = notasPrincipales.find(
    (id) => !state.readNotes.includes(id),
  );
  const siguienteFase = siguienteNota || "radio-fuse";
  if (state.mission.phase === siguienteFase) return false;
  state.mission.phase = siguienteFase;
  return true;
}
// Restaura objetos de misión que se perdieron en guardados anteriores.
function repararObjetosMision() {
  let reparado = false;
  // A signal phase always needs its transmitter, even in an inconsistent save.
  if (fasesCapitulo3.includes(state.mission.phase) && state.collected.includes(state.mission.phase)) {
    state.collected = state.collected.filter((id) => id !== state.mission.phase);
    reparado = true;
  }
  if (
    !state.chapter2 &&
    ["radio-fuse", "radio"].includes(state.mission.phase) &&
    !state.inventory.radioFuse
  ) {
    state.mission.phase = "radio-fuse";
    state.collected = state.collected.filter((id) => id !== "fuse-lodge");
    reparado = true;
  }
  if (
    state.chapter2 &&
    !state.stationPowered &&
    ["find-card", "industrial-fuses", "generator"].includes(state.mission.phase) &&
    !state.inventory.card
  ) {
    const tarjetaOculta = state.collected.includes("station-card");
    if (state.mission.phase !== "find-card" || tarjetaOculta) {
      state.mission.phase = "find-card";
      state.collected = state.collected.filter((id) => id !== "station-card");
      reparado = true;
    }
  }
  if (state.chapter2 && !state.stationPowered) {
    const fusibles = ["station-fuse-a", "station-fuse-b", "station-fuse-c"];
    const cantidadDisponible = state.inventory.industrialFuse || 0;
    const recogidos = fusibles.filter((id) => state.collected.includes(id));
    if (recogidos.length > cantidadDisponible) {
      const conservar = new Set(recogidos.slice(0, cantidadDisponible));
      state.collected = state.collected.filter(
        (id) => !fusibles.includes(id) || conservar.has(id),
      );
      if (state.mission.phase === "generator") state.mission.phase = "industrial-fuses";
      reparado = true;
    }
  }
  return reparado;
}
const misionSincronizada = sincronizarMisionNotas();
const objetosReparados = repararObjetosMision();
if (misionSincronizada || objetosReparados || municionMigrada || linternaMigrada) guardarPartida(state);
const tieneProgresoGuardado = Boolean(
  partidaGuardada &&
    (state.collected.length ||
      state.readNotes.length ||
      Object.keys(state.inventory).length ||
      state.chapter2),
);
if (tieneProgresoGuardado) document.querySelector("#intro").classList.add("hidden");
let masCercano = null;
let notaAbierta = false;
let escapo = false;
let cercaSalida = false;
let pausado = false;
let controlesCamaraAdjuntos = true;
let saludCriatura = 3;
let contextoAudio = null;
let proximoPaso = 0;
let ultimoDisparo = 0;
let destelloHasta = 0;
let gananciaPrincipal = null;
let gananciaViento = null;
let gananciaAgua = null;
const gananciasAudio = {};
let proximoSonidoRio = 0;
let proximoPasoCriatura = 0;
let ultimoAvisoHambre = 0;
let atrapado = false;
let minijuegoTrampa = null;
let visionNocturnaActiva = false;
let linternaAntesDeVision = false;
let fovAntesDeVision = null;
const teclasPulsadas = new Set();
const entradaTactil = {
  forward: 0,
  back: 0,
  left: 0,
  right: 0,
  run: false,
  crouch: false,
  jump: false,
};

const escena = new Scene(motor);
escena.clearColor = new Color4(0.045, 0.105, 0.12, 1);
escena.fogMode = Scene.FOGMODE_EXP2;
escena.fogDensity = 0.021;
escena.fogColor = new Color3(0.045, 0.11, 0.11);
const luzCielo = new HemisphericLight("moon", new Vector3(0.2, 1, 0.1), escena);
luzCielo.diffuse = new Color3(0.28, 0.45, 0.5);
luzCielo.groundColor = new Color3(0.055, 0.07, 0.055);
luzCielo.intensity = 0.52;
const luna = new DirectionalLight(
  "moonlight",
  new Vector3(-0.45, -1, 0.25),
  escena,
);
luna.position = new Vector3(20, 35, -20);
luna.diffuse = new Color3(0.5, 0.68, 0.72);
luna.intensity = 0.58;
new GlowLayer("atmosphere", escena).intensity = 0.35;
const jugador = crearJugador(escena, lienzo);
escena.activeCamera = jugador.camera;
const linterna = new SpotLight(
  "flashlight",
  new Vector3(0, -0.1, 0),
  new Vector3(0, 0, 1),
  Math.PI / 2.5,
  1.35,
  escena,
);
linterna.intensity = 0;
linterna.range = 30;
linterna.diffuse = new Color3(1, 0.94, 0.76);
const brilloLinterna = new PointLight(
  "flashlight glow",
  new Vector3(0, 0, 0.2),
  escena,
);
brilloLinterna.diffuse = new Color3(1, 0.82, 0.56);
brilloLinterna.range = 7;
brilloLinterna.intensity = 0.55;
linterna.intensity = state.inventory.flashlight && state.flashlight && state.battery > 0 ? 8 : 0;
brilloLinterna.intensity = state.inventory.flashlight && state.flashlight && state.battery > 0 ? 0.2 : 0;
const pistaLinterna = MeshBuilder.CreateCylinder("flashlight ground cue", { height: 0.01, diameter: 2.4, tessellation: 24 }, escena);
const materialPistaLinterna = new StandardMaterial("flashlight ground cue material", escena);
materialPistaLinterna.diffuseColor = Color3.FromHexString("#e7c783");
materialPistaLinterna.emissiveColor = Color3.FromHexString("#5d4828");
materialPistaLinterna.alpha = 0.16;
materialPistaLinterna.disableLighting = true;
pistaLinterna.material = materialPistaLinterna;
pistaLinterna.isPickable = false;
pistaLinterna.isVisible = false;
const destelloBoca = new PointLight("rifle muzzle flash", new Vector3(), escena);
destelloBoca.diffuse = new Color3(1, 0.72, 0.28);
destelloBoca.intensity = 7;
destelloBoca.range = 8;
destelloBoca.setEnabled(false);
const mundo = construirMundo(escena, state.settings?.quality || "high");
jugador.camera.angularSensibility = 3800 / state.settings.sensitivity;
function crearArmasEnPrimeraPersona() {
  const crearMaterialArma = (nombre, color) => {
    const material = new StandardMaterial(nombre, escena);
    material.diffuseColor = Color3.FromHexString(color);
    material.specularColor = Color3.Black();
    return material;
  };
  const madera = crearMaterialArma("weapon wood", "#5b3922");
  const metal = crearMaterialArma("weapon metal", "#71817d");
  const hoja = crearMaterialArma("knife blade", "#b9c9c4");
  const crearParte = (nombre, options, padre, posicion, material) => {
    const parte = MeshBuilder.CreateBox(nombre, options, escena);
    parte.parent = padre;
    parte.position.copyFrom(posicion);
    parte.material = material;
    parte.isPickable = false;
    return parte;
  };
  const rifle = crearParte("first person rifle", { width: 0.15, height: 0.15, depth: 0.86 }, jugador.camera, new Vector3(0.43, -0.39, 0.78), madera);
  rifle.rotation.y = -0.08;
  crearParte("first person rifle barrel", { width: 0.07, height: 0.07, depth: 0.76 }, rifle, new Vector3(0, 0.05, -0.72), metal);
  crearParte("first person rifle stock", { width: 0.23, height: 0.19, depth: 0.35 }, rifle, new Vector3(0, -0.05, 0.42), madera);
  const knife = crearParte("first person knife", { width: 0.07, height: 0.05, depth: 0.56 }, jugador.camera, new Vector3(0.48, -0.4, 0.65), hoja);
  knife.rotation.y = -0.42;
  crearParte("first person knife handle", { width: 0.12, height: 0.09, depth: 0.2 }, knife, new Vector3(0, 0, 0.34), madera);
  return { rifle, knife };
}
const armasPrimeraPersona = crearArmasEnPrimeraPersona();
function actualizarArmaEquipada() {
  const equipada = state.inventory[state.equippedWeapon] ? state.equippedWeapon : null;
  armasPrimeraPersona.rifle.setEnabled(equipada === "rifle");
  armasPrimeraPersona.knife.setEnabled(equipada === "knife");
  document.querySelector("#weapon-hud").textContent = `ARMA: ${equipada === "rifle" ? "RIFLE" : equipada === "knife" ? "CUCHILLO" : "NINGUNA"}`;
}
function alternarArmaEquipada() {
  const disponibles = ["knife", "rifle"].filter((arma) => state.inventory[arma]);
  if (!disponibles.length) return mostrarAviso("No tienes un arma equipada.");
  const indice = disponibles.indexOf(state.equippedWeapon);
  state.equippedWeapon = disponibles[(indice + 1) % disponibles.length];
  actualizarArmaEquipada();
  guardarPartida(state);
  mostrarAviso(`Arma equipada: ${state.equippedWeapon === "rifle" ? "rifle" : "cuchillo"}.`);
}
function capituloDisponible(capitulo) {
  return capitulo === 2 ? state.chapter2 : Boolean(state[`chapter${capitulo}`]);
}
function actualizarObjetosCapitulo() {
  mundo.pickups
    .filter((recogible) => recogible.metadata.chapter)
      .forEach((recogible) => {
        const disponible = capituloDisponible(recogible.metadata.chapter);
        recogible.setEnabled(disponible);
        recogible.metadata.luzObjetivo?.setEnabled(disponible);
      });
  actualizarBalizasSenal();
}
function actualizarBalizasSenal() {
  mundo.signalBeacons.forEach((baliza) => {
    const activa = baliza.metadata.id === state.mission.phase;
    baliza.setEnabled(activa);
    baliza.metadata.light.intensity = activa ? 5 : 0;
  });
}
actualizarObjetosCapitulo();
if (state.chapter2 && state.mission.phase !== "epilogue")
  jugador.camera.position.set(
    mundo.stationPoint.x,
    mundo.stationPoint.y + 1.7,
    mundo.stationPoint.z + 7,
  );
const { creature: criatura, echo, escapePoint: puntoEscape } = mundo;
const interactuables = mundo.pickups.filter(
  (malla) => !state.collected.includes(malla.metadata.id),
);
mundo.campfires.forEach((fogata) => interactuables.push(fogata));
mundo.campfires.forEach((fogata) => actualizarFogataVisual(fogata));
mundo.pickups
  .filter((malla) => state.collected.includes(malla.metadata.id))
  .forEach((malla) => malla.dispose());
mundo.traps.forEach((trampa) => {
  if (state.triggeredTraps.includes(trampa.metadata.id)) trampa.setEnabled(false);
});

// Muestra un aviso temporal en pantalla.
function mostrarAviso(texto) {
  const elemento = document.querySelector("#toast");
  elemento.textContent = texto;
  elemento.classList.add("show");
  setTimeout(() => elemento.classList.remove("show"), 3600);
}
const grabacionDaniel =
  "Si encuentras esta grabación, soy Daniel Ortega. Llevo tres días investigando los apagones de la estación de bombeo. La señal me trajo hasta esta cabaña, pero algo en el bosque está usando voces. Encuentra mis pistas, activa la radio al norte y no sigas ninguna voz que salga del río.";
let caracterIntroduccion = 0;
let temporizadorEscrituraIntroduccion = null;
// Reproduce la grabación de voz dejada por Daniel.
function reproducirGrabacionDaniel() {
  if (!("speechSynthesis" in window)) {
    mostrarAviso("Tu navegador no puede reproducir la grabación.");
    return;
  }
  window.speechSynthesis.cancel();
  const voz = new SpeechSynthesisUtterance(grabacionDaniel);
  voz.lang = "es-MX";
  voz.rate = 0.9;
  voz.pitch = 0.84;
  window.speechSynthesis.speak(voz);
}
// Escribe gradualmente el texto narrativo de introducción.
function iniciarMaquinaEscribirIntro() {
  const historia = document.querySelector("#intro-story");
  historia.textContent = "";
  caracterIntroduccion = 0;
  clearInterval(temporizadorEscrituraIntroduccion);
  temporizadorEscrituraIntroduccion = setInterval(() => {
    historia.textContent += grabacionDaniel[caracterIntroduccion++] || "";
    if (caracterIntroduccion >= grabacionDaniel.length) {
      clearInterval(temporizadorEscrituraIntroduccion);
      document.querySelector("#briefing-continue").hidden = false;
    }
  }, 18);
}
// Inicia el briefing narrado antes de entrar al bosque.
function iniciarBriefing() {
  activarAudio();
  const introduccion = document.querySelector("#intro");
  introduccion.classList.add("briefing");
  document.querySelector("#start-button").hidden = true;
  iniciarMaquinaEscribirIntro();
  reproducirGrabacionDaniel();
}
// Cierra la introducción y activa el juego.
function entrarBosque() {
  clearInterval(temporizadorEscrituraIntroduccion);
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  activarAudio();
  document.querySelector("#intro").classList.add("hidden");
}
// Actualiza las barras de salud, energía y hambre.
function actualizarSignosVitales() {
  ["health", "energy", "hunger"].forEach(
    (key) =>
      (document.querySelector(`#${key}-bar`).style.width = `${state[key]}%`),
  );
}
function consumirObjeto(tipo, cantidad = 1) {
  if ((state.inventory[tipo] || 0) < cantidad) return false;
  state.inventory[tipo] -= cantidad;
  if (!state.inventory[tipo]) delete state.inventory[tipo];
  return true;
}
// Aplica consumibles desde mochila sin convertir la supervivencia en una penalización constante.
function usarConsumible(tipo) {
  if (pausado) return;
  const efectos = {
    medkit: ["health", 55, "Usaste un botiquín."],
    bandage: ["health", 25, "Vendaste la herida."],
    cannedFood: ["hunger", 30, "Comiste una conserva."],
    water: ["hunger", 24, "Bebiste agua potable."],
    berries: ["hunger", 18, "Comiste frutas silvestres."],
    cookedMeat: ["hunger", 60, "Comiste carne cocinada. El hambre bajará más despacio durante un rato."],
  };
  if (tipo === "battery") return reemplazarBateria();
  if (tipo === "map") {
    mostrarNota("Rutas seguras: cabaña, torre, refugio del cazador y estación. Una anotación menciona el receptor de campo: cable + herramienta.", "Mapa de rutas");
    return;
  } else {
    const efecto = efectos[tipo];
    if (!efecto) return;
    if (efecto[0] === "hunger" && state.hunger >= 100)
      return mostrarAviso("Estás completamente saciado: la comida queda guardada.");
    if (!consumirObjeto(tipo)) return;
    state[efecto[0]] = Math.min(100, state[efecto[0]] + efecto[1]);
    if (tipo === "cookedMeat") state.satiatedUntil = Date.now() + CONFIG.hambre.duracionBeneficioCarneCocidaSegundos * 1000;
    mostrarAviso(efecto[2]);
  }
  activarAudio();
  reproducirTono("effects", 360, 0.07, 0.045);
  renderizarInventario(state);
  actualizarSignosVitales();
  actualizarIndicadorRifle();
  guardarPartida(state);
}
// Devuelve cuántas notas ha leído el jugador.
function cantidadNotas() {
  return state.readNotes.length;
}
// Actualiza el texto de la misión según el progreso.
function actualizarObjetivo() {
  document.querySelector("#objective").textContent =
    obtenerObjetivo(state.mission.phase, state);
}
// Muestra el porcentaje actual de batería.
function actualizarBateria() {
  document.querySelector("#battery-value").textContent =
    `${Math.ceil(state.battery)}%`;
}
// Actualiza la munición visible del rifle.
function actualizarIndicadorRifle() {
  const tieneRifle = Boolean(state.inventory.rifle);
  document.querySelector("#ammo-hud").hidden = !tieneRifle;
  document.querySelector("#rifle-ammo").textContent = `${state.rifleAmmo} / 3`;
  document.querySelector("#ammo-reserve").textContent =
    `${state.inventory.ammoMagazine || 0} CARGADORES`;
}
// Muestra una respuesta corta de impacto sin bloquear la vista ni los controles.
function mostrarEfectoCombate(tipo) {
  const efecto = document.querySelector("#combat-effect");
  efecto.className = `combat-effect ${tipo}`;
  window.setTimeout(() => {
    if (efecto.classList.contains(tipo)) efecto.className = "combat-effect";
  }, tipo === "shot" ? 140 : 200);
}
// Prioriza el objeto que ocupa el centro de la mira y nunca atraviesa geometría.
function actualizarCercano() {
  cercaSalida =
    !state.chapter2 &&
    state.mission.phase === "radio" &&
    Vector3.Distance(jugador.camera.position, puntoEscape) < 8;
  masCercano = null;
  const esInteractuable = (malla) =>
    interactuables.includes(malla) &&
    !malla.isDisposed() &&
    malla.isEnabled() &&
    malla.isVisible;
  const obtenerRaizInteractuable = (malla) => {
    let actual = malla;
    while (actual) {
      if (esInteractuable(actual)) return actual;
      actual = actual.parent;
    }
    return null;
  };
  const adelante = jugador.camera.getDirection(Vector3.Forward());
  const rayoCentral = new Ray(jugador.camera.position, adelante, CONFIG.interaccion.alcanceMision);
  const impactoCentral = escena.pickWithRay(
    rayoCentral,
    (malla) => malla.isPickable && malla.isEnabled() && malla.isVisible,
  );
  if (impactoCentral?.hit) masCercano = obtenerRaizInteractuable(impactoCentral.pickedMesh);
  if (!masCercano) {
    // Fogatas y transmisores conservan una pequeña ayuda por proximidad, pero solo con línea de visión.
    masCercano = interactuables.find((malla) => {
      if (!esInteractuable(malla) || !["campfire", "transmitter"].includes(malla.metadata.type)) return false;
      const objetivo = malla.getAbsolutePosition().subtract(jugador.camera.position);
      const distancia = objetivo.length();
      if (distancia > CONFIG.interaccion.alcanceMision) return false;
      const impacto = escena.pickWithRay(
        new Ray(jugador.camera.position, objetivo.scale(1 / distancia), distancia + 0.15),
        (mesh) => mesh.isPickable && mesh.isEnabled() && mesh.isVisible,
      );
      return impacto?.hit && obtenerRaizInteractuable(impacto.pickedMesh) === malla;
    }) || null;
  }
  const aviso = document.querySelector("#interaction");
   aviso.textContent = cercaSalida
    ? "[E] ACTIVAR RADIO DE EMERGENCIA"
    : masCercano
       ? `[E] ${masCercano.metadata.type === "campfire" && state.fires[masCercano.metadata.id] ? "DESCANSAR / COCINAR EN FOGATA" : masCercano.metadata.label}`
      : "";
  aviso.classList.toggle("show", cercaSalida || Boolean(masCercano));
}
// Calcula el punto frente al jugador para soltar objetos.
function posicionSoltar() {
  const adelante = jugador.camera.getDirection(Vector3.Forward());
  adelante.y = 0;
  adelante.normalize();
  return jugador.camera.position.add(adelante.scale(1.25));
}
// Crea en el suelo un objeto descartado por el jugador.
function soltarObjeto(tipo, etiqueta, textoNota = "", documentoDescartado = null) {
  const id = `dropped-${tipo}-${Date.now()}`;
  const posicion = posicionSoltar();
  const desplazamiento =
    {
      note: 0.05,
      wood: 0.16,
      battery: 0.36,
      knife: 0.1,
      rifle: 0.12,
       ammoMagazine: 0.15,
    }[tipo] || 0.24;
  posicion.y = mundo.alturaTerreno(posicion.x, posicion.z) + desplazamiento;
  const recogible = crearRecogible(
    escena,
    id,
    tipo,
    posicion,
    etiqueta,
    "Recuperaste el objeto descartado.",
    textoNota,
  );
  recogible.metadata.documentoDescartado = documentoDescartado;
  interactuables.push(recogible);
}
// Abre el lector de notas con un título y contenido.
function mostrarNota(texto, titulo = "Nota de Daniel") {
  notaAbierta = true;
  document.querySelector("#note-title").textContent = titulo;
  document.querySelector("#note-content").innerHTML = texto
    .split("\n\n")
    .map((parrafo) => `<p>${parrafo}</p>`)
    .join("");
  document.querySelector("#note-modal").hidden = false;
}
// Cierra el lector de notas activo.
function cerrarNota() {
  notaAbierta = false;
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  document.querySelector("#note-modal").hidden = true;
}
// Enciende o apaga la linterna según la batería disponible.
function configurarLinterna(activa) {
  const estabaActiva = state.flashlight;
  state.flashlight = Boolean(activa && state.inventory.flashlight && state.battery > 0 && !visionNocturnaActiva);
  const alcanceLargo = state.settings.flashlightMode === "long";
  linterna.intensity = state.flashlight ? (alcanceLargo ? 12 : 8) : 0;
  brilloLinterna.intensity = state.flashlight ? (alcanceLargo ? 0.22 : 0.55) : 0;
  document
    .querySelector("#flashlight-button")
    .classList.toggle("active", state.flashlight);
  if (estabaActiva !== state.flashlight) reproducirSonidoLinterna(state.flashlight);
}
// Alterna el estado de la linterna.
function alternarLinterna() {
  if (!state.inventory.flashlight) return mostrarAviso("Necesitas recoger una linterna.");
  if (state.flashlight) return configurarLinterna(false);
  if (state.battery <= 0) return mostrarAviso("La linterna no tiene batería.");
  configurarLinterna(true);
}
// Alterna entre los haces cercano y lejano de la linterna.
function alternarModoLinterna() {
  state.settings.flashlightMode =
    state.settings.flashlightMode === "wide" ? "long" : "wide";
  document.querySelector("#flashlight-mode").textContent =
    state.settings.flashlightMode === "wide" ? "CERCA" : "LEJOS";
  mostrarAviso(
    state.settings.flashlightMode === "wide"
      ? "Haz amplio activado."
      : "Haz de largo alcance activado.",
  );
  guardarPartida(state);
}
// Alinea las luces de la linterna con la cámara.
function actualizarLinterna() {
  const activa = state.inventory.flashlight && state.flashlight && state.battery > 0 && !visionNocturnaActiva;
  const alcanceLargo = state.settings.flashlightMode === "long";
  linterna.angle = alcanceLargo ? Math.PI / 14 : Math.PI / 5;
  linterna.range = alcanceLargo ? 92 : 42;
  linterna.intensity = activa ? (alcanceLargo ? 11 : 7.5) : 0;
  brilloLinterna.intensity = activa ? 0.12 : 0;
  const adelante = jugador.camera.getDirection(Vector3.Forward());
  linterna.position.copyFrom(jugador.camera.position.add(adelante.scale(0.18)));
  linterna.direction.copyFrom(adelante);
  const puntoHaz = jugador.camera.position.add(adelante.scale(alcanceLargo ? 7 : 4));
  pistaLinterna.position.set(puntoHaz.x, mundo.alturaTerreno(puntoHaz.x, puntoHaz.z) + 0.018, puntoHaz.z);
  pistaLinterna.scaling.set(alcanceLargo ? 1.5 : 1, 1, alcanceLargo ? 2.3 : 1.45);
  pistaLinterna.isVisible = activa;
  brilloLinterna.position.copyFrom(
    jugador.camera.position.add(adelante.scale(0.12)),
  );
  destelloBoca.position.copyFrom(
    jugador.camera.position.add(adelante.scale(0.55)),
  );
  destelloBoca.setEnabled(performance.now() < destelloHasta);
}
function alternarVisionNocturna() {
  if (!state.inventory.binoculars) return mostrarAviso("Necesitas unos binoculares de visión nocturna.");
  visionNocturnaActiva = !visionNocturnaActiva;
  if (visionNocturnaActiva) {
    linternaAntesDeVision = state.flashlight;
    fovAntesDeVision = jugador.camera.fov;
    configurarLinterna(false);
    jugador.camera.fov = fovAntesDeVision * 0.72;
    document.querySelector("#night-vision-overlay").hidden = false;
    mostrarAviso("Visión nocturna activada. La linterna queda apagada.");
  } else {
    jugador.camera.fov = fovAntesDeVision ?? jugador.camera.fov;
    fovAntesDeVision = null;
    document.querySelector("#night-vision-overlay").hidden = true;
    configurarLinterna(linternaAntesDeVision);
    mostrarAviso("Visión nocturna desactivada.");
  }
  document.querySelector("#night-vision-status").hidden = !visionNocturnaActiva;
}
// Alterna la calidad visual y reinicia la escena.
function alternarCalidad() {
  state.settings.quality = state.settings.quality === "high" ? "low" : "high";
  motor.setHardwareScalingLevel(state.settings.quality === "high" ? 1 : 1.5);
  document.querySelector("#quality-button").textContent =
    `CALIDAD: ${state.settings.quality === "high" ? "ALTA" : "BAJA"}`;
  mostrarAviso("Calidad gráfica actualizada.");
}
// Abre la interfaz de inventario.
function abrirMochila() {
  document.querySelector("#inventory").classList.add("open");
}
// La misma tecla abre y cierra la mochila.
function alternarMochila() {
  document.querySelector("#inventory").classList.toggle("open");
}
// Pregunta si se desea reemplazar una batería agotada.
function mostrarAvisoBateria() {
  const modal = document.querySelector("#battery-modal");
  const cantidad = state.inventory.battery || 0;
  document.querySelector("#battery-question").textContent = cantidad
    ? `Tienes ${cantidad} batería${cantidad === 1 ? "" : "s"} en la mochila.`
    : "No tienes baterías en la mochila.";
  document.querySelector("#replace-battery").disabled = !cantidad;
  modal.hidden = false;
}
// Consume una batería del inventario y recarga la linterna.
function reemplazarBateria() {
  if (!state.inventory.battery) return;
  state.inventory.battery--;
  if (!state.inventory.battery) delete state.inventory.battery;
  state.battery = 100;
  configurarLinterna(true);
  document.querySelector("#battery-modal").hidden = true;
  renderizarInventario(state);
  guardarPartidaActual();
  mostrarAviso("Instalaste una batería nueva.");
}
// Cierra la interfaz de inventario.
function cerrarMochila() {
  document.querySelector("#inventory").classList.remove("open");
}
// Detiene o reanuda las actualizaciones del juego.
function alternarPausa() {
  pausado = !pausado;
  document.querySelector("#pause-modal").hidden = !pausado;
  if (pausado) {
    document.querySelector("#settings-panel").hidden = true;
    document.querySelector("#pause-actions").hidden = false;
  }
  if (pausado && controlesCamaraAdjuntos) {
    jugador.camera.detachControl();
    controlesCamaraAdjuntos = false;
  } else if (!pausado && !controlesCamaraAdjuntos) {
    jugador.camera.attachControl(lienzo, true);
    controlesCamaraAdjuntos = true;
  }
  if (gananciaPrincipal && contextoAudio) {
    gananciaPrincipal.gain.setTargetAtTime(
      pausado ? 0 : state.settings.audio.master,
      contextoAudio.currentTime,
      0.03,
    );
    if (pausado) contextoAudio.suspend().catch(() => {});
    else contextoAudio.resume().catch(() => {});
  }
  if ("speechSynthesis" in window) {
    if (pausado) window.speechSynthesis.pause();
    else window.speechSynthesis.resume();
  }
  teclasPulsadas.clear();
  Object.keys(entradaTactil).forEach((tecla) => (entradaTactil[tecla] = false));
  document.querySelector("#pause-button").textContent = pausado
    ? "CONTINUAR [P]"
    : "PAUSA [P]";
  mostrarAviso(pausado ? "Juego en pausa. Pulsa P para continuar." : "Juego reanudado.");
}
function actualizarAjustes() {
  const sensibilidad = Math.round(state.settings.sensitivity * 100);
  const volumen = Math.round(state.settings.audio.master * 100);
  document.querySelector("#sensitivity-setting").value = sensibilidad;
  document.querySelector("#sensitivity-value").textContent = `${sensibilidad}%`;
  document.querySelector("#volume-setting").value = volumen;
  document.querySelector("#volume-value").textContent = `${volumen}%`;
}
function cambiarSensibilidad(valor) {
  state.settings.sensitivity = Number(valor) / 100;
  jugador.camera.angularSensibility = 3800 / state.settings.sensitivity;
  actualizarAjustes();
  guardarPartida(state);
}
function cambiarVolumen(valor) {
  state.settings.audio.master = Number(valor) / 100;
  if (gananciaPrincipal && contextoAudio)
    gananciaPrincipal.gain.setTargetAtTime(
      pausado ? 0 : state.settings.audio.master,
      contextoAudio.currentTime,
      0.03,
    );
  actualizarAjustes();
  guardarPartida(state);
}
// Guarda el progreso actual de forma manual.
function guardarPartidaActual() {
  guardarPartida(state);
  mostrarAviso("Partida guardada en este dispositivo.");
}
// Actualiza la posición del jugador y del objetivo en los mapas.
function actualizarMinimapa() {
  const limitar = (valor) => Math.max(8, Math.min(92, valor));
  const izquierda = `${limitar(50 - jugador.camera.position.x * 0.19)}%`;
  const arriba = `${limitar(50 + jugador.camera.position.z * 0.19)}%`;
  ["#player-marker", "#world-player-marker"].forEach((selector) => {
    const marcador = document.querySelector(selector);
    marcador.style.left = izquierda;
    marcador.style.top = arriba;
  });
  const puntoObjetivo = obtenerPuntoObjetivo(state.mission.phase);
  ["#objective-marker", "#world-objective-marker"].forEach((selector) => {
    const marcador = document.querySelector(selector);
    marcador.hidden = !puntoObjetivo;
    if (puntoObjetivo) {
      marcador.style.left = `${limitar(50 - puntoObjetivo[0] * 0.19)}%`;
      marcador.style.top = `${limitar(50 + puntoObjetivo[1] * 0.19)}%`;
    }
  });
}
// Gestiona la progresión de misiones y los objetos recogibles.
function interactuar() {
  if (pausado) return;
  if (notaAbierta) return;
  if (cercaSalida) {
    if (!state.inventory.radioFuse)
      return mostrarAviso("La radio necesita el fusible de radio.");
    state.inventory.radioFuse--;
    if (!state.inventory.radioFuse) delete state.inventory.radioFuse;
    state.chapter2 = true;
    state.mission.phase = "find-card";
    renderizarInventario(state);
    guardarPartida(state);
    mundo.pickups
      .filter((recogible) => recogible.metadata.chapter === 2)
      .forEach((recogible) => recogible.setEnabled(true));
    jugador.camera.position.set(
      mundo.stationPoint.x,
      mundo.stationPoint.y + 1.7,
      mundo.stationPoint.z + 7,
    );
    jugador.camera.rotation.set(0, Math.PI, 0);
    actualizarObjetivo();
    activarAudio();
    reproducirTono("effects", 680, 0.24, 0.08);
    mostrarAviso("La radio responde. Capítulo II: entra en la estación de bombeo.");
    return;
  }
  if (
    !masCercano ||
    (masCercano.metadata.chapter === 2 && !state.chapter2)
  )
    return;
  const {
    id,
    type: tipo,
    label: etiqueta,
    message: mensaje,
    noteText: textoNota,
  } = masCercano.metadata;
  if (tipo === "campfire") {
    if (!state.fires[id]) {
      if (!consumirObjeto("wood")) return mostrarAviso("Necesitas 1 leña para encender esta fogata.");
      state.fires[id] = true;
      actualizarFogataVisual(masCercano);
      renderizarInventario(state);
      guardarPartida(state);
      activarAudio();
      reproducirRuido(0.18, 0.05, 650);
      return mostrarAviso("La fogata ilumina el refugio. La criatura evita su luz.");
    }
    if (state.inventory.rawMeat) {
      consumirObjeto("rawMeat");
      agregarObjeto(state, "cookedMeat");
      renderizarInventario(state);
      guardarPartida(state);
      return mostrarAviso("Cocinaste carne de caza. Úsala desde la mochila cuando tengas hambre.");
    }
    state.energy = Math.min(100, state.energy + 24);
    state.health = Math.min(100, state.health + 8);
    if (state.inventory.cannedFood && state.hunger < 100 && consumirObjeto("cannedFood")) {
      state.hunger = Math.min(100, state.hunger + 52);
      mostrarAviso("Descansaste y calentaste una conserva.");
    } else mostrarAviso("Descansaste al calor de la fogata.");
    renderizarInventario(state);
    actualizarSignosVitales();
    guardarPartida(state);
    return;
  }
  if (tipo === "loreDocument") {
    state.collected.push(id);
    state.documents.push({ id, title: etiqueta, text: textoNota });
    agregarObjeto(state, "note");
    state.journal.push(`Archivaste: ${etiqueta}.`);
    masCercano.dispose(); masCercano = null;
    renderizarInventario(state); renderizarBitacora(state); guardarPartida(state);
    return mostrarNota(textoNota, etiqueta);
  }
  if (tipo === "note" && masCercano.metadata.documentoDescartado) {
    const documento = masCercano.metadata.documentoDescartado;
    state.documents.push(documento);
    agregarObjeto(state, "note");
    state.collected.push(id);
    masCercano.dispose(); masCercano = null;
    renderizarInventario(state); guardarPartida(state);
    return mostrarNota(documento.text, documento.title);
  }
  if (tipo === "receiver") {
    if (state.receiverRepaired) return mostrarAviso("El receptor ya emite la frecuencia anotada en el mapa.");
    if (!state.inventory.tool || !state.inventory.cable) return mostrarAviso("Falta conectar cable y ajustar la carcasa: necesitas cable + herramienta.");
    consumirObjeto("tool");
    consumirObjeto("cable");
    state.receiverRepaired = true;
    state.journal.push("Reparaste el receptor: la frecuencia repite una coordenada que coincide con la torre.");
    renderizarInventario(state); renderizarBitacora(state); guardarPartida(state);
    activarAudio(); reproducirTono("effects", 520, 0.18, 0.06);
    return mostrarAviso("Receptor reparado. La señal aclara una pista opcional.");
  }
  if (tipo === "supplyCrate") {
    if (state.crateUnlocked) return mostrarAviso("La caja de suministros ya está vacía.");
    if (!consumirObjeto("key")) return mostrarAviso("La caja tiene una cerradura simple: busca su llave en el refugio.");
    state.crateUnlocked = true;
    agregarObjeto(state, "cannedFood", 2); agregarObjeto(state, "bandage", 2); agregarObjeto(state, "ammoMagazine");
    renderizarInventario(state); guardarPartida(state);
    return mostrarAviso("Abriste la caja: conserva, vendas y un cargador.");
  }
  if (tipo === "cassette") {
    mostrarNota(grabacionDaniel, "Grabación de Daniel");
    reproducirGrabacionDaniel();
    return;
  }
  if (tipo === "telescope") {
    if (!state.telescopeObserved) {
      state.telescopeObserved = true;
      state.journal.push("Desde el telescopio, la estación de bombeo queda al noroeste; Valleverde se abre hacia el oeste, tras el río.");
      renderizarBitacora(state);
      guardarPartida(state);
    }
    return mostrarNota("Al noroeste, una luz fría pulsa sobre la estación de bombeo. Más al oeste, las calles de Valleverde quedan ocultas tras el río. Daniel anotó: «No sigas el agua de noche».", "Observación del refugio");
  }
  if (tipo === "radioFuse" && state.mission.phase !== "radio-fuse")
    return mostrarAviso("Sigue las pistas de Daniel antes de buscar el fusible.");
  if (tipo === "card" && state.mission.phase !== "find-card")
    return mostrarAviso("La estación aún no forma parte de tu misión.");
  if (
    tipo === "industrialFuse" &&
    !["industrial-fuses", "generator"].includes(state.mission.phase)
  )
    return mostrarAviso("Primero encuentra la tarjeta de seguridad.");
  if (tipo === "generator") {
    if (!state.inventory.card)
      return mostrarAviso("El panel requiere la tarjeta de seguridad.");
    if ((state.inventory.industrialFuse || 0) < 3)
      return mostrarAviso("El panel necesita tres fusibles industriales.");
    state.inventory.industrialFuse -= 3;
    if (!state.inventory.industrialFuse) delete state.inventory.industrialFuse;
    state.stationPowered = true;
    state.mission.phase = "station-transmitter";
    state.collected.push(id);
    masCercano.dispose();
    masCercano = null;
    actualizarObjetivo();
    renderizarInventario(state);
    guardarPartida(state);
    return mostrarAviso(mensaje);
  }
  if (tipo === "transmitter") {
    const siguientes = { "station-transmitter": "signal-1", "signal-1": "signal-2", "signal-2": "signal-3", "signal-3": "hospital-file" };
    if (id === "station-transmitter" && state.mission.phase !== "station-transmitter")
      return mostrarAviso("Primero restablece la energía de la estación.");
    if (id !== "station-transmitter" && state.mission.phase !== id)
      return mostrarAviso("Esta señal no es la transmisión que estás siguiendo.");
    state.collected.push(id);
    masCercano.dispose();
    masCercano = null;
    state.mission.phase = siguientes[state.mission.phase];
    if (id === "station-transmitter") {
      state.chapter2Finished = true;
      state.chapter3 = true;
      state.journal.push("El transmisor imitaba a Daniel. La señal auténtica conduce a Valleverde.");
    }
    if (id === "signal-3") {
      state.chapter4 = true;
      state.journal.push("Daniel investigaba los apagones desde antes de desaparecer. El hospital guarda los expedientes.");
    }
    renderizarBitacora(state);
    actualizarObjetivo();
    actualizarObjetosCapitulo();
    guardarPartida(state);
    return mostrarAviso(mensaje);
  }
  if (tipo === "document") {
    const siguientes = { "hospital-file": "police-file", "police-file": "gas-record", "gas-record": "cave-entry" };
    if (state.mission.phase !== id) return mostrarAviso("Sigue el orden de los expedientes de Valleverde.");
    state.collected.push(id);
    masCercano.dispose();
    masCercano = null;
    state.mission.phase = siguientes[id];
    if (id === "gas-record") {
      state.chapter5 = true;
      state.journal.push("El registro revela la entrada de servicio bajo el río.");
    }
    state.journal.push(mensaje);
    renderizarBitacora(state);
    actualizarObjetivo();
    actualizarObjetosCapitulo();
    guardarPartida(state);
    return mostrarNota(mensaje, etiqueta);
  }
  if (tipo === "serviceDoor" || tipo === "valve") {
    const faseEsperada = tipo === "serviceDoor" ? "cave-entry" : "cave-valve";
    if (state.mission.phase !== faseEsperada) return mostrarAviso("Aún no tienes la ruta segura hacia este mecanismo.");
    state.collected.push(id);
    masCercano.dispose();
    masCercano = null;
    state.mission.phase = tipo === "serviceDoor" ? "cave-valve" : "cave-daniel";
    if (tipo === "valve") state.journal.push("La válvula baja el nivel del agua. Las cámaras profundas quedan accesibles.");
    actualizarObjetivo();
    renderizarBitacora(state);
    guardarPartida(state);
    return mostrarAviso(mensaje);
  }
  if (tipo === "daniel") {
    if (state.mission.phase !== "cave-daniel") return mostrarAviso("Daniel sigue más adentro, tras la válvula de seguridad.");
    state.collected.push(id);
    masCercano.dispose();
    masCercano = null;
    state.chapter6 = true;
    state.mission.phase = "final-panel";
    state.journal.push("Encontraste a Daniel vivo. Juntos volverán al panel final de la estación.");
    renderizarBitacora(state);
    actualizarObjetivo();
    actualizarObjetosCapitulo();
    guardarPartida(state);
    return mostrarNota("Daniel está herido, pero consciente. La luz continua mantiene a la criatura en las cámaras profundas. Activa el panel final de la estación y abre la compuerta exterior.", "Daniel Ortega");
  }
  if (tipo === "finalPanel") {
    if (state.mission.phase !== "final-panel") return mostrarAviso("Daniel debe ayudarte a cerrar el ciclo de bombeo.");
    state.collected.push(id);
    masCercano.dispose();
    masCercano = null;
    state.mission.phase = "epilogue";
    escapo = true;
    state.journal.push("Las bombas, las luces y las compuertas sellan la caverna. Daniel alcanza la carretera contigo.");
    renderizarBitacora(state);
    actualizarObjetivo();
    guardarPartida(state);
    document.querySelector("#ending-content").innerHTML = "<p>Al amanecer, una unidad de rescate llega al límite del bosque. Daniel entrega los expedientes: las bombas siguen funcionando y la caverna queda sellada.</p><p>Desde el vehículo, una luz verde se enciende una vez bajo el río. La radio emite estática y, aunque Daniel calla, su voz susurra: «No sigas mi voz.»</p>";
    document.querySelector("#ending-kicker").textContent = "EPÍLOGO: LA ÚLTIMA SEÑAL";
    document.querySelector("#restart-game").textContent = "REINICIAR HISTORIA";
    document.querySelector("#next-chapter").hidden = true;
    document.querySelector("#ending-modal").hidden = false;
    return mostrarAviso(mensaje);
  }
  if (tipo === "note") {
    const orden = ["note-1", "note-2", "note-4"];
    if (id === state.mission.phase) {
      if (!state.readNotes.includes(id)) {
        state.readNotes.push(id);
        state.journal.push("La pista confirma tu siguiente destino.");
      }
      state.mission.phase = orden[orden.indexOf(id) + 1] || "radio-fuse";
      actualizarObjetivo();
      renderizarBitacora(state);
      guardarPartida(state);
    } else if (!state.readNotes.includes(id)) {
      state.readNotes.push(id);
      state.journal.push("Leíste una nota de Daniel.");
      renderizarBitacora(state);
      guardarPartida(state);
      mostrarAviso("Esta nota aporta contexto, pero sigue la misión indicada.");
    }
    return mostrarNota(textoNota, etiqueta);
  }
  if (tipo === "battery" && state.battery <= 0) {
    state.battery = 100;
    configurarLinterna(true);
    state.collected.push(id);
    masCercano.dispose();
    masCercano = null;
    document.querySelector("#battery-modal").hidden = true;
    guardarPartida(state);
    actualizarBateria();
    return mostrarAviso("Instalaste la batería y encendiste la linterna.");
  }
   const cantidad = 1;
  if (pesoInventario(state) + cantidad > 12)
    return mostrarAviso("La mochila está llena. No puedes cargar más objetos.");
  if (tipo === "rifle") {
    agregarObjeto(state, "rifle");
    state.rifleAmmo = 3;
    if (!state.inventory.knife) state.equippedWeapon = "rifle";
  } else {
    agregarObjeto(state, tipo);
    if (tipo === "knife") state.equippedWeapon = "knife";
  }
  if (tipo === "flashlight") {
    state.flashlightAcquired = true;
    configurarLinterna(true);
  }
  if (tipo === "radioFuse") state.mission.phase = "radio";
  if (tipo === "card") state.mission.phase = "industrial-fuses";
  if (tipo === "industrialFuse" && (state.inventory.industrialFuse || 0) >= 3)
    state.mission.phase = "generator";
  state.collected.push(id);
  masCercano.dispose();
  masCercano = null;
  actualizarObjetivo();
  renderizarInventario(state);
  renderizarBitacora(state);
  actualizarIndicadorRifle();
  actualizarArmaEquipada();
  guardarPartida(state);
   activarAudio();
   reproducirTono("effects", 580, 0.06, 0.04);
   mostrarAviso(
    tipo === "rifle" ? "Encontraste el rifle con 3 balas cargadas." : mensaje,
  );
}
// Elimina un objeto del inventario y lo deja en el suelo.
function descartarObjeto(tipo) {
  if (pausado) return;
  if (!state.inventory[tipo]) return;
  if (["radioFuse", "industrialFuse", "card", "key", "tool", "cable", "knife", "rifle"].includes(tipo))
    return mostrarAviso("No puedes tirar un objeto necesario para la misión.");
  const etiqueta =
    tipo === "wood"
      ? "Ramas secas"
      : tipo === "berries"
        ? "Bayas oscuras"
        : tipo === "ammoMagazine"
          ? "Cargador de rifle"
        : "Batería de linterna";
  state.inventory[tipo]--;
  if (!state.inventory[tipo]) delete state.inventory[tipo];
  if (tipo === state.equippedWeapon && !state.inventory[tipo]) {
    state.equippedWeapon = state.inventory.knife ? "knife" : "rifle";
    actualizarArmaEquipada();
  }
  soltarObjeto(tipo, etiqueta);
  renderizarInventario(state);
  guardarPartida(state);
  mostrarAviso("El objeto quedó en el suelo junto a ti.");
}
// Descarta una nota guardada y la devuelve al mundo.
function descartarNota(id) {
  const indice = state.documents.findIndex((documento) => documento.id === id);
  if (indice < 0) return;
  const [documento] = state.documents.splice(indice, 1);
  state.inventory.note--;
  if (!state.inventory.note) delete state.inventory.note;
  soltarObjeto("note", documento.title, documento.text, documento);
  renderizarInventario(state);
  guardarPartida(state);
  mostrarAviso("La nota quedó en el suelo junto a ti.");
}
// Convierte teclado y controles táctiles en movimiento del jugador.
function estadoEntrada() {
  return {
    forward:
      entradaTactil.forward ||
      teclasPulsadas.has("KeyW") ||
      teclasPulsadas.has("ArrowUp"),
    back:
      entradaTactil.back ||
      teclasPulsadas.has("KeyS") ||
      teclasPulsadas.has("ArrowDown"),
    left:
      entradaTactil.left ||
      teclasPulsadas.has("KeyA") ||
      teclasPulsadas.has("ArrowLeft"),
    right:
      entradaTactil.right ||
      teclasPulsadas.has("KeyD") ||
      teclasPulsadas.has("ArrowRight"),
    run:
      state.energy > 0 &&
      (entradaTactil.run ||
        teclasPulsadas.has("ShiftLeft") ||
        teclasPulsadas.has("ShiftRight")),
    crouch:
      entradaTactil.crouch ||
      teclasPulsadas.has("KeyC"),
    jump: entradaTactil.jump || teclasPulsadas.has("Space"),
  };
}
// Inicializa el contexto y las fuentes de audio ambiental.
function activarAudio() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  contextoAudio ||= new AudioContext();
  if (!pausado) contextoAudio.resume().catch(() => {});
  if (!gananciaPrincipal) {
    gananciaPrincipal = contextoAudio.createGain();
     gananciaPrincipal.gain.value = pausado ? 0 : state.settings.audio.master;
     gananciaPrincipal.connect(contextoAudio.destination);
     ["effects", "ambient", "music"].forEach((categoria) => {
       const gain = contextoAudio.createGain();
       gain.gain.value = state.settings.audio[categoria];
       gain.connect(gananciaPrincipal);
       gananciasAudio[categoria] = gain;
     });
  }
  if (!gananciaViento) {
    const viento = contextoAudio.createOscillator();
    gananciaViento = contextoAudio.createGain();
    viento.type = "sine";
    viento.frequency.value = 47;
    gananciaViento.gain.value = 0.008;
     viento.connect(gananciaViento).connect(gananciasAudio.ambient);
    viento.start();
    const agua = contextoAudio.createOscillator();
    gananciaAgua = contextoAudio.createGain();
    agua.type = "triangle";
    agua.frequency.value = 92;
    gananciaAgua.gain.value = 0;
     agua.connect(gananciaAgua).connect(gananciasAudio.ambient);
    agua.start();
  }
}
// Punto único para tonos UI, interacción y señales; no depende de archivos externos.
function reproducirTono(categoria, frecuencia, duracion, volumen) {
  if (!contextoAudio || !gananciasAudio[categoria]) return;
  const oscilador = contextoAudio.createOscillator();
  const ganancia = contextoAudio.createGain();
  oscilador.type = "triangle";
  oscilador.frequency.value = frecuencia;
  ganancia.gain.setValueAtTime(volumen, contextoAudio.currentTime);
  ganancia.gain.exponentialRampToValueAtTime(0.001, contextoAudio.currentTime + duracion);
  oscilador.connect(ganancia).connect(gananciasAudio[categoria]);
  oscilador.start(); oscilador.stop(contextoAudio.currentTime + duracion);
}
// Reproduce un ruido breve filtrado con Web Audio.
function reproducirRuido(duracion, volumen, corte) {
  if (!contextoAudio) return;
  const buffer = contextoAudio.createBuffer(1, contextoAudio.sampleRate * duracion, contextoAudio.sampleRate);
  const muestras = buffer.getChannelData(0);
  for (let i = 0; i < muestras.length; i++) muestras[i] = Math.random() * 2 - 1;
  const fuente = contextoAudio.createBufferSource();
  const filtro = contextoAudio.createBiquadFilter();
  const ganancia = contextoAudio.createGain();
  fuente.buffer = buffer;
  filtro.type = "lowpass";
  filtro.frequency.value = corte;
  ganancia.gain.setValueAtTime(volumen, contextoAudio.currentTime);
  ganancia.gain.exponentialRampToValueAtTime(0.001, contextoAudio.currentTime + duracion);
   fuente.connect(filtro).connect(ganancia).connect(gananciasAudio.effects || gananciaPrincipal);
  fuente.start();
}
// Reproduce el sonido de encender o apagar la linterna.
function reproducirSonidoLinterna(activa) {
  if (!contextoAudio) return;
  const oscilador = contextoAudio.createOscillator();
  const ganancia = contextoAudio.createGain();
  oscilador.type = "square";
  oscilador.frequency.setValueAtTime(
    activa ? 480 : 210,
    contextoAudio.currentTime,
  );
  oscilador.frequency.exponentialRampToValueAtTime(
    activa ? 780 : 95,
    contextoAudio.currentTime + 0.08,
  );
  ganancia.gain.setValueAtTime(0.035, contextoAudio.currentTime);
  ganancia.gain.exponentialRampToValueAtTime(0.001, contextoAudio.currentTime + 0.1);
   oscilador.connect(ganancia).connect(gananciasAudio.effects || gananciaPrincipal);
  oscilador.start();
  oscilador.stop(contextoAudio.currentTime + 0.11);
}
// Ajusta los sonidos ambientales según la posición.
function actualizarAmbiente() {
  if (!contextoAudio || !gananciaAgua) return;
  const cercaRio =
    Vector3.Distance(jugador.camera.position, new Vector3(150, 0, -175)) < 42;
  gananciaAgua.gain.setTargetAtTime(
    cercaRio ? 0.045 : 0,
    contextoAudio.currentTime,
    0.4,
  );
  if (cercaRio && contextoAudio.currentTime >= proximoSonidoRio) {
    proximoSonidoRio = contextoAudio.currentTime + 1.3;
    reproducirRuido(0.7, 0.018, 850);
  }
}
// Shifts the existing fog and moonlight around the river and industrial site.
function actualizarAtmosfera() {
  const posicion = jugador.camera.position;
  const cercaAgua = Vector3.Distance(posicion, new Vector3(150, 0, -175)) < 52;
  const cercaEstacion = Vector3.Distance(posicion, mundo.stationPoint) < 38;
  escena.fogDensity = cercaAgua ? 0.029 : cercaEstacion ? 0.017 : 0.021;
  escena.fogColor.copyFrom(
    cercaAgua
      ? new Color3(0.035, 0.12, 0.13)
      : cercaEstacion
        ? new Color3(0.055, 0.12, 0.12)
        : new Color3(0.045, 0.11, 0.11),
  );
  luzCielo.intensity = cercaEstacion ? 0.7 : 0.62;
  luna.intensity = cercaAgua ? 0.68 : 0.82;
}
// Routes creature sounds toward its approximate screen side and fades them by distance.
function conectarSonidoCriatura(nodo, ganancia, distancia) {
  const adelante = jugador.camera.getDirection(Vector3.Forward());
  const lateral = criatura.position.subtract(jugador.camera.position);
  lateral.y = 0;
  const longitud = lateral.length() || 1;
  lateral.scaleInPlace(1 / longitud);
  const paneo = Math.max(-0.85, Math.min(0.85, adelante.z * lateral.x - adelante.x * lateral.z));
  ganancia.gain.value *= Math.max(0.18, 1 - distancia / 58);
  if (contextoAudio.createStereoPanner) {
    const panner = contextoAudio.createStereoPanner();
    panner.pan.value = paneo;
    nodo.connect(ganancia).connect(panner).connect(gananciaPrincipal);
  } else nodo.connect(ganancia).connect(gananciaPrincipal);
}
// Reproduce la señal sonora de la criatura cercana.
function reproducirSonidoCriatura(distancia = 20) {
  if (!contextoAudio) return;
  const oscilador = contextoAudio.createOscillator();
  const ganancia = contextoAudio.createGain();
  oscilador.type = "sawtooth";
  oscilador.frequency.setValueAtTime(72, contextoAudio.currentTime);
  oscilador.frequency.exponentialRampToValueAtTime(
    32,
    contextoAudio.currentTime + 0.45,
  );
  ganancia.gain.setValueAtTime(0.04, contextoAudio.currentTime);
  ganancia.gain.exponentialRampToValueAtTime(0.001, contextoAudio.currentTime + 0.5);
  conectarSonidoCriatura(oscilador, ganancia, distancia);
  oscilador.start();
  oscilador.stop(contextoAudio.currentTime + 0.52);
}
// Gives the primitive creature a readable gait without altering its root mesh.
function animarCriatura(delta, moviendose) {
  const { limbs } = criatura.metadata;
  if (!limbs) return;
  criatura.metadata.walkPhase += delta * (moviendose ? 9 : 2.3);
  const balanceo = Math.sin(criatura.metadata.walkPhase) * (moviendose ? 0.62 : 0.08);
  limbs[0].rotation.z = 0.16 + balanceo;
  limbs[1].rotation.z = -0.16 - balanceo;
  limbs[2].rotation.z = -balanceo * 0.58;
  limbs[3].rotation.z = balanceo * 0.58;
}
// Reproduce pasos a la cadencia del movimiento.
function actualizarPasos(controles) {
  const moviendo =
    controles.forward || controles.back || controles.left || controles.right;
  if (
    !contextoAudio ||
    contextoAudio.state !== "running" ||
    !moviendo ||
    notaAbierta ||
    escapo ||
    contextoAudio.currentTime < proximoPaso
  )
    return;
  const corriendo = controles.run;
  proximoPaso = contextoAudio.currentTime + (corriendo ? 0.27 : 0.46);
  reproducirRuido(0.075, corriendo ? 0.045 : 0.027, corriendo ? 420 : 300);
  const oscilador = contextoAudio.createOscillator();
  const ganancia = contextoAudio.createGain();
  oscilador.type = "triangle";
  oscilador.frequency.value = corriendo ? 102 : 63;
  ganancia.gain.setValueAtTime(corriendo ? 0.055 : 0.028, contextoAudio.currentTime);
  ganancia.gain.exponentialRampToValueAtTime(
    0.001,
    contextoAudio.currentTime + 0.09,
  );
  oscilador.connect(ganancia).connect(gananciaPrincipal);
  oscilador.start();
  oscilador.stop(contextoAudio.currentTime + 0.1);
}
// Cambia un cargador completo para no crear ni perder cartuchos sueltos.
function recargarRifle() {
  if (pausado) return;
  if (!state.inventory.rifle)
    return mostrarAviso("Necesitas encontrar el rifle de caza.");
  if (state.rifleAmmo) return mostrarAviso("Termina el cargador antes de cambiarlo.");
  if (!consumirObjeto("ammoMagazine")) return mostrarAviso("No tienes cargadores de rifle.");
  state.rifleAmmo = 3;
  activarAudio();
  reproducirSonidoRecarga();
  renderizarInventario(state);
  actualizarIndicadorRifle();
  guardarPartida(state);
  mostrarAviso("Cargador instalado: 3 balas.");
}
// Reproduce el sonido mecánico de recargar el rifle.
function reproducirSonidoRecarga() {
  if (!contextoAudio) return;
  [0, 0.12].forEach((retraso, indice) => {
    const oscilador = contextoAudio.createOscillator();
    const ganancia = contextoAudio.createGain();
    oscilador.type = "square";
    oscilador.frequency.setValueAtTime(
      indice ? 170 : 250,
      contextoAudio.currentTime + retraso,
    );
    ganancia.gain.setValueAtTime(0.075, contextoAudio.currentTime + retraso);
    ganancia.gain.exponentialRampToValueAtTime(
      0.001,
      contextoAudio.currentTime + retraso + 0.09,
    );
    oscilador.connect(ganancia).connect(gananciaPrincipal);
    oscilador.start(contextoAudio.currentTime + retraso);
    oscilador.stop(contextoAudio.currentTime + retraso + 0.1);
  });
}
// Ataca a la criatura con el cuchillo cuando está al alcance.
function usarCuchillo() {
  if (!state.inventory.knife)
    return mostrarAviso("Necesitas encontrar el cuchillo de monte.");
  const ahora = performance.now();
  if (ahora - ultimoDisparo < 500) return;
  ultimoDisparo = ahora;
  mostrarEfectoCombate("slash");
  activarAudio();
  reproducirRuido(0.06, 0.08, 1250);
  const adelante = jugador.camera.getDirection(Vector3.Forward());
  const presa = mundo.animals.find((animal) => {
    const hacia = animal.position.subtract(jugador.camera.position);
    return !animal.metadata.dead && ["deer", "fox"].includes(animal.metadata.type) && hacia.length() < 3.4 && Vector3.Dot(adelante, hacia.normalize()) > 0.25;
  });
  if (presa) return herirAnimal(presa, 1, "El animal se aleja herido.");
  const objetivo = criatura.position.subtract(jugador.camera.position);
  const distancia = objetivo.length();
  if (
    criatura.isVisible &&
    distancia < 3.4 &&
    Vector3.Dot(adelante, objetivo.normalize()) > 0.35
  ) {
    saludCriatura--;
    if (saludCriatura <= 0) {
      criatura.metadata.disabledUntil = ahora + 18000;
      criatura.isVisible = false;
      criatura.metadata.alerted = false;
      return mostrarAviso("La criatura cayó. Tienes unos segundos.");
    }
    criatura.metadata.alerted = true;
    return mostrarAviso(`Cuchillazo. La criatura resiste (${saludCriatura}/3).`);
  }
  mostrarAviso("El cuchillo corta el aire.");
}
function herirAnimal(animal, dano, aviso) {
  animal.metadata.health -= dano;
  if (animal.metadata.health > 0) return mostrarAviso(`${aviso} (${animal.metadata.health}/5)`);
  animal.metadata.dead = true;
  animal.setEnabled(false);
  state.killedWildlife.push(animal.metadata.id);
  const id = `meat-${animal.metadata.id}`;
  const loot = crearRecogible(escena, id, "rawMeat", animal.position.clone(), "Carne cruda de caza", "Recogiste carne cruda; cocínala en una fogata encendida.");
  interactuables.push(loot);
  guardarPartida(state);
  mostrarAviso("La presa cayó. Dejó carne cruda para cocinar.");
}
// Consume un botiquín y recupera salud.
function usarBotiquin() {
  usarConsumible("medkit");
}
// Dispara el rifle y ahuyenta a la criatura si está cerca.
function dispararRifle() {
  if (!state.inventory.rifle)
    return mostrarAviso("Necesitas encontrar el rifle de caza.");
  if (!state.rifleAmmo) return mostrarAviso("Rifle vacío. Pulsa R para instalar un cargador.");
  const ahora = performance.now();
  if (ahora - ultimoDisparo < 450) return;
  ultimoDisparo = ahora;
  state.rifleAmmo--;
  mostrarEfectoCombate("shot");
  actualizarIndicadorRifle();
  guardarPartida(state);
  destelloHasta = ahora + 70;
  activarAudio();
  if (contextoAudio) {
    reproducirRuido(0.16, 0.22, 2300);
    const oscilador = contextoAudio.createOscillator();
    const ganancia = contextoAudio.createGain();
    oscilador.type = "sawtooth";
    oscilador.frequency.setValueAtTime(140, contextoAudio.currentTime);
    oscilador.frequency.exponentialRampToValueAtTime(
      45,
      contextoAudio.currentTime + 0.14,
    );
    ganancia.gain.setValueAtTime(0.2, contextoAudio.currentTime);
    ganancia.gain.exponentialRampToValueAtTime(
      0.001,
      contextoAudio.currentTime + 0.16,
    );
  oscilador.connect(ganancia).connect(gananciaPrincipal);
    oscilador.start();
    oscilador.stop(contextoAudio.currentTime + 0.17);
  }
  const adelante = jugador.camera.getDirection(Vector3.Forward());
  const presa = mundo.animals.find((animal) => {
    const hacia = animal.position.subtract(jugador.camera.position);
    return !animal.metadata.dead && ["deer", "fox"].includes(animal.metadata.type) && hacia.length() < 35 && Vector3.Dot(adelante, hacia.normalize()) > 0.88;
  });
  if (presa) {
    herirAnimal(presa, 5, "Impacto de rifle.");
    return;
  }
  const objetivo = criatura.position.subtract(jugador.camera.position);
  const distancia = objetivo.length();
  if (
    criatura.isVisible &&
    distancia < 30 &&
    Vector3.Dot(adelante, objetivo.normalize()) > 0.9
  ) {
    saludCriatura--;
    if (saludCriatura <= 0) {
      criatura.metadata.disabledUntil = ahora + 18000;
      criatura.isVisible = false;
      criatura.metadata.alerted = false;
      mostrarAviso("La criatura cayó. Tienes unos segundos.");
    } else {
      criatura.metadata.alerted = true;
      mostrarAviso(`Impacto. La criatura resiste (${saludCriatura}/3).`);
    }
  } else {
    criatura.metadata.alerted = true;
    mostrarAviso(`El disparo resonó. Cargador: ${state.rifleAmmo}/3.`);
  }
}
function usarArmaEquipada() {
  if (state.equippedWeapon === "rifle") return dispararRifle();
  if (state.equippedWeapon === "knife") return usarCuchillo();
  mostrarAviso("No tienes un arma equipada.");
}
// Wildlife is deliberately sparse and stays in clear areas away from objectives.
function actualizarFauna(delta) {
  const tiempo = performance.now() * 0.001;
  mundo.animals.forEach((animal) => {
    if (state.killedWildlife.includes(animal.metadata.id)) {
      animal.metadata.dead = true; animal.setEnabled(false); return;
    }
    const { type, home, phase } = animal.metadata;
    const radio = type === "deer" ? 4 : type === "fox" ? 3 : type === "bat" ? 5 : 2;
    if (type === "firefly") {
      animal.position.set(home.x + Math.cos(tiempo + phase) * radio, home.y + Math.sin(tiempo * 2 + phase) * 0.65, home.z + Math.sin(tiempo + phase) * radio);
    } else if (type === "bat") {
      animal.position.set(home.x + Math.cos(tiempo * 1.4 + phase) * radio, home.y + 3 + Math.sin(tiempo * 3 + phase), home.z + Math.sin(tiempo * 1.4 + phase) * radio);
    } else if (!animal.metadata.dead) {
      const x = home.x + Math.cos(tiempo * 0.35 + phase) * radio;
      const z = home.z + Math.sin(tiempo * 0.35 + phase) * radio;
      animal.position.set(x, mundo.alturaTerreno(x, z) + (type === "deer" ? 0.8 : 0.42), z);
      animal.rotation.y = -tiempo * 0.35 - phase;
    }
  });
}
// Abre el mapa ampliado.
function abrirMapa() {
  document.querySelector("#world-map").hidden = false;
}
// Cierra el mapa ampliado.
function cerrarMapa() {
  document.querySelector("#world-map").hidden = true;
}
function actualizarFogataVisual(fogata) {
  const encendida = Boolean(state.fires[fogata.metadata.id]);
  fogata.metadata.flame.setEnabled(encendida);
  fogata.metadata.light.intensity = encendida ? 2.6 : 0;
}
function abrirTrampa(trampa) {
  atrapado = true;
  minijuegoTrampa = { trampa, sequence: ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"], index: 0, deadline: performance.now() + 12000, started: false };
  document.querySelector("#trap-modal").hidden = false;
  document.querySelector("#trap-status").textContent = state.inventory.knife
    ? "Tienes un cuchillo: puedes cortar la cuerda, o pulsar E para iniciar la secuencia."
    : "Pulsa E para iniciar la secuencia de liberación.";
  mostrarAviso("Una trampa de cuerda te inmovilizó.");
}
function liberarTrampa(mensaje) {
  if (!minijuegoTrampa) return;
  const { trampa } = minijuegoTrampa;
  state.triggeredTraps.push(trampa.metadata.id);
  trampa.setEnabled(false);
  atrapado = false; minijuegoTrampa = null;
  document.querySelector("#trap-modal").hidden = true;
  guardarPartida(state); mostrarAviso(mensaje);
}
function iniciarMinijuegoTrampa() {
  if (!minijuegoTrampa) return;
  minijuegoTrampa.started = true;
  document.querySelector("#trap-status").textContent = "Secuencia: ARRIBA, DERECHA, ABAJO, IZQUIERDA. Tienes 12 segundos.";
}
function cortarTrampa() {
  if (!minijuegoTrampa || !state.inventory.knife) return;
  liberarTrampa("Cortaste la cuerda con el cuchillo. La trampa quedó inutilizada.");
}
function actualizarTrampas() {
  if (atrapado && minijuegoTrampa && performance.now() > minijuegoTrampa.deadline) {
    const atras = jugador.camera.getDirection(Vector3.Forward()).scale(-14);
    criatura.position.copyFrom(jugador.camera.position.add(atras));
    criatura.position.y = mundo.alturaTerreno(criatura.position.x, criatura.position.z) + 1.4;
    criatura.metadata.state = "suspicious";
    liberarTrampa("La cuerda cedió tarde. Algo aparece a una distancia segura entre los árboles.");
    return;
  }
  if (atrapado) return;
  const trampa = mundo.traps.find((item) => item.isEnabled() && Vector3.Distance(item.position, jugador.camera.position) < item.metadata.radius);
  if (trampa) abrirTrampa(trampa);
}
function cercaFogataEncendida(posicion, radio = 16) {
  return mundo.campfires.some((fogata) => state.fires[fogata.metadata.id] && Vector3.Distance(posicion, fogata.position) < radio);
}
// Actualiza la alerta, movimiento y daño de la criatura mediante estados explícitos.
function actualizarCriatura(delta, controles) {
  const ahora = performance.now();
  if (criatura.metadata.disabledUntil > ahora) {
    animarCriatura(delta, false);
    return;
  }
  if (!criatura.isVisible) {
    criatura.isVisible = true;
    saludCriatura = 3;
    criatura.position.copyFrom(criatura.metadata.home);
    mostrarAviso("Algo se levantó entre los árboles.");
  }
  if (escapo) return;
  const posicionJugador = jugador.camera.position;
  const desplazamiento = posicionJugador.subtract(criatura.position);
  desplazamiento.y = 0;
  const distancia = desplazamiento.length();
  const corriendoCerca =
    controles.run &&
    (controles.forward || controles.back || controles.left || controles.right) &&
    distancia < 32;
   const miraCriatura = distancia < 24 && Vector3.Dot(jugador.camera.getDirection(Vector3.Forward()), desplazamiento.normalize()) > 0.55;
   const ruido = controles.run && (controles.forward || controles.back || controles.left || controles.right);
   const luzFuego = cercaFogataEncendida(posicionJugador, 18);
   if (luzFuego) criatura.metadata.state = "search";
   else if (distancia < 8 || ruido && distancia < 32) criatura.metadata.state = "chase";
   else if (miraCriatura || distancia < 18) criatura.metadata.state = "suspicious";
   else criatura.metadata.state ??= "patrol";
   criatura.metadata.alerted = ["suspicious", "chase"].includes(criatura.metadata.state);
   if (criatura.metadata.state === "patrol" && ahora >= criatura.metadata.nextAppearance) {
    const angulo = ahora * 0.00037;
    const radio = 34 + ((Math.floor(ahora / 1000) % 3) * 5);
    const x = posicionJugador.x + Math.cos(angulo) * radio;
    const z = posicionJugador.z + Math.sin(angulo) * radio;
    criatura.metadata.nextAppearance = ahora + 15000 + Math.random() * 7000;
    if (mundo.isSafeMonsterPosition(x, z)) {
      criatura.position.set(x, mundo.alturaTerreno(x, z) + 1.4, z);
      criatura.rotation.y = Math.atan2(posicionJugador.x - x, posicionJugador.z - z);
      reproducirSonidoCriatura(radio);
    } else {
      criatura.position.copyFrom(criatura.metadata.home);
    }
  }
   if (criatura.metadata.state === "suspicious" && (corriendoCerca || distancia < 9)) {
     criatura.metadata.state = "chase";
     criatura.metadata.alerted = true;
    reproducirSonidoCriatura(distancia);
    mostrarAviso("Algo te ha escuchado entre los árboles.");
  }
   if (criatura.metadata.state === "patrol") return;
  let caminando = false;
   if (criatura.metadata.state === "search") {
     const regreso = criatura.metadata.home.subtract(criatura.position); regreso.y = 0;
     if (regreso.length() < 2) criatura.metadata.state = "patrol";
     else criatura.position.addInPlace(regreso.normalize().scale(delta * 1.2));
   } else if (distancia > 1.4) {
    desplazamiento.normalize();
    criatura.position.addInPlace(
      desplazamiento.scale(Math.min(distancia - 1.4, delta * 2.65)),
    );
    criatura.position.y =
      mundo.alturaTerreno(criatura.position.x, criatura.position.z) + 1.4;
    criatura.rotation.y = Math.atan2(desplazamiento.x, desplazamiento.z);
    caminando = true;
  }
  animarCriatura(delta, caminando);
  if (caminando && contextoAudio && contextoAudio.currentTime >= proximoPasoCriatura) {
    proximoPasoCriatura = contextoAudio.currentTime + 0.48;
    reproducirRuido(0.1, 0.026, 180);
  }
   if (criatura.metadata.state === "chase" && distancia < 2.2) state.health = Math.max(0, state.health - delta * 24);
  if (state.health === 0) {
    state.health = 100;
    jugador.camera.position.set(0, 1.7, -1.5);
    criatura.position.copyFrom(criatura.metadata.home);
    criatura.metadata.alerted = false;
    criatura.metadata.nextAppearance = ahora + 9000;
    mostrarAviso("La oscuridad te devolvió a la cabaña.");
  }
}
// Aparición secundaria posterior al capítulo IV: lenta, visible y vulnerable a luz cercana.
function actualizarEco(delta) {
  if (!state.chapter4 || escapo) return;
  const distancia = Vector3.Distance(echo.position, jugador.camera.position);
  const iluminado = state.flashlight || cercaFogataEncendida(jugador.camera.position, 13);
  if (!echo.isVisible && distancia < 42 && !iluminado) {
    echo.isVisible = true;
    echo.position.copyFrom(jugador.camera.position.add(new Vector3(12, 0, 9)));
    echo.position.y = mundo.alturaTerreno(echo.position.x, echo.position.z) + 1.15;
    mostrarAviso("Una silueta azul permanece entre los edificios. La luz la inmoviliza.");
  }
  if (!echo.isVisible) return;
  if (iluminado) return;
  const hacia = jugador.camera.position.subtract(echo.position); hacia.y = 0;
  if (hacia.length() > 2.8) echo.position.addInPlace(hacia.normalize().scale(delta * 1.05));
  if (distancia < 2.8 && performance.now() > echo.metadata.nextAttack) {
    echo.metadata.nextAttack = performance.now() + 1800;
    state.health = Math.max(0, state.health - 9);
    mostrarAviso("El Eco roza tu sombra. Enciende una luz y aléjate.");
  }
}

motor.setHardwareScalingLevel(state.settings.quality === "high" ? 1 : 1.5);
document.querySelector("#flashlight-mode").textContent =
  state.settings.flashlightMode === "long" ? "LEJOS" : "CERCA";
renderizarInventario(state);
renderizarBitacora(state);
actualizarSignosVitales();
actualizarBateria();
actualizarIndicadorRifle();
actualizarArmaEquipada();
actualizarObjetivo();
if (state.mission.phase === "epilogue") {
  escapo = true;
  document.querySelector("#ending-kicker").textContent = "EPÍLOGO: LA ÚLTIMA SEÑAL";
  document.querySelector("#ending-content").innerHTML =
    "<p>Al amanecer, una unidad de rescate llega a la carretera. Daniel entrega las notas y asegura que la estación está sellada.</p><p>Desde el vehículo de evacuación, una luz verde se enciende una sola vez bajo el río. La radio emite estática. Daniel está sentado a tu lado cuando su propia voz susurra: «No sigas mi voz.»</p>";
  document.querySelector("#restart-game").textContent = "REINICIAR HISTORIA";
  document.querySelector("#next-chapter").hidden = true;
  document.querySelector("#ending-modal").hidden = false;
}
document.querySelector("#start-button").addEventListener("click", iniciarBriefing);
document.querySelector("#briefing-continue").addEventListener("click", entrarBosque);
document
  .querySelector("#save-button")
  .addEventListener("click", guardarPartidaActual);
document
  .querySelector("#flashlight-button")
  .addEventListener("click", alternarLinterna);
document
  .querySelector("#quality-button")
  .addEventListener("click", alternarCalidad);
document
  .querySelector("#backpack-button")
  .addEventListener("click", abrirMochila);
document.querySelector("#pause-button").addEventListener("click", alternarPausa);
document.querySelector("#resume-game").addEventListener("click", alternarPausa);
document.querySelector("#restart-story").addEventListener("click", () => {
  if (!window.confirm("Se eliminará la partida guardada y volverás al inicio. ¿Continuar?")) return;
  borrarPartida();
  window.location.reload();
});
document.querySelector("#open-settings").addEventListener("click", () => {
  actualizarAjustes();
  document.querySelector("#pause-actions").hidden = true;
  document.querySelector("#settings-panel").hidden = false;
});
document.querySelector("#close-settings").addEventListener("click", () => {
  document.querySelector("#settings-panel").hidden = true;
  document.querySelector("#pause-actions").hidden = false;
});
document
  .querySelector("#sensitivity-setting")
  .addEventListener("input", (event) => cambiarSensibilidad(event.target.value));
document
  .querySelector("#volume-setting")
  .addEventListener("input", (event) => cambiarVolumen(event.target.value));
document
  .querySelector("#close-backpack")
  .addEventListener("click", cerrarMochila);
document.querySelector("#close-note").addEventListener("click", cerrarNota);
document.querySelector("#minimap").addEventListener("click", abrirMapa);
document.querySelector("#minimap").addEventListener("keydown", (event) => {
  if (event.code === "Enter" || event.code === "Space") {
    event.preventDefault();
    abrirMapa();
  }
});
document.querySelector("#close-map").addEventListener("click", cerrarMapa);
document
  .querySelector("#replace-battery")
  .addEventListener("click", reemplazarBateria);
document
  .querySelector("#decline-battery")
  .addEventListener(
    "click",
    () => (document.querySelector("#battery-modal").hidden = true),
  );
document.querySelector("#cut-trap").addEventListener("click", cortarTrampa);
document.querySelector("#start-trap").addEventListener("click", iniciarMinijuegoTrampa);
document.querySelector("#restart-game").addEventListener("click", () => {
  if (state.mission.phase === "epilogue") {
    borrarPartida();
    window.location.reload();
    return;
  }
  escapo = false;
  document.querySelector("#ending-modal").hidden = true;
  if (state.chapter2 && state.mission.phase !== "epilogue")
    jugador.camera.position.set(
      mundo.stationPoint.x,
      mundo.stationPoint.y + 1.7,
      mundo.stationPoint.z + 7,
    );
  else jugador.camera.position.set(0, 1.7, -1.5);
  actualizarObjetivo();
});
document.querySelector("#next-chapter").addEventListener("click", () => {
  if (state.mission.phase === "epilogue") return;
  state.chapter2 = true;
  escapo = false;
  document.querySelector("#ending-modal").hidden = true;
  mundo.pickups
    .filter((recogible) => recogible.metadata.chapter === 2)
    .forEach((recogible) => recogible.setEnabled(true));
  jugador.camera.position.set(
    mundo.stationPoint.x,
    mundo.stationPoint.y + 1.7,
    mundo.stationPoint.z + 7,
  );
  jugador.camera.rotation.set(0, Math.PI, 0);
  actualizarObjetivo();
  guardarPartida(state);
  mostrarAviso(
    "Capítulo II: estación de bombeo. Encuentra tres fusibles industriales.",
  );
});
document.querySelector("#items").addEventListener("click", (event) => {
  if (pausado) return;
  const read = event.target.closest("[data-read-note]");
  const deleteNote = event.target.closest("[data-delete-note]");
  const use = event.target.closest("[data-use-item]");
  const deleteItem = event.target.closest("[data-delete-item]");
  if (read) {
    const document = state.documents.find(
      (entry) => entry.id === read.dataset.readNote,
    );
    if (document) mostrarNota(document.text, document.title);
  }
  if (deleteNote) descartarNota(deleteNote.dataset.deleteNote);
  if (use) usarConsumible(use.dataset.useItem);
  if (deleteItem) descartarObjeto(deleteItem.dataset.deleteItem);
});
document.querySelector("#touch-interact").addEventListener("click", interactuar);
[
  ["#touch-run", "run"],
  ["#touch-jump", "jump"],
].forEach(([selector, key]) => {
  const button = document.querySelector(selector);
  button.addEventListener("pointerdown", () => {
    activarAudio();
    entradaTactil[key] = true;
  });
  ["pointerup", "pointerleave", "pointercancel"].forEach((event) =>
    button.addEventListener(event, () => (entradaTactil[key] = false)),
  );
});
document.querySelectorAll("[data-move]").forEach((button) => {
  const key = button.dataset.move;
  button.addEventListener("pointerdown", () => {
    activarAudio();
    entradaTactil[key] = 1;
  });
  ["pointerup", "pointerleave", "pointercancel"].forEach((event) =>
    button.addEventListener(event, () => (entradaTactil[key] = 0)),
  );
});
window.addEventListener("keydown", (event) => {
  if (
    ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(
      event.code,
    )
  )
    event.preventDefault();
  if (event.ctrlKey && event.code === "KeyA") {
    event.preventDefault();
    guardarPartidaActual();
    return;
  }
  if (event.code === "KeyP" && !event.repeat) {
    alternarPausa();
    return;
  }
  if (event.code === "KeyQ" && !event.repeat) {
    alternarVisionNocturna();
    return;
  }
  if (pausado) return;
  if (atrapado) {
    if (event.code === "KeyE" && !event.repeat) iniciarMinijuegoTrampa();
    if (minijuegoTrampa?.started && minijuegoTrampa.sequence[minijuegoTrampa.index] === event.code) {
      minijuegoTrampa.index++;
      document.querySelector("#trap-status").textContent = `Correcto: ${minijuegoTrampa.index}/4`;
      if (minijuegoTrampa.index === minijuegoTrampa.sequence.length) liberarTrampa("Te liberaste de la trampa antes de que algo llegara.");
    } else if (minijuegoTrampa?.started && ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"].includes(event.code)) {
      minijuegoTrampa.index = 0;
      document.querySelector("#trap-status").textContent = "Secuencia incorrecta. Empieza de nuevo: ARRIBA.";
    }
    return;
  }
  if (
    ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
      event.code,
    )
  )
    activarAudio();
  teclasPulsadas.add(event.code);
  if (event.code === "Escape") cerrarMapa();
  if (event.code === "KeyE") notaAbierta ? cerrarNota() : interactuar();
  if (event.code === "KeyM" && !event.repeat) alternarMochila();
  if (event.code === "KeyF" && !notaAbierta && !event.repeat) alternarLinterna();
  if (event.code === "KeyL" && !notaAbierta && !event.repeat)
    alternarModoLinterna();
  if (event.code === "KeyJ" && !notaAbierta && !event.repeat) alternarArmaEquipada();
  if (event.code === "KeyG" && !notaAbierta && !event.repeat) usarArmaEquipada();
  if (event.code === "KeyR" && !notaAbierta && !event.repeat) recargarRifle();
  if (event.code === "KeyH" && !notaAbierta && !event.repeat) usarBotiquin();
});
window.addEventListener("keyup", (event) => teclasPulsadas.delete(event.code));
window.addEventListener("blur", () => teclasPulsadas.clear());
escena.onBeforeRenderObservable.add(() => {
  try {
    if (pausado) return;
    const delta = motor.getDeltaTime() / 1000;
    const controles = estadoEntrada();
     const hambreCritica = state.hunger < 18;
     if (hambreCritica) controles.run = false;
     if (!notaAbierta && !escapo && !atrapado) actualizarJugador(jugador, controles, delta, mundo);
    actualizarLinterna();
    if (
      Math.abs(jugador.camera.position.x) > 224 ||
      Math.abs(jugador.camera.position.z) > 224
    ) {
      jugador.camera.position.set(0, 1.7, -1.5);
      mostrarAviso("El bosque termina aquí. Regresaste a la cabaña.");
    }
      if (state.flashlight && !visionNocturnaActiva) {
       const multiplicador = state.settings.flashlightMode === "long" ? CONFIG.linterna.multiplicadorConsumoHazLargo : 1;
       state.battery = Math.max(0, state.battery - delta * (100 / CONFIG.linterna.duracionBateriaSegundos) * multiplicador);
      if (!state.battery) {
        configurarLinterna(false);
        mostrarAvisoBateria();
      }
    }
    const moviendo =
      controles.forward || controles.back || controles.left || controles.right;
     state.energy =
       controles.run && moviendo
         ? Math.max(0, state.energy - delta * 6)
         : Math.min(100, state.energy + delta * (hambreCritica ? 4 : 9));
      const hambreConBuff = Date.now() < state.satiatedUntil;
      state.hunger = Math.max(0, state.hunger - delta * (100 / CONFIG.hambre.duracionCompletoSegundos) * (hambreConBuff ? CONFIG.hambre.multiplicadorConsumoCarneCocida : 1));
     if (hambreCritica && performance.now() - ultimoAvisoHambre > 18000) {
       ultimoAvisoHambre = performance.now();
       mostrarAviso("Tienes hambre: no puedes correr y recuperas energía más despacio.");
     }
    actualizarPasos(controles);
    actualizarAmbiente();
    actualizarAtmosfera();
     actualizarCriatura(delta, controles);
      actualizarEco(delta);
      actualizarFauna(delta);
      actualizarTrampas();
     mundo.campfires.forEach((fogata, indice) => {
       if (state.fires[fogata.metadata.id]) fogata.metadata.flame.scaling.y = 1.25 + Math.sin(performance.now() * 0.009 + indice) * 0.28;
     });
    actualizarCercano();
    actualizarMinimapa();
    actualizarSignosVitales();
    actualizarBateria();
  } catch (error) {
    console.error(error);
    document.querySelector("#objective").textContent =
      `Error de escena: ${error.message}`;
  }
});
motor.runRenderLoop(() => escena.render());
// Evita que el navegador muestre el HTML sin estilos durante la carga inicial.
document.body.classList.add("game-ready");
window.addEventListener("resize", () => motor.resize());
