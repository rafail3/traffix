export type Item = { name: string; n: number };

// Same key and format as the original single-file app.
const KEY = "numaratoare-masini-v1";

export const DEFAULT_BRANDS = [
  "Dacia", "Volkswagen", "Renault", "Skoda", "Ford", "Opel", "Toyota",
  "Hyundai", "BMW", "Mercedes-Benz", "Audi", "Kia", "Peugeot", "Suzuki",
];

export function loadItems(): Item[] | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

export function saveItems(items: Item[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.map(({ name, n }) => ({ name, n }))));
  } catch {}
}
