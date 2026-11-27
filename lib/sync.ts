import type { Game } from "./rank";
import type { Item } from "./storage";

/** What an account stores in the cloud: the brand list (with the game in progress) and saved games. */
export type CloudData = { rows: Item[]; games: Game[] };

const key = (name: string) => name.trim().toLowerCase();

/**
 * Merges this device into the account after logging in. Saved games from both sides are kept (by id).
 * The brand list follows the account, but the counts of the game running on this device win, and
 * brands that only exist here are added at the end, so nothing typed on this phone is lost.
 */
export function mergeProfiles(local: CloudData, remote: CloudData | null): CloudData {
  if (!remote) return local;
  const games = new Map<string, Game>();
  for (const g of [...remote.games, ...local.games]) games.set(g.id, g);

  const localCounts = new Map(local.rows.map((r) => [key(r.name), r.n]));
  const playingHere = local.rows.some((r) => r.n > 0);
  const rows: Item[] = remote.rows.map((r) => ({
    name: r.name,
    n: playingHere ? (localCounts.get(key(r.name)) ?? 0) : r.n,
  }));
  const known = new Set(rows.map((r) => key(r.name)));
  for (const r of local.rows) if (!known.has(key(r.name))) rows.push({ name: r.name, n: r.n });

  return { rows, games: [...games.values()].sort((a, b) => a.savedAt - b.savedAt) };
}

/** Server-side check of what a client uploads. */
export function isCloudData(d: unknown): d is CloudData {
  const v = d as CloudData;
  return !!v && Array.isArray(v.rows) && Array.isArray(v.games) &&
    v.rows.length <= 500 && v.games.length <= 5000 &&
    v.rows.every((r) => typeof r?.name === "string" && r.name.length <= 60 && Number.isInteger(r.n) && r.n >= 0) &&
    v.games.every((g) => typeof g?.id === "string" && typeof g.name === "string" && typeof g.savedAt === "number" && typeof g.counts === "object" && g.counts !== null);
}
