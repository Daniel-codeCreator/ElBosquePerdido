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
import {
  crearJugador,
  actualizarJugador,
} from "./game/player.js";
import { construirMundo, crearRecogible } from "./game/world.js";
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
  flashlight: true,
  battery: 100,
  rifleAmmo: 0,
  chapter2: false,
  stationPowered: false,
  chapter2Finished: false,
  chapter3: false,
  chapter4: false,
  chapter5: false,
  chapter6: false,
  mission: { phase: "note-1" },
  settings: { quality: "high", flashlightMode: "wide" },
};
const partidaGuardada = cargarPartida();
if (partidaGuardada) Object.assign(state, partidaGuardada);
state.inventory ??= {};
state.collected ??= [];
state.rifleAmmo ??= 0;
state.readNotes ??= [];
state.mission ??= { phase: state.chapter2 ? "find-card" : "note-1" };
const fasesCapitulo3 = ["signal-1", "signal-2", "signal-3"];
const fasesCapitulo4 = ["hospital-file", "police-file", "gas-record"];
const fasesCapitulo5 = ["cave-entry", "cave-valve", "cave-daniel"];
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
if (misionSincronizada || objetosReparados) guardarPartida(state);
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
let saludCriatura = 3;
let contextoAudio = null;
let proximoPaso = 0;
let ultimoDisparo = 0;
let destelloHasta = 0;
let gananciaPrincipal = null;
let gananciaViento = null;
let gananciaAgua = null;
let proximoSonidoRio = 0;
let proximoPasoCriatura = 0;
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
luzCielo.groundColor = new Color3(0.025, 0.055, 0.045);
luzCielo.intensity = 0.62;
const luna = new DirectionalLight(
  "moonlight",
  new Vector3(-0.45, -1, 0.25),
  escena,
);
luna.position = new Vector3(20, 35, -20);
luna.diffuse = new Color3(0.5, 0.68, 0.72);
luna.intensity = 0.82;
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
linterna.intensity = 8;
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
linterna.intensity = state.flashlight && state.battery > 0 ? 8 : 0;
brilloLinterna.intensity = state.flashlight && state.battery > 0 ? 0.55 : 0;
const destelloBoca = new PointLight("rifle muzzle flash", new Vector3(), escena);
destelloBoca.diffuse = new Color3(1, 0.72, 0.28);
destelloBoca.intensity = 7;
destelloBoca.range = 8;
destelloBoca.setEnabled(false);
const mundo = construirMundo(escena, state.settings?.quality || "high");
function capituloDisponible(capitulo) {
  return capitulo === 2 ? state.chapter2 : Boolean(state[`chapter${capitulo}`]);
}
function actualizarObjetosCapitulo() {
  mundo.pickups
    .filter((recogible) => recogible.metadata.chapter)
    .forEach((recogible) => recogible.setEnabled(capituloDisponible(recogible.metadata.chapter)));
}
mundo.pickups
  .filter((recogible) => recogible.metadata.chapter)
  .forEach((recogible) =>
    recogible.setEnabled(capituloDisponible(recogible.metadata.chapter)),
  );
if (state.chapter2 && state.mission.phase !== "epilogue")
  jugador.camera.position.set(
    mundo.stationPoint.x,
    mundo.stationPoint.y + 1.7,
    mundo.stationPoint.z + 7,
  );
