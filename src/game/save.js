const CLAVE_GUARDADO = "bosque-desaparecidos-save-v20";
const CLAVES_ANTERIORES = ["bosque-desaparecidos-save-v19", "bosque-desaparecidos-save-v18", "bosque-desaparecidos-save-v17"];

// Elimina el progreso actual y el formato anterior al iniciar una nueva historia.
export function borrarPartida() {
  localStorage.removeItem(CLAVE_GUARDADO);
  CLAVES_ANTERIORES.forEach((clave) => localStorage.removeItem(clave));
}

// Recupera la partida almacenada o devuelve nulo si no es válida.
export function cargarPartida() {
  const leer = (clave) => {
    try {
      return JSON.parse(localStorage.getItem(clave));
    } catch {
      return null;
    }
  };
  try {
    const actual = leer(CLAVE_GUARDADO);
    const partida = actual || CLAVES_ANTERIORES.map(leer).find(Boolean);
    if (!partida) return null;
    if (partida.mission?.phase === "epilogue" && !partida.chapter3) {
      partida.chapter2 = true;
      partida.chapter2Finished = true;
      partida.chapter3 = true;
      partida.mission = { phase: "signal-1" };
    }
    return partida;
  } catch {
    return null;
  }
}

// Guarda los datos necesarios para restaurar la partida actual.
export function guardarPartida(estado) {
  localStorage.setItem(
    CLAVE_GUARDADO,
    JSON.stringify({
      inventory: estado.inventory,
      journal: estado.journal,
      collected: estado.collected,
      readNotes: estado.readNotes,
      documents: estado.documents,
      health: estado.health,
      energy: estado.energy,
      hunger: estado.hunger,
      flashlight: estado.flashlight,
      battery: estado.battery,
      rifleAmmo: estado.rifleAmmo,
      chapter2: estado.chapter2,
      stationPowered: estado.stationPowered,
      chapter2Finished: estado.chapter2Finished,
      chapter3: estado.chapter3,
      chapter4: estado.chapter4,
      chapter5: estado.chapter5,
      chapter6: estado.chapter6,
      mission: estado.mission,
      settings: estado.settings,
      fires: estado.fires,
      receiverRepaired: estado.receiverRepaired,
      crateUnlocked: estado.crateUnlocked,
      killedWildlife: estado.killedWildlife,
      triggeredTraps: estado.triggeredTraps,
      satiatedUntil: estado.satiatedUntil,
    }),
  );
}
