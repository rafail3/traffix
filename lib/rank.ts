export type Game = { id: string; name: string; savedAt: number; counts: Record<string, number> };

const HALF_LIFE = 10; // games: a game 10 saves old weighs half as much as the latest
const PRIOR = 0.5;    // the default popularity order counts like half an extra game
const ROUNDS = 60;

const key = (s: string) => s.trim().toLowerCase();

/**
 * Orders the user's own brand list for a new game. Never adds or drops a brand.
 *
 * Each brand gets a "strength" s such that, in any game, its expected share is
 * s / (sum of s over the brands that were in the list during that game). That way
 * a short game counts as much as a long one, and a brand added later is only
 * compared on the games it took part in. Strengths come from the usual
 * minorize-maximize iteration for this model, with recent games weighted more and
 * the default popularity order acting as a prior (an extra virtual game), so a user
 * with no saved games just gets the default order.
 */
export function rankBrands(brands: string[], games: Game[], defaults: string[]): string[] {
  const keys = brands.map(key);
  const idx = new Map(keys.map((k, i) => [k, i]));
  const n = brands.length;

  const defRank = new Map(defaults.map((b, i) => [key(b), i]));
  const prior = keys.map((k) => 1 / ((defRank.get(k) ?? defaults.length) + 2));
  const priorSum = prior.reduce((a, b) => a + b, 0);

  // Each game as {weight, shares of the listed brands present in it}.
  const sorted = [...games].sort((a, b) => b.savedAt - a.savedAt);
  const obs: { w: number; share: Map<number, number> }[] = [
    { w: PRIOR, share: new Map(prior.map((p, i) => [i, p / priorSum])) },
  ];
  sorted.forEach((g, age) => {
    const counts = new Map<number, number>();
    for (const [name, c] of Object.entries(g.counts)) {
      const i = idx.get(key(name));
      if (i !== undefined) counts.set(i, (counts.get(i) ?? 0) + Math.max(0, c));
    }
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    if (!total) return;
    for (const [i, c] of counts) counts.set(i, c / total);
    obs.push({ w: 0.5 ** (age / HALF_LIFE), share: counts });
  });

  let s = new Array<number>(n).fill(1 / n);
  for (let r = 0; r < ROUNDS; r++) {
    const num = new Array<number>(n).fill(0);
    const den = new Array<number>(n).fill(0);
    for (const o of obs) {
      let S = 0;
      for (const i of o.share.keys()) S += s[i];
      for (const [i, x] of o.share) { num[i] += o.w * x; den[i] += o.w / S; }
    }
    s = num.map((v, i) => v / den[i]);
    const sum = s.reduce((a, b) => a + b, 0);
    s = s.map((v) => v / sum);
  }

  return brands
    .map((b, i) => ({ b, i }))
    .sort((a, z) => s[z.i] - s[a.i] || a.i - z.i)
    .map((x) => x.b);
}