const { creature: criatura, escapePoint: puntoEscape } = mundo;
const interactuables = mundo.pickups.filter(
  (malla) => !state.collected.includes(malla.metadata.id),
);
mundo.pickups
  .filter((malla) => state.collected.includes(malla.metadata.id))
  .forEach((malla) => malla.dispose());

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
    `${state.inventory.ammo || 0} RESERVA`;
}
// Busca el objeto interactuable más cercano al jugador.
function actualizarCercano() {
  cercaSalida =
    !state.chapter2 &&
    state.mission.phase === "radio" &&
    Vector3.Distance(jugador.camera.position, puntoEscape) < 4.5;
  masCercano = null;
  // Los elementos de misión deben seguir siendo utilizables aunque el bosque
  // o la geometría del edificio obliguen a acercarse desde un lateral.
  let distancia = 9;
  const adelante = jugador.camera.getDirection(Vector3.Forward());
  interactuables.forEach((malla) => {
    if (!malla.isDisposed() && malla.isEnabled()) {
      const desplazamiento = malla.position.subtract(jugador.camera.position);
      const actual = desplazamiento.length();
      if (
        actual < distancia &&
        Vector3.Dot(adelante, desplazamiento.normalize()) > -0.35
      ) {
        masCercano = malla;
        distancia = actual;
      }
    }
  });
  const aviso = document.querySelector("#interaction");
  aviso.textContent = cercaSalida
    ? "[E] ACTIVAR RADIO DE EMERGENCIA"
    : masCercano
      ? `[E] ${masCercano.metadata.label}`
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
function soltarObjeto(tipo, etiqueta, textoNota = "") {
  const id = `dropped-${tipo}-${Date.now()}`;
  const posicion = posicionSoltar();
  const desplazamiento =
    {
      note: 0.05,
      wood: 0.16,
      battery: 0.36,
      knife: 0.1,
      rifle: 0.12,
      ammo: 0.15,
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
  state.flashlight = Boolean(activa && state.battery > 0);
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
  const activa = state.flashlight && state.battery > 0;
  const alcanceLargo = state.settings.flashlightMode === "long";
  linterna.angle = alcanceLargo ? Math.PI / 10 : Math.PI / 2.5;
  linterna.range = alcanceLargo ? 78 : 30;
  linterna.intensity = activa ? (alcanceLargo ? 12 : 8) : 0;
  brilloLinterna.intensity = activa ? (alcanceLargo ? 0.22 : 0.55) : 0;
  const adelante = jugador.camera.getDirection(Vector3.Forward());
  linterna.position.copyFrom(jugador.camera.position.add(adelante.scale(0.18)));
  linterna.direction.copyFrom(adelante);
  brilloLinterna.position.copyFrom(
    jugador.camera.position.add(adelante.scale(0.12)),
  );
  destelloBoca.position.copyFrom(
    jugador.camera.position.add(adelante.scale(0.55)),
  );
  destelloBoca.setEnabled(performance.now() < destelloHasta);
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
  if (gananciaPrincipal && contextoAudio) {
    gananciaPrincipal.gain.setTargetAtTime(
      pausado ? 0 : 1,
      contextoAudio.currentTime,
      0.03,
    );
  }
  teclasPulsadas.clear();
  Object.keys(entradaTactil).forEach((tecla) => (entradaTactil[tecla] = false));
  document.querySelector("#pause-button").textContent = pausado
    ? "CONTINUAR [P]"
    : "PAUSA [P]";
  mostrarAviso(pausado ? "Juego en pausa. Pulsa P para continuar." : "Juego reanudado.");
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
  if (tipo === "cassette") {
    mostrarNota(grabacionDaniel, "Grabación de Daniel");
    reproducirGrabacionDaniel();
    return;
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
  if (tipo === "berries") {
    state.hunger = Math.min(100, state.hunger + 28);
    state.collected.push(id);
    masCercano.dispose();
    masCercano = null;
    actualizarSignosVitales();
    guardarPartida(state);
    return mostrarAviso("Comiste frutas silvestres. Recuperaste saciedad.");
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
  const cantidad = tipo === "ammo" ? (state.inventory.ammo ? 0 : 1) : 1;
  if (pesoInventario(state) + cantidad > 12)
    return mostrarAviso("La mochila está llena. No puedes cargar más objetos.");
  if (tipo === "rifle") {
    agregarObjeto(state, "rifle");
    state.rifleAmmo = 3;
  } else agregarObjeto(state, tipo, tipo === "ammo" ? 3 : 1);
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
  guardarPartida(state);
  mostrarAviso(
    tipo === "rifle" ? "Encontraste el rifle con 3 balas cargadas." : mensaje,
  );
}
// Elimina un objeto del inventario y lo deja en el suelo.
function descartarObjeto(tipo) {
  if (!state.inventory[tipo]) return;
  if (["radioFuse", "industrialFuse", "card"].includes(tipo))
    return mostrarAviso("No puedes tirar un objeto necesario para la misión.");
  const etiqueta =
    tipo === "wood"
      ? "Ramas secas"
      : tipo === "berries"
        ? "Bayas oscuras"
        : "Batería de linterna";
  state.inventory[tipo]--;
  if (!state.inventory[tipo]) delete state.inventory[tipo];
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
  soltarObjeto("note", documento.title, documento.text);
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
      teclasPulsadas.has("ControlLeft") ||
      teclasPulsadas.has("ControlRight"),
    jump: entradaTactil.jump || teclasPulsadas.has("Space"),
  };
}
// Inicializa el contexto y las fuentes de audio ambiental.
function activarAudio() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  contextoAudio ||= new AudioContext();
  contextoAudio.resume().catch(() => {});
  if (!gananciaPrincipal) {
    gananciaPrincipal = contextoAudio.createGain();
    gananciaPrincipal.gain.value = pausado ? 0 : 1;
    gananciaPrincipal.connect(contextoAudio.destination);
  }
  if (!gananciaViento) {
    const viento = contextoAudio.createOscillator();
    gananciaViento = contextoAudio.createGain();
    viento.type = "sine";
    viento.frequency.value = 47;
    gananciaViento.gain.value = 0.008;
    viento.connect(gananciaViento).connect(gananciaPrincipal);
    viento.start();
    const agua = contextoAudio.createOscillator();
    gananciaAgua = contextoAudio.createGain();
    agua.type = "triangle";
    agua.frequency.value = 92;
    gananciaAgua.gain.value = 0;
    agua.connect(gananciaAgua).connect(gananciaPrincipal);
    agua.start();
  }
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
  fuente.connect(filtro).connect(ganancia).connect(gananciaPrincipal);
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
  oscilador.connect(ganancia).connect(gananciaPrincipal);
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
// Recarga el rifle usando la munición de reserva.
function recargarRifle() {
  if (!state.inventory.rifle)
    return mostrarAviso("Necesitas encontrar el rifle de caza.");
  const necesarias = 3 - state.rifleAmmo;
  if (!necesarias) return mostrarAviso("El cargador ya está lleno.");
  if (!state.inventory.ammo) return mostrarAviso("No tienes munición de reserva.");
  const cargadas = Math.min(necesarias, state.inventory.ammo);
  state.rifleAmmo += cargadas;
  state.inventory.ammo -= cargadas;
  if (!state.inventory.ammo) delete state.inventory.ammo;
  activarAudio();
  reproducirSonidoRecarga();
  renderizarInventario(state);
  actualizarIndicadorRifle();
  guardarPartida(state);
  mostrarAviso(`Recargaste ${cargadas} bala${cargadas === 1 ? "" : "s"}.`);
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
  activarAudio();
  reproducirRuido(0.06, 0.08, 1250);
  const adelante = jugador.camera.getDirection(Vector3.Forward());
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
// Consume un botiquín y recupera salud.
function usarBotiquin() {
  if (!state.inventory.medkit) return;
  if (state.health >= 100) return mostrarAviso("Tu salud ya está completa.");
  state.inventory.medkit--;
  if (!state.inventory.medkit) delete state.inventory.medkit;
  state.health = Math.min(100, state.health + 55);
  renderizarInventario(state);
  actualizarSignosVitales();
  guardarPartida(state);
  mostrarAviso("Usaste un botiquín.");
}
// Dispara el rifle y ahuyenta a la criatura si está cerca.
function dispararRifle() {
  if (!state.inventory.rifle)
    return mostrarAviso("Necesitas encontrar el rifle de caza.");
  if (!state.rifleAmmo) return recargarRifle();
  const ahora = performance.now();
  if (ahora - ultimoDisparo < 450) return;
  ultimoDisparo = ahora;
  state.rifleAmmo--;
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
// Abre el mapa ampliado.
function abrirMapa() {
  document.querySelector("#world-map").hidden = false;
}
// Cierra el mapa ampliado.
function cerrarMapa() {
  document.querySelector("#world-map").hidden = true;
}
// Actualiza la alerta, movimiento y daño de la criatura.
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
  if (!criatura.metadata.alerted && ahora >= criatura.metadata.nextAppearance) {
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
  if (!criatura.metadata.alerted && (corriendoCerca || distancia < 9)) {
    criatura.metadata.alerted = true;
    reproducirSonidoCriatura(distancia);
    mostrarAviso("Algo te ha escuchado entre los árboles.");
  }
  if (!criatura.metadata.alerted) return;
  let caminando = false;
  if (distancia > 1.4) {
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
  if (distancia < 2.2) state.health = Math.max(0, state.health - delta * 24);
  if (state.health === 0) {
    state.health = 100;
    jugador.camera.position.set(0, 1.7, -1.5);
    criatura.position.copyFrom(criatura.metadata.home);
    criatura.metadata.alerted = false;
    criatura.metadata.nextAppearance = ahora + 9000;
    mostrarAviso("La oscuridad te devolvió a la cabaña.");
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
  if (use?.dataset.useItem === "medkit") usarBotiquin();
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
  if (pausado) return;
  if (
    ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
      event.code,
    )
  )
    activarAudio();
  teclasPulsadas.add(event.code);
  if (event.code === "Escape") cerrarMapa();
  if (event.code === "KeyE") notaAbierta ? cerrarNota() : interactuar();
  if (event.code === "KeyM" && !event.repeat) abrirMochila();
  if (event.code === "KeyF" && !notaAbierta && !event.repeat) alternarLinterna();
  if (event.code === "KeyL" && !notaAbierta && !event.repeat)
    alternarModoLinterna();
  if (event.code === "KeyG" && !notaAbierta && !event.repeat) dispararRifle();
  if (event.code === "KeyR" && !notaAbierta && !event.repeat) recargarRifle();
  if (event.code === "KeyH" && !notaAbierta && !event.repeat) usarBotiquin();
  if (event.code === "KeyK" && !notaAbierta && !event.repeat) usarCuchillo();
});
window.addEventListener("keyup", (event) => teclasPulsadas.delete(event.code));
window.addEventListener("blur", () => teclasPulsadas.clear());
escena.onBeforeRenderObservable.add(() => {
  try {
    if (pausado) return;
    const delta = motor.getDeltaTime() / 1000;
    const controles = estadoEntrada();
    if (!notaAbierta && !escapo) actualizarJugador(jugador, controles, delta, mundo);
    actualizarLinterna();
    if (
      Math.abs(jugador.camera.position.x) > 224 ||
      Math.abs(jugador.camera.position.z) > 224
    ) {
      jugador.camera.position.set(0, 1.7, -1.5);
      mostrarAviso("El bosque termina aquí. Regresaste a la cabaña.");
    }
    if (state.flashlight) {
      state.battery = Math.max(0, state.battery - delta * 0.12);
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
        : Math.min(100, state.energy + delta * 10);
    state.hunger = Math.max(0, state.hunger - delta * 1.2);
    actualizarPasos(controles);
    actualizarAmbiente();
    actualizarAtmosfera();
    actualizarCriatura(delta, controles);
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
window.addEventListener("resize", () => motor.resize());
