import { itemLabels } from "../data/items.js";

export function addItem(state, type, amount = 1) {
  state.inventory[type] = (state.inventory[type] || 0) + amount;
}

export function inventoryWeight(state) {
  return Object.entries(state.inventory).reduce(
    (total, [type, amount]) => total + (type === "ammo" ? 1 : amount),
    0,
  );
}

export function renderInventory(state) {
  const items = document.querySelector("#items");
  const entries = Object.entries(state.inventory).filter(
    ([type, amount]) => amount > 0 && type !== "note",
  );
  document.querySelector("#weight").textContent =
    `${inventoryWeight(state)} / 12`;
  const resources = entries
    .map(
      ([type, amount]) =>
        `<div class="item-row"><span>${itemLabels[type]}</span><b>x${amount}</b>${type === "medkit" ? `<button data-use-item="${type}">USAR</button>` : ""}<button data-delete-item="${type}">TIRAR</button></div>`,
    )
    .join("");
  const documents = (state.documents || [])
    .map(
      (document) =>
        `<div class="item-row document-row"><span>${document.title}</span><button data-read-note="${document.id}">LEER</button><button data-delete-note="${document.id}">TIRAR</button></div>`,
    )
    .join("");
  items.innerHTML =
    resources || documents ? `${resources}${documents}` : "<p>Vacía</p>";
}

export function renderJournal(state) {
  const journal = document.querySelector("#journal");
  journal.innerHTML = `<span>BITÁCORA</span>${state.journal.map((entry) => `<p>${entry}</p>`).join("")}`;
}
