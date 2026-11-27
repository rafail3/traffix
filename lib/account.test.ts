import { test } from "node:test";
import assert from "node:assert/strict";
import { USERNAME_RE, generateRecoveryCode, normalizeRecoveryCode, placeholderEmail } from "./account.ts";
import { isCloudData, mergeProfiles } from "./sync.ts";

test("recovery codes are 16 unambiguous characters in groups of four", () => {
  const c = generateRecoveryCode();
  assert.match(c, /^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
  assert.notEqual(c, generateRecoveryCode());
});

test("a recovery code typed sloppily still matches", () => {
  assert.equal(normalizeRecoveryCode(" ab0c-dEf1 o1il-2345 "), "AB0CDEF10111" + "2345");
});

test("usernames", () => {
  assert.ok(USERNAME_RE.test("rafa_99"));
  assert.ok(!USERNAME_RE.test("ra"));
  assert.ok(!USERNAME_RE.test("Rafa"));
  assert.ok(!USERNAME_RE.test("rafa ion"));
  assert.equal(placeholderEmail(" Rafa "), "rafa@users.traffix.invalid");
});

const game = (id: string, savedAt: number) => ({ id, name: id, savedAt, counts: {} });

test("merging keeps every saved game from both sides", () => {
  const m = mergeProfiles(
    { rows: [], games: [game("a", 1), game("b", 3)] },
    { rows: [], games: [game("b", 3), game("c", 2)] },
  );
  assert.deepEqual(m.games.map((g) => g.id), ["a", "c", "b"]);
});

test("the account's list wins, the game in progress on this device keeps its counts", () => {
  const m = mergeProfiles(
    { rows: [{ name: "Dacia", n: 4 }, { name: "Lada", n: 1 }], games: [] },
    { rows: [{ name: "BMW", n: 9 }, { name: "dacia", n: 2 }], games: [] },
  );
  assert.deepEqual(m.rows, [{ name: "BMW", n: 0 }, { name: "dacia", n: 4 }, { name: "Lada", n: 1 }]);
});

test("with nothing counted here, the account's counts are kept", () => {
  const m = mergeProfiles({ rows: [{ name: "Dacia", n: 0 }], games: [] }, { rows: [{ name: "Dacia", n: 5 }], games: [] });
  assert.deepEqual(m.rows, [{ name: "Dacia", n: 5 }]);
});

test("no account data yet: this device is uploaded as it is", () => {
  const local = { rows: [{ name: "Dacia", n: 1 }], games: [game("a", 1)] };
  assert.equal(mergeProfiles(local, null), local);
});

test("the server rejects malformed uploads", () => {
  assert.ok(isCloudData({ rows: [{ name: "Dacia", n: 1 }], games: [game("a", 1)] }));
  assert.ok(!isCloudData({ rows: [{ name: "Dacia", n: -1 }], games: [] }));
  assert.ok(!isCloudData({ rows: "x", games: [] }));
  assert.ok(!isCloudData(null));
});

import { fieldError, formatRecoveryCode } from "./account.ts";

test("the recovery code is grouped while typing", () => {
  assert.equal(formatRecoveryCode("abcd"), "ABCD");
  assert.equal(formatRecoveryCode("abcde"), "ABCD-E");
  assert.equal(formatRecoveryCode("ab cd-ef gh ij kl mn op qr st"), "ABCD-EFGH-1JK1-MN0P");
});

test("every empty or wrong field gets its own message", () => {
  assert.equal(fieldError("recover", "code", ""), "Scrie codul de recuperare.");
  assert.match(fieldError("recover", "code", "ABCD-EF"), /16 caractere/);
  assert.equal(fieldError("recover", "code", "ABCD-EFGH-JKMN-PQRS"), "");
  assert.equal(fieldError("signin", "username", "  "), "Scrie numele de utilizator.");
  assert.match(fieldError("signup", "username", "a b"), /3 și 20/);
  assert.equal(fieldError("signin", "username", "Ab"), "");
  assert.equal(fieldError("signin", "password", "x"), "");
  assert.match(fieldError("signup", "password", "short"), /cel puțin 8/);
  assert.equal(fieldError("recover", "password", ""), "Scrie parola nouă.");
});
