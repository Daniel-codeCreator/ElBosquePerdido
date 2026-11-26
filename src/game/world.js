import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexBuffer } from "@babylonjs/core/Meshes/buffer";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { PointLight } from "@babylonjs/core/Lights/pointLight";

// Crea un material básico con color difuso y brillo opcional.
function crearMaterial(escena, nombre, color, emisivo) {
  const material = new StandardMaterial(nombre, escena);
  material.diffuseColor = Color3.FromHexString(color);
  material.specularColor = Color3.Black();
  if (emisivo) material.emissiveColor = Color3.FromHexString(emisivo);
  return material;
}
// Calcula la altura del terreno en unas coordenadas del bosque.
export function alturaTerreno(x, z) {
  if (Math.abs(x) < 7 && z > -15 && z < 8) return 0;
  return Math.sin(x * 0.11) * 0.65 + Math.cos(z * 0.09) * 0.5;
}

// Construye la geometría, objetos y zonas interactuables del mundo.
export function construirMundo(scene, calidad = "high") {
  const obstacles = [];
  const pickups = [];
  const plataformas = [];
  const escaleras = [];
  const densidad = calidad === "low" ? 280 : 540;
  // These are mission and landmark areas. Decorative collision must never make
  // an existing objective inaccessible or hide it behind a new trunk or rock.
  const zonasProtegidas = [
    [0, 0, 12], [0, -12, 6], [-28, -48, 9], [29, -132, 9],
    [-95, -100, 12], [90, -165, 12], [150, -207, 21], [-56, -70, 24],
    [186, -164, 13], [0, -210, 10], [-18, -28, 5], [-54, -82, 5],
    [-109, -107, 5], [-5.5, -164, 6], [112, -185, 6], [150, -218, 7],
  ];
  const decoracionSegura = (x, z, margen = 0) =>
    !zonasProtegidas.some(([px, pz, radio]) =>
      Math.hypot(x - px, z - pz) < radio + margen,
    );
  const terreno = MeshBuilder.CreateGround(
    "forest terrain",
    { width: 460, height: 460, subdivisions: 128 },
    scene,
  );
  const posiciones = terreno.getVerticesData(VertexBuffer.PositionKind);
  for (let i = 0; i < posiciones.length; i += 3)
    posiciones[i + 1] = alturaTerreno(posiciones[i], posiciones[i + 2]);
  terreno.updateVerticesData(VertexBuffer.PositionKind, posiciones);
  terreno.material = crearMaterial(scene, "mossy ground", "#294632");
  const tronco = crearMaterial(scene, "trunks", "#352619");
  const agujas = crearMaterial(scene, "needles", "#1c4b31");
  const agujasClaras = crearMaterial(scene, "young needles", "#356b42");
  const hojas = crearMaterial(scene, "broadleaf canopy", "#42663b");
  const hojasOscuras = crearMaterial(scene, "broadleaf shade", "#294c31");
  const materialRoca = crearMaterial(scene, "rocks", "#4a625d");
  const materialArbusto = crearMaterial(scene, "bushes", "#3d6840");
  const fuenteArbol = MeshBuilder.CreateCylinder(
    "tree source",
    { height: 7, diameter: 0.55 },
    scene,
  );
  fuenteArbol.material = tronco;
  fuenteArbol.position.y = -1000;
  const fuenteCopa = MeshBuilder.CreateIcoSphere(
    "crown source",
    { radius: 2.25, subdivisions: 2 },
    scene,
  );
  fuenteCopa.material = agujas;
  fuenteCopa.position.y = -1000;
  const fuenteCopaAlta = MeshBuilder.CreateIcoSphere(
    "tall crown source",
    { radius: 1.8, subdivisions: 2 },
    scene,
  );
  fuenteCopaAlta.material = agujasClaras;
  fuenteCopaAlta.position.y = -1000;
  const fuenteHoja = MeshBuilder.CreateSphere(
    "broadleaf crown source",
    { diameter: 3.8, segments: 7 },
    scene,
  );
  fuenteHoja.material = hojas;
  fuenteHoja.position.y = -1000;
  const fuenteHojaSombra = MeshBuilder.CreateSphere(
    "broadleaf shade source",
    { diameter: 3.8, segments: 7 },
    scene,
  );
  fuenteHojaSombra.material = hojasOscuras;
  fuenteHojaSombra.position.y = -1000;
  for (let i = 0; i < densidad; i++) {
    const x = ((i * 47) % 420) - 210;
    const z = ((i * 79) % 420) - 210;
    if (
      (Math.abs(x) < 9 && z > -17 && z < 10) ||
      (Math.abs(x) < 3 && z < 2 && z > -215)
    )
      continue;
    if (!decoracionSegura(x, z, 3.5)) continue;
    const escala = 0.7 + (i % 6) * 0.12;
    const base = alturaTerreno(x, z);
    const arbol = fuenteArbol.createInstance(`tree-${i}`);
    const frondoso = i % 5 === 0;
    const altura = frondoso ? 5.4 : 7;
    arbol.position.set(x, base + (altura * escala) / 2, z);
    arbol.scaling.setAll(escala);
    arbol.scaling.y = (altura / 7) * escala;
    const copa = (frondoso ? fuenteHoja : fuenteCopa).createInstance(`crown-${i}`);
    copa.position.set(x, base + (frondoso ? 6.4 : 6.6) * escala, z);
    copa.scaling.setAll(frondoso ? escala * 0.86 : escala * 1.05);
    if (frondoso) {
      copa.scaling.y = 0.8 * escala;
      const sombra = fuenteHojaSombra.createInstance(`crown-shade-${i}`);
      sombra.position.set(x + 0.7 * escala, base + 6.05 * escala, z + 0.35 * escala);
      sombra.scaling.setAll(escala * 0.58);
      sombra.material = hojasOscuras;
    } else {
      // Las capas desplazadas rompen la silueta de cono y dejan ramas visibles.
      copa.scaling.y = 0.72 * escala;
      copa.scaling.x = 1.18 * escala;
      copa.scaling.z = 0.96 * escala;
      const copaMedia = fuenteCopa.createInstance(`middle-crown-${i}`);
      copaMedia.position.set(x + 0.2 * escala, base + 8.2 * escala, z - 0.12 * escala);
      copaMedia.scaling.set(0.88 * escala, 0.7 * escala, 0.82 * escala);
      if (i % 2 === 0) {
        const copaAlta = fuenteCopaAlta.createInstance(`upper-crown-${i}`);
        copaAlta.position.set(x - 0.1 * escala, base + 9.75 * escala, z + 0.12 * escala);
        copaAlta.scaling.set(0.58 * escala, 0.85 * escala, 0.55 * escala);
      }
    }
    if (i % 3 === 0) obstacles.push({ x, z, radius: 0.65 * escala });
    if (i % 4 === 0) {
      const arbusto = MeshBuilder.CreateSphere(
        `bush-${i}`,
        { diameter: 1.1 + (i % 3) * 0.3, segments: 6 },
        scene,
      );
      arbusto.position.set(x + 1.5, base + 0.45, z - 1);
      arbusto.material = materialArbusto;
    }
  }
  for (let i = 0; i < 90; i++) {
    const x = ((i * 19) % 380) - 190;
    const z = ((i * 29) % 380) - 190;
    if (!decoracionSegura(x, z, 3)) continue;
    const roca = MeshBuilder.CreateSphere(
      `rock-${i}`,
      { diameter: 1 + (i % 4) * 0.45, segments: 6 },
      scene,
    );
    roca.position.set(x, alturaTerreno(x, z) + 0.35, z);
    roca.scaling.y = 0.65;
    roca.material = materialRoca;
    obstacles.push({ x, z, radius: 0.7 });
  }
  const troncoCaido = MeshBuilder.CreateCylinder(
    "fallen log",
    { height: 5, diameter: 0.45 },
    scene,
  );
  troncoCaido.rotation.z = Math.PI / 2;
  troncoCaido.position.set(-11, alturaTerreno(-11, -10) + 0.4, -10);
  troncoCaido.material = tronco;
  // Fallen logs are scenery only, keeping the initial trail and pickups clear.
  crearCabana(scene, obstacles);
  crearCasa(scene, obstacles, -28, -48, "ranger shack");
  crearCasa(scene, obstacles, 29, -132, "riverside house");
  crearCasaGrande(scene, obstacles, -95, -100, "fire lookout");
  crearCasaGrande(scene, obstacles, 90, -165, "hunter lodge");
  crearRio(scene);
  const stationPoint = crearEstacion(scene, obstacles);
  const townPoint = crearPuebloEvacuado(scene, obstacles);
  crearTunelServicio(scene, obstacles);
  crearCielo(scene, calidad);
  const escapePoint = crearSalida(scene);
   const creature = crearCriatura(scene);
   const campfires = [
     crearFogata(scene, "fire-cabin", new Vector3(-7.5, alturaTerreno(-7.5, -5) + 0.12, -5)),
     crearFogata(scene, "fire-lookout", new Vector3(-88, alturaTerreno(-88, -106) + 0.12, -106)),
     crearFogata(scene, "fire-station", new Vector3(135, alturaTerreno(135, -189) + 0.12, -189)),
   ];
   const echo = crearEco(scene);
  pickups.push(
    crearRecogible(
      scene,
      "note-1",
      "note",
      new Vector3(1.6, 1.3, -0.4),
      "Nota sobre la mesa",
      "Encontraste una nota de Daniel.",
      "La primera noche escuché a alguien gritar mi nombre desde el río. Seguí la voz hasta la niebla... y entonces me respondió desde detrás de mí.\n\nNo sigas mi voz. Si regreso a esta cabaña, busca el vehículo.",
    ),
    crearRecogible(
      scene,
      "cassette-cabin",
      "cassette",
      new Vector3(2.15, 1.16, -0.18),
      "REPRODUCIR GRABACIÓN DE DANIEL",
      "",
    ),
  );
  pickups.push(
    crearRecogible(
      scene,
      "battery-cabin",
      "battery",
      new Vector3(-1.5, 1.1, -0.4),
      "Batería sobre el estante",
      "Encontraste una batería de linterna.",
    ),
    crearRecogible(
      scene,
      "wood-1",
      "wood",
      new Vector3(5, 0.5, -5),
      "Leña junto al sendero",
      "Recogiste leña.",
    ),
    crearRecogible(
      scene,
      "wood-2",
      "wood",
      new Vector3(-6, alturaTerreno(-6, -7) + 0.4, -7),
      "Tronco seco",
      "Recogiste leña.",
    ),
    crearRecogible(
      scene,
      "berries-1",
      "berries",
      new Vector3(8, alturaTerreno(8, -8) + 0.5, -8),
      "Frutas silvestres",
      "Recogiste frutas silvestres.",
    ),
    crearRecogible(
      scene,
      "berries-2",
      "berries",
      new Vector3(-13, alturaTerreno(-13, -18) + 0.5, -18),
      "Frutas silvestres",
      "Recogiste frutas silvestres.",
    ),
    crearRecogible(
      scene,
      "berries-3",
      "berries",
      new Vector3(4, alturaTerreno(4, -35) + 0.5, -35),
      "Frutas silvestres",
      "Recogiste frutas silvestres.",
    ),
    crearRecogible(
      scene,
      "berries-4",
      "berries",
      new Vector3(-9, alturaTerreno(-9, -58) + 0.5, -58),
      "Frutas silvestres",
      "Recogiste frutas silvestres.",
    ),
    crearRecogible(
      scene,
      "berries-5",
      "berries",
      new Vector3(11, alturaTerreno(11, -83) + 0.5, -83),
      "Frutas silvestres",
      "Recogiste frutas silvestres.",
    ),
    crearRecogible(
      scene,
      "berries-6",
      "berries",
      new Vector3(-7, alturaTerreno(-7, -108) + 0.5, -108),
      "Frutas silvestres",
      "Recogiste frutas silvestres.",
    ),
    crearRecogible(
      scene,
      "berries-7",
      "berries",
      new Vector3(-24, alturaTerreno(-24, -41) + 0.5, -41),
      "Frutas silvestres",
      "Recogiste frutas silvestres.",
    ),
    crearRecogible(
      scene,
      "berries-8",
      "berries",
      new Vector3(27, alturaTerreno(27, -120) + 0.5, -120),
      "Frutas silvestres",
      "Recogiste frutas silvestres.",
    ),
    crearRecogible(
      scene,
      "battery-forest",
      "battery",
      new Vector3(-9, alturaTerreno(-9, -16) + 0.6, -16),
      "Batería abandonada",
      "Encontraste una batería de linterna.",
    ),
    crearRecogible(
      scene,
      "note-2",
      "note",
      new Vector3(-1.3, 1.25, -12),
      "Nota junto al vehículo",
      "Encontraste otra nota.",
      "La cosa escucha los pasos y aprende las voces. La carretera no es segura, pero hay una luz al norte.\n\nDaniel",
    ),
    crearRecogible(
      scene,
      "note-3",
      "note",
      new Vector3(-28, alturaTerreno(-28, -48) + 1.15, -48),
      "Nota en la casa del guardabosque",
      "Encontraste una nota de Daniel.",
      "La casa estaba vacía cuando llegué. Encontré las pilas y el mapa del río. El agua corta el bosque, pero el viejo puente sigue en pie.\n\nDaniel",
    ),
    crearRecogible(
      scene,
      "knife-ranger",
      "knife",
      new Vector3(-27.1, alturaTerreno(-27.1, -47.4) + 0.9, -47.4),
      "Cuchillo de monte",
      "Encontraste un cuchillo de monte.",
    ),
    crearRecogible(
      scene,
      "note-4",
      "note",
      new Vector3(29, alturaTerreno(29, -132) + 1.15, -132),
      "Nota en la casa junto al río",
      "Encontraste otra nota de Daniel.",
      "La señal viene del norte. No puedo volver por el río: algo camina bajo el agua cuando cae la noche.\n\nDaniel",
    ),
    crearRecogible(
      scene,
      "rifle-riverside",
      "rifle",
      new Vector3(24.2, alturaTerreno(24.2, -132) + 0.5, -132),
      "Rifle de caza junto a la casa",
      "Encontraste un rifle de caza oxidado.",
    ),
    crearRecogible(
      scene,
      "note-5",
      "note",
      new Vector3(-5.5, alturaTerreno(-5.5, -164) + 0.45, -164),
      "Página mojada",
      "Encontraste otra nota de Daniel.",
      "Corre solo si la oyes cerca. La cosa sigue el ruido, pero se pierde entre los árboles. La baliza está casi al final del camino.\n\nDaniel",
    ),
  );
  pickups.push(
    crearRecogible(
      scene,
      "ammo-lookout",
      "ammo",
      new Vector3(-94, alturaTerreno(-94, -100) + 1, -100),
      "Caja de munición",
      "Encontraste 3 balas de rifle.",
    ),
    crearRecogible(
      scene,
      "medkit-lookout",
      "medkit",
      new Vector3(-96.1, alturaTerreno(-96.1, -100) + 1, -100),
      "Botiquín de emergencia",
      "Encontraste un botiquín.",
    ),
    crearRecogible(
      scene,
      "note-6",
      "note",
      new Vector3(-95, alturaTerreno(-95, -100) + 1.15, -99.4),
      "Registro de la torre",
      "Encontraste una nota de Daniel.",
      "Desde el segundo piso vi la baliza. Hay otra casa al este, pero la criatura ronda el sendero cuando escucha disparos.\n\nDaniel",
    ),
    crearRecogible(
      scene,
      "ammo-lodge",
      "ammo",
      new Vector3(91, alturaTerreno(91, -165) + 1, -165),
      "Caja de munición",
      "Encontraste 3 balas de rifle.",
    ),
    crearRecogible(
      scene,
      "fuse-lodge",
      "radioFuse",
      new Vector3(90, alturaTerreno(90, -171.5) + 0.24, -171.5),
      "Fusible de radio brillante",
      "Encontraste el fusible de la radio.",
    ),
    crearRecogible(
      scene,
      "note-7",
      "note",
      new Vector3(90, alturaTerreno(90, -165) + 1.15, -164.4),
      "Carta del cazador",
      "Encontraste una nota de Daniel.",
      "El rifle todavía funciona. Guarda los disparos para cuando la cosa esté cerca. Al norte del río está la última señal.\n\nDaniel",
    ),
  );
   const recursosBosque = [
    ["berries-trail-1", "berries", -18, -28, "Arbusto de moras", "Recogiste frutas silvestres."],
    ["battery-trail-1", "battery", -21, -36, "Batería olvidada", "Encontraste una batería de linterna."],
    ["ammo-trail-1", "ammo", -32, -57, "Cartuchos en una caja", "Encontraste 3 balas de rifle."],
    ["berries-trail-2", "berries", -40, -68, "Arbusto de moras", "Recogiste frutas silvestres."],
    ["battery-trail-2", "battery", -54, -82, "Batería entre las rocas", "Encontraste una batería de linterna."],
    ["ammo-trail-2", "ammo", -76, -94, "Cartuchos de cazador", "Encontraste 3 balas de rifle."],
    ["medkit-trail-1", "medkit", -109, -107, "Botiquín abandonado", "Encontraste un botiquín."],
    ["berries-trail-3", "berries", -70, -123, "Frutas silvestres", "Recogiste frutas silvestres."],
    ["battery-trail-3", "battery", -42, -116, "Batería mojada", "Encontraste una batería de linterna."],
    ["ammo-river-1", "ammo", 14, -115, "Cartuchos junto al río", "Encontraste 3 balas de rifle."],
    ["berries-river-1", "berries", 17, -143, "Frutas silvestres", "Recogiste frutas silvestres."],
    ["battery-river-1", "battery", 43, -145, "Batería de repuesto", "Encontraste una batería de linterna."],
    ["ammo-river-2", "ammo", 61, -151, "Caja de cartuchos", "Encontraste 3 balas de rifle."],
    ["berries-north-1", "berries", 57, -177, "Frutas silvestres", "Recogiste frutas silvestres."],
    ["battery-north-1", "battery", 72, -181, "Batería abandonada", "Encontraste una batería de linterna."],
    ["ammo-north-1", "ammo", 104, -181, "Cartuchos de emergencia", "Encontraste 3 balas de rifle."],
    ["ammo-forest-3", "ammo", -118, -135, "Cartuchos bajo un tronco", "Encontraste 3 balas de rifle."],
    ["ammo-forest-4", "ammo", -142, -151, "Munición olvidada", "Encontraste 3 balas de rifle."],
    ["ammo-forest-5", "ammo", 38, -92, "Caja de cazador", "Encontraste 3 balas de rifle."],
    ["ammo-forest-6", "ammo", 82, -128, "Cartuchos secos", "Encontraste 3 balas de rifle."],
    ["medkit-north-1", "medkit", 112, -191, "Botiquín de emergencia", "Encontraste un botiquín."],
    ["berries-station-1", "berries", 119, -185, "Frutas silvestres", "Recogiste frutas silvestres."],
    ];
   // Suministros visibles en refugios, mesas y cajas abiertas; no cambian rutas de misión.
   const suministros = [
     ["bandage-cabin", "bandage", -2.2, -0.4, "Venda en el botiquín", "Recogiste una venda limpia."],
     ["food-ranger", "cannedFood", -28, -47.2, "Conserva sobre la mesa", "Recogiste una conserva."],
     ["water-riverside", "water", 29, -130.8, "Agua embotellada", "Recogiste agua potable."],
     ["map-lookout", "map", -94, -99.1, "Mapa de rutas", "El mapa marca refugios y una frecuencia."],
     ["tool-lookout", "tool", -92.5, -100, "Herramienta multiuso", "Recogiste una herramienta multiuso."],
     ["cable-station", "cable", 137, -194, "Cable de cobre", "Recogiste un cable de cobre."],
     ["key-hunter", "key", 89, -164.2, "Llave de caja", "Recogiste una llave de caja."],
     ["magazine-station", "ammoMagazine", 143, -196, "Cargador sellado", "Recogiste un cargador con tres cartuchos."],
     ["lore-ranger", "loreDocument", -28, -49.1, "Informe de guardabosques", "Registro guardado.", "El guardabosques anotó que la luz del fuego desviaba a la voz, pero nunca la apagaba del todo."],
     ["lore-town", "loreDocument", -45, -60.1, "Transcripción de radio", "Registro guardado.", "Frecuencia 106.4: dos voces de Daniel respondieron al mismo tiempo. Una pidió ayuda; la otra pidió silencio."],
   ];
   suministros.forEach(([id, type, x, z, label, message, noteText]) => pickups.push(crearRecogible(scene, id, type, new Vector3(x, alturaTerreno(x, z) + 0.52, z), label, message, noteText)));
   pickups.push(
     crearRecogible(scene, "field-receiver", "receiver", new Vector3(-84, alturaTerreno(-84, -108) + 0.7, -108), "Receptor de campo averiado", "El receptor vuelve a emitir una frecuencia baja."),
     crearRecogible(scene, "hunter-crate", "supplyCrate", new Vector3(96, alturaTerreno(96, -162) + 0.55, -162), "Caja de suministros cerrada", "La caja contiene provisiones."),
   );
  // Crea los recursos distribuidos por el bosque.
  recursosBosque.forEach(([id, type, x, z, label, message]) => {
    const altura = type === "berries" ? 0.5 : 0.42;
    pickups.push(
      crearRecogible(
        scene,
        id,
        type,
        new Vector3(x, alturaTerreno(x, z) + altura, z),
        label,
        message,
      ),
    );
  });
  const coleccionablesEstacion = [
    crearRecogible(
      scene,
      "station-card",
      "card",
      new Vector3(150, alturaTerreno(150, -213) + 0.28, -213),
      "Tarjeta de seguridad luminosa",
      "Encontraste la tarjeta de acceso.",
    ),
    crearRecogible(
      scene,
      "station-fuse-a",
      "industrialFuse",
      new Vector3(140, alturaTerreno(140, -197) + 0.5, -197),
      "Fusible industrial",
      "Encontraste un fusible de estación.",
    ),
    crearRecogible(
      scene,
      "station-fuse-b",
      "industrialFuse",
      new Vector3(159, alturaTerreno(159, -205) + 0.5, -205),
      "Fusible industrial",
      "Encontraste un fusible de estación.",
    ),
    crearRecogible(
      scene,
      "station-fuse-c",
      "industrialFuse",
      new Vector3(151, alturaTerreno(151, -215) + 0.5, -215),
      "Fusible industrial",
      "Encontraste un fusible de estación.",
    ),
    crearRecogible(
      scene,
      "station-generator",
      "generator",
      new Vector3(150, alturaTerreno(150, -210) + 0.7, -210),
      "Panel de generadores",
      "Los tres generadores vuelven a rugir.",
    ),
    crearRecogible(
      scene,
      "station-transmitter",
      "transmitter",
      new Vector3(150, alturaTerreno(150, -218) + 0.9, -218),
      "Transmisor con la voz de Daniel",
      "La grabación señala Valleverde: busca primero el hospital.",
    ),
  ];
  // Asigna el capítulo a los objetos de la estación.
  coleccionablesEstacion.forEach(
    (coleccionable) => (coleccionable.metadata.chapter = 2),
  );
  pickups.push(...coleccionablesEstacion);
  const objetivosPosteriores = [
    ["signal-1", "transmitter", 112, -185, "Transmisor entre los pinos", "Una voz imitada intenta alejarte del pueblo."],
    ["signal-2", "transmitter", 90, -165, "Segundo transmisor", "Otra señal falsa. Daniel pasó por aquí, rumbo a Valleverde."],
    ["signal-3", "transmitter", -95, -100, "Repetidor de la torre", "La señal auténtica confirma: «Busca el hospital primero.»"],
    ["hospital-file", "document", -45, -61.5, "Expedientes del hospital", "Los pacientes oían voces bajo el suelo antes de desaparecer."],
    ["police-file", "document", -68, -61.5, "Informes de la comisaría", "Los apagones y las desapariciones coinciden junto al río."],
    ["gas-record", "document", -56, -87.5, "Registro de la gasolinera", "Un acceso de servicio bajo el río lleva a la caverna original."],
    // Estos tres elementos quedan delante del portal. El bloque del túnel es
    // opaco y ocultaba los objetos cuando se colocaban en su interior.
    ["cave-entry", "serviceDoor", 186, -164, "Entrada de servicio bajo el río", "El túnel conduce a las cámaras de bombeo."],
    ["cave-valve", "valve", 181.5, -164, "Válvula de seguridad", "La válvula baja el agua durante un intervalo seguro."],
    ["daniel-cave", "daniel", 190.5, -164, "Daniel Ortega", "Daniel está herido, pero consciente. Hay que activar el núcleo de la estación."],
    ["final-panel", "finalPanel", 150, -200, "Panel final de bombeo", "Las bombas despiertan, las luces sellan la caverna y la compuerta exterior se abre."],
  ];
  objetivosPosteriores.forEach(([id, type, x, z, label, message]) => {
    const offset = ["transmitter", "serviceDoor", "valve", "finalPanel", "daniel"].includes(type) ? 0.85 : 0.42;
    const objeto = crearRecogible(scene, id, type, new Vector3(x, alturaTerreno(x, z) + offset, z), label, message);
    objeto.metadata.chapter = type === "transmitter" ? 3 : ["document"].includes(type) ? 4 : type === "finalPanel" ? 6 : 5;
    pickups.push(objeto);
  });
  return {
    pickups,
    campfires,
    echo,
    obstacles,
    alturaTerreno,
    stationPoint,
    townPoint,
    stairs: escaleras,
    // Calcula la altura de suelo incluidas plataformas y escaleras.
    groundHeight(x, z, upstairs) {
      const plataforma = plataformas.find(
        // Encuentra la plataforma que contiene las coordenadas.
        (zona) =>
          Math.abs(x - zona.x) < zona.halfX &&
          Math.abs(z - zona.z) < zona.halfZ,
      );
      const escalera = escaleras.find(
        // Encuentra la escalera que contiene las coordenadas.
        (zona) =>
          Math.abs(x - zona.x) < zona.halfX &&
          Math.abs(z - zona.z) < zona.halfZ,
      );
      if (escalera) {
        const progreso = Math.max(
          0,
          Math.min(1, (escalera.startZ - z) / (escalera.startZ - escalera.endZ)),
        );
        return (
          alturaTerreno(x, z) +
          progreso * (escalera.height - alturaTerreno(escalera.x, escalera.z))
        );
      }
      return upstairs && plataforma ? plataforma.height : alturaTerreno(x, z);
    },
    escapePoint,
    creature,
    isSafeMonsterPosition(x, z) {
      return decoracionSegura(x, z, 14) && Math.abs(x) < 210 && Math.abs(z) < 210;
    },
  };
}

