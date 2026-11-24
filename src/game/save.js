const SAVE_KEY = "bosque-desaparecidos-save-v16";

export function loadGame() {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY)) || null;
  } catch {
    return null;
  }
}

export function saveGame(state) {
  localStorage.setItem(
    SAVE_KEY,
    JSON.stringify({
      inventory: state.inventory,
      journal: state.journal,
      collected: state.collected,
      readNotes: state.readNotes,
      documents: state.documents,
      health: state.health,
      energy: state.energy,
      hunger: state.hunger,
      flashlight: state.flashlight,
      battery: state.battery,
      rifleAmmo: state.rifleAmmo,
      chapter2: state.chapter2,
      stationPowered: state.stationPowered,
      chapter2Finished: state.chapter2Finished,
      mission: state.mission,
      settings: state.settings,
    }),
  );
}
