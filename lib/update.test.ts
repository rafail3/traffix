import { test } from "node:test";
import assert from "node:assert/strict";
import { isNewer, parseManifest } from "./update.ts";

const sha = "a".repeat(64);
const good = JSON.stringify({ versionName: "1.2.0", versionCode: 1002000, sha256: sha, size: 3600000, url: "https://github.com/rafail3/traffix/releases/download/v1.2.0/traffix.apk" });

test("reads a valid manifest", () => {
  assert.deepEqual(parseManifest(good)?.versionCode, 1002000);
});

test("rejects broken or unsafe manifests", () => {
  assert.equal(parseManifest("not json"), null);
  assert.equal(parseManifest(JSON.stringify({ versionName: "1.2.0", versionCode: "1002000", sha256: sha, url: "https://x" })), null);
  assert.equal(parseManifest(JSON.stringify({ versionName: "1.2.0", versionCode: 1002000, sha256: "abc", url: "https://x" })), null);
  assert.equal(parseManifest(JSON.stringify({ versionName: "1.2.0", versionCode: 1002000, sha256: sha, url: "http://x" })), null);
});

test("offers only a newer APK", () => {
  const m = parseManifest(good);
  assert.equal(isNewer(m, 1001000), true);
  assert.equal(isNewer(m, 1002000), false); // a web-only release reuses the same APK
  assert.equal(isNewer(m, 1003000), false);
  assert.equal(isNewer(null, 1), false);
});
