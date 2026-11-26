import { DEFAULT_BRANDS } from "./brands";
import type { Game } from "./rank";

export type Item = { name: string; n: number };

/**
 * Everything about one user lives here: their own brand list (with the counts of
 * the game in progress) and their saved games. Local only for now; the id is what
 * an account will claim when profiles move to a database.
 */
export type Profile = { id: string; createdAt: number; rows: Item[]; games: Game[] };

const KEY = "traffix-profile-v1";

const fresh = (): Profile => ({
  id: crypto.randomUUID(),
  createdAt: Date.now(),
  rows: DEFAULT_BRANDS.map((name) => ({ name, n: 0 })),
  games: [],
});

export function loadProfile(): Profile {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (p && typeof p.id === "string" && Array.isArray(p.rows) && Array.isArray(p.games)) return p;
  } catch {}
  const p = fresh();
  saveProfile(p);
  return p;
}

export function saveProfile(p: Profile) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...p, rows: p.rows.map(({ name, n }) => ({ name, n })) }));
  } catch {}
}
