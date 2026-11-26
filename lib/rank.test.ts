// Run: node --test lib/
import { test } from "node:test";
import assert from "node:assert/strict";
import { rankBrands, type Game } from "./rank.ts";

const D = ["Dacia", "Volkswagen", "Renault", "Ford", "Opel"];
let t = 0;
const game = (counts: Record<string, number>): Game => ({ id: "g" + t, name: "", savedAt: ++t, counts });

test("no games: default popularity order, custom brands last", () => {
  assert.deepEqual(rankBrands(["Mazda2", "Ford", "Dacia", "Renault"], [], D), ["Dacia", "Renault", "Ford", "Mazda2"]);
});

test("brands seen most in past games move up", () => {
  const games = [game({ Dacia: 2, Volkswagen: 1, Renault: 1, Ford: 20, Opel: 0 }), game({ Dacia: 3, Volkswagen: 1, Renault: 0, Ford: 15, Opel: 1 })];
  assert.equal(rankBrands(D, games, D)[0], "Ford");
});

test("never drops or invents a brand; ignores brands no longer in the list", () => {
  const games = [game({ Dacia: 1, Skoda: 50, Opel: 9 })];
  const out = rankBrands(["Opel", "Dacia", "Ford"], games, D);
  assert.deepEqual([...out].sort(), ["Dacia", "Ford", "Opel"]);
  assert.equal(out[0], "Opel");
});

test("a short game counts as much as a long one (shares, not raw counts)", () => {
  // Raw totals favour Dacia (62 vs 48); shares favour Volkswagen.
  const games = [game({ Dacia: 60, Volkswagen: 40 }), game({ Dacia: 2, Volkswagen: 8 })];
  assert.deepEqual(rankBrands(["Dacia", "Volkswagen"], games, D), ["Volkswagen", "Dacia"]);
});

test("a brand added later is not dragged down by games it was not part of", () => {
  const old = Array.from({ length: 5 }, () => game({ Dacia: 5, Volkswagen: 5 }));
  const recent = game({ Dacia: 5, Volkswagen: 5, Opel: 10 });
  assert.equal(rankBrands(["Dacia", "Volkswagen", "Opel"], [...old, recent], D)[0], "Opel");
});

test("recent games weigh more than old ones", () => {
  const old = Array.from({ length: 10 }, () => game({ Dacia: 9, Volkswagen: 1 }));
  const recent = Array.from({ length: 8 }, () => game({ Dacia: 1, Volkswagen: 9 }));
  assert.equal(rankBrands(["Dacia", "Volkswagen"], [...old, ...recent], D)[0], "Volkswagen");
});

test("brand names match regardless of case and spaces", () => {
  const games = [game({ " opel ": 10, Dacia: 1 })];
  assert.equal(rankBrands(["Dacia", "Opel"], games, D)[0], "Opel");
});
