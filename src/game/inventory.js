import { etiquetasObjetos } from "../data/items.js";

// Añade una cantidad de un objeto al inventario persistente.
export function agregarObjeto(estado, tipo, cantidad = 1) {
  estado.inventory[tipo] = (estado.inventory[tipo] || 0) + cantidad;
}

// Calcula el peso ocupado por los objetos del inventario.
export function pesoInventario(estado) {
  return Object.entries(estado.inventory).reduce(
    (total, [tipo, cantidad]) => total + (tipo === "ammo" ? 1 : cantidad),
    0,
  );
}

// Dibuja los objetos y documentos actuales en la mochila.
export function renderizarInventario(estado) {
  const objetos = document.querySelector("#items");
  const entradas = Object.entries(estado.inventory).filter(
    ([tipo, cantidad]) => cantidad > 0 && tipo !== "note",
  );
  document.querySelector("#weight").textContent =
    `${pesoInventario(estado)} / 12`;
  const recursos = entradas
    .map(
      ([tipo, cantidad]) =>
        `<div class="item-row"><span>${etiquetasObjetos[tipo]}</span><b>x${cantidad}</b>${tipo === "medkit" ? `<button data-use-item="${tipo}">USAR</button>` : ""}<button data-delete-item="${tipo}">TIRAR</button></div>`,
    )
    .join("");
  const documentos = (estado.documents || [])
    .map(
      (document) =>
        `<div class="item-row document-row"><span>${document.title}</span><button data-read-note="${document.id}">LEER</button><button data-delete-note="${document.id}">TIRAR</button></div>`,
    )
    .join("");
  objetos.innerHTML =
    recursos || documentos ? `${recursos}${documentos}` : "<p>Vacía</p>";
}

// Dibuja las entradas de la bitácora de la partida.
export function renderizarBitacora(estado) {
  const bitacora = document.querySelector("#journal");
  bitacora.innerHTML = `<span>BITÁCORA</span>${estado.journal.map((entrada) => `<p>${entrada}</p>`).join("")}`;
}
