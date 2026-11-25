// Define las misiones y destinos del capítulo de la estación.
export function objetivoCapitulo2(fase, estado) {
  const objetivos = {
    "find-card": "Misión 1: encuentra la tarjeta de seguridad de la estación.",
    "industrial-fuses": `Misión 2: reúne fusibles industriales (${Math.min(estado.inventory.industrialFuse || 0, 3)}/3).`,
    generator: "Misión 3: activa el panel de generadores.",
    "station-transmitter": "Misión 4: sigue el túnel hasta el transmisor de Daniel.",
    epilogue: "Epílogo: Daniel está a salvo, pero la última señal sigue en el río.",
  };
  return objetivos[fase];
}

export const puntosCapitulo2 = {
  "find-card": [150, -213],
  "industrial-fuses": [140, -197],
  generator: [150, -210],
  daniel: [150, -218],
};
