const CLAVE_GUARDADO = "bosque-desaparecidos-save-v16";

// Recupera la partida almacenada o devuelve nulo si no es válida.
export function cargarPartida() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_GUARDADO)) || null;
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
      mission: estado.mission,
      settings: estado.settings,
    }),
  );
}