// Construye la cabaña inicial y registra sus paredes como obstáculos.
function crearCabana(scene, obstacles) {
  const cabin = crearMaterial(scene, "cabin", "#4d3c28", "#100904");
  const floor = MeshBuilder.CreateBox(
    "cabin floor",
    { width: 8, height: 0.18, depth: 7 },
    scene,
  );
  floor.position.y = 0.1;
  floor.material = crearMaterial(scene, "floor", "#342a1d", "#090604");
  new PointLight("cabin lamp", new Vector3(0, 3.3, 0.8), scene).intensity = 1.4;
  [
    [-4, 0, 0.35, 3.5],
    [4, 0, 0.35, 3.5],
    [0, 3.5, 4, 0.25],
    [-2.8, -3.5, 1.2, 0.25],
    [2.8, -3.5, 1.2, 0.25],
  // Construye cada pared de la cabaña.
  ].forEach(([x, z, halfX, halfZ], i) => {
    const wall = MeshBuilder.CreateBox(
      `wall-${i}`,
      { width: halfX * 2, height: 4, depth: halfZ * 2 },
      scene,
    );
    wall.position.set(x, 2, z);
    wall.material = cabin;
    obstacles.push({ x, z, halfX, halfZ });
  });
  const roof = MeshBuilder.CreateBox(
    "roof",
    { width: 8.5, height: 0.25, depth: 7.5 },
    scene,
  );
  roof.position.y = 4.2;
  roof.material = crearMaterial(scene, "roof", "#16120e");
  const table = MeshBuilder.CreateBox(
    "table",
    { width: 1.8, height: 1.1, depth: 0.9 },
    scene,
  );
  table.position.set(1.6, 0.55, -0.4);
  table.material = crearMaterial(scene, "table", "#4a3824");
  const car = MeshBuilder.CreateBox(
    "vehicle",
    { width: 2.4, height: 1.15, depth: 4.4 },
    scene,
  );
  car.position.set(0, 0.65, -12);
  car.material = crearMaterial(scene, "vehicle", "#27312d");
  obstacles.push({ x: 0, z: -12, radius: 1.4 });
}
// Construye una casa pequeña de una planta.
function crearCasa(scene, obstacles, x, z, name) {
  const base = alturaTerreno(x, z);
  const wood = crearMaterial(scene, `${name} wood`, "#3c3022", "#0d0905");
  const floor = MeshBuilder.CreateBox(
    `${name} floor`,
    { width: 6, height: 0.16, depth: 5 },
    scene,
  );
  floor.position.set(x, base + 0.08, z);
  floor.material = wood;
  [
    [-3, 0, 0.25, 2.5],
    [3, 0, 0.25, 2.5],
    [0, 2.5, 3, 0.25],
    [-2.1, -2.5, 0.9, 0.25],
    [2.1, -2.5, 0.9, 0.25],
  // Construye cada pared de la casa.
  ].forEach(([offsetX, offsetZ, halfX, halfZ], index) => {
    const wall = MeshBuilder.CreateBox(
      `${name} wall ${index}`,
      { width: halfX * 2, height: 3.2, depth: halfZ * 2 },
      scene,
    );
    wall.position.set(x + offsetX, base + 1.6, z + offsetZ);
    wall.material = wood;
    obstacles.push({ x: x + offsetX, z: z + offsetZ, halfX, halfZ });
  });
  const roof = MeshBuilder.CreateBox(
    `${name} roof`,
    { width: 6.5, height: 0.25, depth: 5.5 },
    scene,
  );
  roof.position.set(x, base + 3.35, z);
  roof.material = crearMaterial(scene, `${name} roof mat`, "#17130f");
  const table = MeshBuilder.CreateBox(
    `${name} table`,
    { width: 1.4, height: 0.9, depth: 0.7 },
    scene,
  );
  table.position.set(x, base + 0.45, z + 0.65);
  table.material = crearMaterial(scene, `${name} table mat`, "#4c3924");
}
// Construye una casa grande de una sola planta.
function crearCasaGrande(scene, obstacles, x, z, name) {
  const base = alturaTerreno(x, z);
  const wood = crearMaterial(scene, `${name} wood`, "#493522", "#120b06");
  const floor = MeshBuilder.CreateBox(
    `${name} floor`,
    { width: 12, height: 0.18, depth: 10 },
    scene,
  );
  floor.position.set(x, base + 0.09, z);
  floor.material = wood;
  [
    [-6, 0, 0.28, 5],
    [6, 0, 0.28, 5],
    [0, 5, 6, 0.28],
    [-4.25, -5, 1.75, 0.28],
    [4.25, -5, 1.75, 0.28],
  // Construye cada pared de la casa grande.
  ].forEach(([offsetX, offsetZ, halfX, halfZ], index) => {
    const wall = MeshBuilder.CreateBox(
      `${name} wall ${index}`,
      { width: halfX * 2, height: 3.5, depth: halfZ * 2 },
      scene,
    );
    wall.position.set(x + offsetX, base + 1.75, z + offsetZ);
    wall.material = wood;
    obstacles.push({ x: x + offsetX, z: z + offsetZ, halfX, halfZ });
  });
  const roof = MeshBuilder.CreateBox(
    `${name} roof`,
    { width: 12.7, height: 0.32, depth: 10.7 },
    scene,
  );
  roof.position.set(x, base + 3.65, z);
  roof.material = crearMaterial(scene, `${name} roof mat`, "#17120e");
  const table = MeshBuilder.CreateBox(
    `${name} table`,
    { width: 2.2, height: 0.9, depth: 1 },
    scene,
  );
  table.position.set(x - 2.2, base + 0.45, z + 0.9);
  table.material = crearMaterial(scene, `${name} table mat`, "#563d25");
}
// Crea el tramo de río que atraviesa el norte del bosque.
function crearRio(scene) {
  const river = MeshBuilder.CreateGround(
    "remote river",
    { width: 90, height: 12, subdivisions: 1 },
    scene,
  );
  river.position.set(150, alturaTerreno(150, -175) + 0.1, -175);
  river.material = crearMaterial(scene, "remote river water", "#10454f", "#07313b");
}
// Construye la estación y devuelve su punto de referencia.
function crearEstacion(scene, obstacles) {
  const x = 150,
    z = -207,
    base = alturaTerreno(x, z),
    concrete = crearMaterial(scene, "station concrete", "#303a3b", "#071010");
  const floor = MeshBuilder.CreateBox(
    "station yard",
    { width: 30, height: 0.2, depth: 27 },
    scene,
  );
  floor.position.set(x, base + 0.1, z);
  floor.material = concrete;
  [
    [0, 9, 15, 0.3],
    [-14, 0, 0.3, 9],
    [14, 0, 0.3, 9],
    [-7, -8, 5, 0.3],
    [7, -8, 5, 0.3],
  // Construye cada muro de la estación.
  ].forEach(([ox, oz, hx, hz], i) => {
    const wall = MeshBuilder.CreateBox(
      `station wall ${i}`,
      { width: hx * 2, height: 5, depth: hz * 2 },
      scene,
    );
    wall.position.set(x + ox, base + 2.5, z + oz);
    wall.material = concrete;
    obstacles.push({ x: x + ox, z: z + oz, halfX: hx, halfZ: hz });
  });
  const roof = MeshBuilder.CreateBox(
    "station roof",
    { width: 28, height: 0.35, depth: 17 },
    scene,
  );
  roof.position.set(x, base + 5, z + 1);
  roof.material = crearMaterial(scene, "station roof mat", "#141c1d");
  const tunnel = MeshBuilder.CreateBox(
    "station maintenance floor",
    { width: 7, height: 0.14, depth: 15 },
    scene,
  );
  tunnel.position.set(x, base + 0.17, z - 13);
  tunnel.material = crearMaterial(scene, "station maintenance metal", "#263235", "#0b1314");
  return new Vector3(x, base, z);
}
// Construye el acceso exterior a la caverna; no introduce agua en edificios.
function crearTunelServicio(scene, obstacles) {
  const x = 186, z = -158, base = alturaTerreno(x, z);
  const concrete = crearMaterial(scene, "service tunnel concrete", "#364244", "#0b1516");
  const portal = MeshBuilder.CreateBox("service tunnel portal", { width: 18, height: 4, depth: 7 }, scene);
  portal.position.set(x, base + 2, z);
  portal.material = concrete;
  const opening = MeshBuilder.CreateBox("service tunnel darkness", { width: 8, height: 2.8, depth: 0.15 }, scene);
  opening.position.set(x, base + 1.6, z - 3.56);
  opening.material = crearMaterial(scene, "service tunnel dark", "#071012", "#020506");
  const water = MeshBuilder.CreateGround("cavern water", { width: 9, height: 5 }, scene);
  water.position.set(194, alturaTerreno(194, -158) + 0.12, -158);
  water.material = crearMaterial(scene, "cavern water material", "#10454f", "#07313b");
  obstacles.push({ x: x - 8.8, z, halfX: 0.25, halfZ: 3.5 }, { x: x + 8.8, z, halfX: 0.25, halfZ: 3.5 });
}
// Añade la luna y las estrellas según la calidad seleccionada.
function crearCielo(scene, calidad) {
  const moon = MeshBuilder.CreateSphere(
    "moon",
    { diameter: 5, segments: 16 },
    scene,
  );
  moon.position.set(26, 25, -52);
  moon.material = crearMaterial(scene, "moon mat", "#d6dbc4", "#d6dbc4");
  moon.applyFog = false;
  const stars = crearMaterial(scene, "stars", "#e8f1dc", "#e8f1dc");
  for (let i = 0; i < (calidad === "low" ? 150 : 420); i++) {
    const a = i * 2.399,
      r = 220 + (i % 61),
      s = MeshBuilder.CreateSphere(
        `star-${i}`,
        { diameter: 0.08 + (i % 4) * 0.03, segments: 4 },
        scene,
      );
    s.position.set(Math.cos(a) * r, 28 + ((i * 13) % 54), Math.sin(a) * r);
    s.material = stars;
    s.applyFog = false;
  }
}
// Crea la baliza que marca la salida del capítulo.
function crearSalida(scene) {
  const point = new Vector3(0, alturaTerreno(0, -210), -210);
  const base = MeshBuilder.CreateBox(
    "emergency radio cabinet",
    { width: 2.2, height: 1.5, depth: 0.8 },
    scene,
  );
  base.position.copyFrom(point).addInPlace(new Vector3(0, 0.75, 0));
  base.material = crearMaterial(scene, "emergency radio cabinet", "#26353a", "#1b4945");
  const panel = MeshBuilder.CreateBox(
    "emergency radio panel",
    { width: 1.35, height: 0.62, depth: 0.05 },
    scene,
  );
  panel.position.copyFrom(point).addInPlace(new Vector3(0, 1.05, -0.43));
  panel.material = crearMaterial(scene, "emergency radio panel", "#b7fff1", "#53eecf");
  const beacon = MeshBuilder.CreateCylinder(
    "north beacon",
    { height: 8, diameter: 0.28, tessellation: 8 },
    scene,
  );
  beacon.position.copyFrom(point).addInPlace(new Vector3(0, 5, 0));
  beacon.material = crearMaterial(scene, "beacon", "#8cc8c2", "#7cffeb");
  const light = new PointLight("north beacon light", beacon.position, scene);
  light.diffuse = Color3.FromHexString("#91fff0");
  light.intensity = 2.5;
  light.range = 22;
  return point;
}
// Crea a la criatura y prepara su estado de persecución.
function crearCriatura(scene) {
  const creature = MeshBuilder.CreateCylinder(
    "the listener",
    { height: 2.8, diameterTop: 0.45, diameterBottom: 0.8, tessellation: 6 },
    scene,
  );
  creature.position.set(0, alturaTerreno(0, -102) + 1.4, -102);
  creature.material = crearMaterial(scene, "listener", "#13181a", "#07100f");
  const head = MeshBuilder.CreateSphere(
    "listener head",
    { diameter: 0.64, segments: 6 },
    scene,
  );
  head.parent = creature;
  head.position.y = 1.55;
  head.material = crearMaterial(scene, "listener head mat", "#192225", "#0f2023");
  const limbMaterial = crearMaterial(scene, "listener limbs", "#101516", "#060908");
  const limbs = [];
  [
    [-0.42, 0.45, 0.1, "left arm"], [0.42, 0.45, -0.1, "right arm"],
    [-0.22, -0.65, 0, "left leg"], [0.22, -0.65, 0, "right leg"],
  ].forEach(([x, y, z, name], index) => {
    const limb = MeshBuilder.CreateCylinder(
      `listener ${name}`,
      { height: index < 2 ? 1.45 : 1.6, diameterTop: 0.13, diameterBottom: 0.2, tessellation: 5 },
      scene,
    );
    limb.parent = creature;
    limb.position.set(x, y, z);
    limb.rotation.z = index < 2 ? (index ? -0.16 : 0.16) : 0;
    limb.material = limbMaterial;
    limbs.push(limb);
  });
  const eyeMaterial = crearMaterial(scene, "listener eyes", "#b9f7cf", "#7cffbc");
  [-0.16, 0.16].forEach((x, index) => {
    const eye = MeshBuilder.CreateSphere(`listener eye ${index}`, { diameter: 0.11, segments: 4 }, scene);
    eye.parent = head;
    eye.position.set(x, 0.03, -0.28);
    eye.material = eyeMaterial;
  });
  creature.metadata = {
    alerted: false,
    home: creature.position.clone(),
    limbs,
    walkPhase: 0,
    nextAppearance: performance.now() + 11000,
  };
  return creature;
}
// Fogatas fijas, colocadas fuera de objetivos y con luz que se activa desde la lógica.
function crearFogata(scene, id, position) {
  const root = MeshBuilder.CreateCylinder(id, { height: 0.18, diameter: 1.35, tessellation: 9 }, scene);
  root.position.copyFrom(position);
  root.material = crearMaterial(scene, `${id}-stones`, "#4c5148");
  const ember = MeshBuilder.CreateSphere(`${id}-embers`, { diameter: 0.55, segments: 6 }, scene);
  ember.parent = root;
  ember.position.y = 0.22;
  ember.material = crearMaterial(scene, `${id}-embers-mat`, "#31130a", "#120401");
  const flame = MeshBuilder.CreateSphere(`${id}-flame`, { diameter: 0.55, segments: 5 }, scene);
  flame.parent = root;
  flame.position.y = 0.52;
  flame.scaling.y = 1.5;
  flame.material = crearMaterial(scene, `${id}-flame-mat`, "#ff7b25", "#ff5b16");
  flame.setEnabled(false);
  const light = new PointLight(`${id}-light`, position.add(new Vector3(0, 1.1, 0)), scene);
  light.diffuse = Color3.FromHexString("#ff9d4d");
  light.range = 15;
  light.intensity = 0;
  root.metadata = { id, type: "campfire", label: "ENCENDER FOGATA (1 LEÑA)", flame, light };
  return root;
}
// El Eco es lento y visualmente distinto; la IA decide cuándo puede manifestarse.
function crearEco(scene) {
  const echo = MeshBuilder.CreateBox("the echo", { width: 0.8, height: 2.35, depth: 0.28 }, scene);
  echo.position.set(-130, alturaTerreno(-130, -130) + 1.15, -130);
  echo.material = crearMaterial(scene, "echo material", "#29324d", "#253154");
  echo.isVisible = false;
  echo.metadata = { home: echo.position.clone(), nextMove: 0, nextAttack: 0 };
  return echo;
}
// Crea un objeto coleccionable con su forma, color y metadatos.
export function crearRecogible(
  scene,
  id,
  type,
  position,
  label,
  message,
  noteText = "",
) {
  const colores = {
    note: ["#e7dcba", "#6f5b32"],
    wood: ["#714624", "#24130a"],
    berries: ["#b5353d", "#4b0810"],
    battery: ["#d7b83d", "#5d4800"],
    knife: ["#bcc5c2", "#4a5654"],
    rifle: ["#4a3321", "#17120e"],
    ammo: ["#b58f39", "#3d2b0b"],
    medkit: ["#d6e3d5", "#a92424"],
    bandage: ["#ded7c0", "#7a6b4c"],
    cannedFood: ["#71846b", "#2e3e2e"],
    water: ["#79baca", "#23657a"],
    ammoMagazine: ["#6c5840", "#be9a4a"],
    key: ["#baa34d", "#75611f"],
    map: ["#d7c797", "#75633b"],
    tool: ["#aab7b0", "#3d4b47"],
    cable: ["#bd7438", "#5e2d17"],
    loreDocument: ["#d9e5d8", "#80cdbd"],
    receiver: ["#42585a", "#9ee9dd"],
    supplyCrate: ["#69492a", "#b99851"],
    fuse: ["#e2b848", "#534005"],
    radioFuse: ["#ffd65d", "#b87000"],
    industrialFuse: ["#e8c550", "#5c4700"],
    card: ["#5ab8bc", "#103f43"],
    generator: ["#3b4945", "#79e5b4"],
    daniel: ["#c4d5c6", "#24342a"],
    cassette: ["#293139", "#7de4d4"],
    transmitter: ["#384d55", "#5de7dc"],
    document: ["#d9e5d8", "#80cdbd"],
    serviceDoor: ["#465456", "#7de4d4"],
    valve: ["#a74837", "#f5a05c"],
    finalPanel: ["#35484a", "#80ffb1"],
  };
  let malla;
  if (type === "note") {
    malla = MeshBuilder.CreateBox(
      id,
      { width: 0.55, height: 0.05, depth: 0.72 },
      scene,
    );
  } else if (type === "wood") {
    malla = MeshBuilder.CreateCylinder(
      id,
      { height: 1.1, diameter: 0.26, tessellation: 8 },
      scene,
    );
    malla.rotation.z = Math.PI / 2;
  } else if (type === "battery") {
    malla = MeshBuilder.CreateBox(
      id,
      { width: 0.34, height: 0.72, depth: 0.34 },
      scene,
    );
  } else if (type === "knife") {
    malla = MeshBuilder.CreateBox(
      id,
      { width: 0.12, height: 0.08, depth: 0.8 },
      scene,
    );
    malla.rotation.y = 0.5;
  } else if (type === "rifle") {
    malla = MeshBuilder.CreateBox(
      id,
      { width: 0.16, height: 0.16, depth: 1.35 },
      scene,
    );
    malla.rotation.y = -0.35;
  } else if (type === "ammo") {
    malla = MeshBuilder.CreateBox(
      id,
      { width: 0.46, height: 0.28, depth: 0.34 },
      scene,
    );
  } else if (type === "medkit") {
    malla = MeshBuilder.CreateBox(
      id,
      { width: 0.48, height: 0.3, depth: 0.42 },
      scene,
    );
  } else if (type === "cassette") {
    malla = MeshBuilder.CreateBox(
      id,
      { width: 0.82, height: 0.16, depth: 0.52 },
      scene,
    );
  } else if (type === "radioFuse") {
    malla = MeshBuilder.CreateBox(
      id,
      { width: 1.05, height: 0.42, depth: 0.56 },
      scene,
    );
  } else if (type === "fuse" || type === "industrialFuse") {
    malla = MeshBuilder.CreateCylinder(
      id,
      {
        height: 0.5,
        diameter: 0.12,
        tessellation: 8,
      },
      scene,
    );
    malla.rotation.z = Math.PI / 2;
  } else if (type === "card") {
    malla = MeshBuilder.CreateBox(
      id,
      { width: 0.9, height: 0.12, depth: 0.58 },
      scene,
    );
  } else if (type === "generator" || type === "finalPanel" || type === "serviceDoor") {
    malla = MeshBuilder.CreateBox(
      id,
      { width: 1.1, height: 1.2, depth: 0.75 },
      scene,
    );
  } else if (type === "transmitter" || type === "valve") {
    malla = MeshBuilder.CreateCylinder(
      id,
      {
        height: type === "transmitter" ? 3.2 : 0.22,
        diameter: type === "transmitter" ? 0.7 : 1,
        tessellation: 10,
      },
      scene,
    );
  } else if (type === "document") {
    malla = MeshBuilder.CreateBox(id, { width: 0.68, height: 0.08, depth: 0.92 }, scene);
  } else if (type === "daniel") {
    malla = MeshBuilder.CreateCylinder(
      id,
      { height: 1.7, diameter: 0.5, tessellation: 6 },
      scene,
    );
  } else {
    malla = MeshBuilder.CreateSphere(id, { diameter: 0.42, segments: 8 }, scene);
    for (let i = 0; i < 4; i++) {
      const fruta = MeshBuilder.CreateSphere(
        `${id}-fruit-${i}`,
        { diameter: 0.26, segments: 6 },
        scene,
      );
      fruta.parent = malla;
      fruta.position.set(
        Math.cos(i * 1.57) * 0.24,
        0.1,
        Math.sin(i * 1.57) * 0.24,
      );
      fruta.material = crearMaterial(scene, `${id}-fruit-mat-${i}`, "#cc3943", "#350306");
    }
  }
  malla.position = position;
  malla.material = crearMaterial(scene, `${id}-mat`, colores[type][0], colores[type][1]);
  // Detail meshes are children: the interactable root retains its exact mission
  // position and metadata while the object has a recognizable silhouette.
  const detalle = (nombre, options, local, color) => {
    const mesh = MeshBuilder.CreateBox(`${id}-${nombre}`, options, scene);
    mesh.parent = malla;
    mesh.position.copyFrom(local);
    mesh.material = crearMaterial(scene, `${id}-${nombre}-mat`, color);
    return mesh;
  };
  if (type === "battery") {
    detalle("terminal", { width: 0.18, height: 0.09, depth: 0.18 }, new Vector3(0, 0.4, 0), "#d9ded0");
  } else if (type === "knife") {
    detalle("handle", { width: 0.18, height: 0.12, depth: 0.28 }, new Vector3(0, 0.02, 0.28), "#39271a");
  } else if (type === "rifle") {
    detalle("barrel", { width: 0.07, height: 0.07, depth: 0.92 }, new Vector3(0, 0.08, -0.65), "#85908c");
    detalle("stock", { width: 0.22, height: 0.2, depth: 0.48 }, new Vector3(0, -0.03, 0.52), "#684124");
  } else if (type === "ammo") {
    [-0.12, 0, 0.12].forEach((x, index) => {
      const cartridge = MeshBuilder.CreateCylinder(`${id}-cartridge-${index}`, { height: 0.3, diameter: 0.07, tessellation: 6 }, scene);
      cartridge.parent = malla;
      cartridge.position.set(x, 0.22, 0);
      cartridge.material = crearMaterial(scene, `${id}-cartridge-mat-${index}`, "#c99a3a");
    });
  } else if (type === "medkit") {
    detalle("cross-vertical", { width: 0.07, height: 0.04, depth: 0.28 }, new Vector3(0, 0.17, -0.22), "#b62d2d");
    detalle("cross-horizontal", { width: 0.28, height: 0.04, depth: 0.07 }, new Vector3(0, 0.17, -0.22), "#b62d2d");
  } else if (type === "generator" || type === "finalPanel") {
    detalle("screen", { width: 0.55, height: 0.34, depth: 0.04 }, new Vector3(0, 0.18, -0.4), "#7dffbd");
  } else if (type === "serviceDoor") {
    detalle("window", { width: 0.48, height: 0.34, depth: 0.04 }, new Vector3(0, 0.2, -0.4), "#13292a");
    detalle("access-light", { width: 0.1, height: 0.1, depth: 0.05 }, new Vector3(0.38, -0.22, -0.4), "#7dffdb");
  } else if (type === "transmitter") {
    const antenna = MeshBuilder.CreateCylinder(`${id}-antenna`, { height: 1.45, diameter: 0.06, tessellation: 6 }, scene);
    antenna.parent = malla;
    antenna.position.y = 2.2;
    antenna.material = crearMaterial(scene, `${id}-antenna-mat`, "#9bc6bf");
  } else if (type === "valve") {
    const handle = MeshBuilder.CreateTorus(`${id}-wheel`, { diameter: 0.85, thickness: 0.1, tessellation: 10 }, scene);
    handle.parent = malla;
    handle.rotation.x = Math.PI / 2;
    handle.position.z = -0.13;
    handle.material = crearMaterial(scene, `${id}-wheel-mat`, "#d45b43");
  } else if (type === "daniel") {
    const head = MeshBuilder.CreateSphere(`${id}-head`, { diameter: 0.38, segments: 6 }, scene);
    head.parent = malla;
    head.position.y = 0.98;
    head.material = crearMaterial(scene, `${id}-head-mat`, "#c8b298");
    [-0.25, 0.25].forEach((x, index) => {
      const arm = MeshBuilder.CreateCylinder(`${id}-arm-${index}`, { height: 0.9, diameter: 0.12, tessellation: 5 }, scene);
      arm.parent = malla;
      arm.position.set(x, 0.05, 0);
      arm.rotation.z = index ? -0.25 : 0.25;
      arm.material = crearMaterial(scene, `${id}-arm-mat-${index}`, "#4c5c4d");
    });
  }
  if (["radioFuse", "transmitter", "document", "serviceDoor", "valve", "finalPanel", "daniel"].includes(type)) {
    const luzFusible = new PointLight(
      `${id}-light`,
      position.add(new Vector3(0, 0.45, 0)),
      scene,
    );
    luzFusible.diffuse = Color3.FromHexString(type === "valve" ? "#ff9b55" : "#7de4d4");
    luzFusible.intensity = type === "transmitter" ? 3 : type === "radioFuse" ? 0.45 : 1.1;
    luzFusible.range = type === "transmitter" ? 18 : type === "radioFuse" ? 3.5 : 7;
  }
  if (type === "card") {
    const luzTarjeta = new PointLight(
      `${id}-light`,
      position.add(new Vector3(0, 0.3, 0)),
      scene,
    );
    luzTarjeta.diffuse = Color3.FromHexString("#5ab8bc");
    luzTarjeta.intensity = 0.8;
    luzTarjeta.range = 4;
  }
  malla.metadata = { id, type, label, message, noteText };
  return malla;
}
// Construye el pueblo evacuado lejos del río para futuras investigaciones.
function crearPuebloEvacuado(scene, obstacles) {
  const edificios = [
    [-45, -58, "hospital", "HOSPITAL", "#596b70"],
    [-68, -58, "police", "COMISARÍA", "#4f5d66"],
    [-56, -84, "gas station", "GASOLINERA", "#665745"],
  ];
  edificios.forEach(([x, z, nombre, letrero, color]) => {
    const base = alturaTerreno(x, z);
    const paredMaterial = crearMaterial(scene, `${nombre} walls`, color, "#10191b");
    const suelo = MeshBuilder.CreateBox(`${nombre} floor`, { width: 13, height: 0.2, depth: 10 }, scene);
    suelo.position.set(x, base + 0.1, z);
    suelo.material = paredMaterial;
    [[-6.3, 0, 0.25, 5], [6.3, 0, 0.25, 5], [0, 4.8, 6.5, 0.25], [-4.4, -4.8, 1.7, 0.25], [4.4, -4.8, 1.7, 0.25]].forEach(([ox, oz, hx, hz], indice) => {
      const pared = MeshBuilder.CreateBox(`${nombre} wall ${indice}`, { width: hx * 2, height: 3.6, depth: hz * 2 }, scene);
      pared.position.set(x + ox, base + 1.8, z + oz);
      pared.material = paredMaterial;
      obstacles.push({ x: x + ox, z: z + oz, halfX: hx, halfZ: hz });
    });
    const techo = MeshBuilder.CreateBox(`${nombre} roof`, { width: 13.4, height: 0.3, depth: 10.4 }, scene);
    techo.position.set(x, base + 3.75, z);
    techo.material = crearMaterial(scene, `${nombre} roof material`, "#1a2021");
    const cartel = MeshBuilder.CreatePlane(`${nombre} sign`, { width: 7.8, height: 1.2 }, scene);
    cartel.position.set(x, base + 4.55, z - 5.15);
    const textura = new DynamicTexture(`${nombre} sign texture`, { width: 1024, height: 160 }, scene, false);
    textura.hasAlpha = true;
    textura.drawText(letrero, null, 112, "bold 86px Arial", "#d9fff1", "#122222", true);
    const materialCartel = new StandardMaterial(`${nombre} sign material`, scene);
    materialCartel.diffuseTexture = textura;
    materialCartel.emissiveTexture = textura;
    materialCartel.backFaceCulling = false;
    cartel.material = materialCartel;
  });
  return new Vector3(-56, alturaTerreno(-56, -70), -70);
}
