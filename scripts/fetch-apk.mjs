// Runs before `next build` on Vercel: copies the newest released APK into the site, so
// /download serves the file itself from our own domain (no redirects through GitHub, which
// some phone browsers and QR scanners choke on). Writes public/apk/traffix-vX.Y.Z.apk and
// public/apk/latest.json. Never fails the build: without it, /download falls back to GitHub.
import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";

if (!process.env.VERCEL) process.exit(0);

const BASE = "https://github.com/rafail3/traffix/releases/latest/download";
const DIR = "public/apk";

try {
  const res = await fetch(`${BASE}/traffix.json`);
  if (!res.ok) throw new Error(`traffix.json: HTTP ${res.status}`);
  const m = await res.json();

  const apk = await fetch(m.url);
  if (!apk.ok) throw new Error(`APK: HTTP ${apk.status}`);
  const bytes = Buffer.from(await apk.arrayBuffer());
  const sha = createHash("sha256").update(bytes).digest("hex");
  if (sha !== m.sha256) throw new Error("APK checksum doesn't match traffix.json");

  const file = `traffix-v${m.versionName}.apk`;
  await rm(DIR, { recursive: true, force: true });
  await mkdir(DIR, { recursive: true });
  await writeFile(`${DIR}/${file}`, bytes);
  await writeFile(`${DIR}/latest.json`, JSON.stringify({ file, versionName: m.versionName, size: bytes.length }));
  console.log(`fetch-apk: ${file} (${bytes.length} bytes)`);
} catch (e) {
  console.warn(`fetch-apk: skipped, /download will redirect to GitHub (${e.message})`);
}
