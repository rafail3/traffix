/** What a release publishes as traffix.json: the APK's own version, not the release tag. */
export type Manifest = { versionName: string; versionCode: number; sha256: string; size: number; url: string };

/** Validates traffix.json; anything malformed is treated as "no update". */
export function parseManifest(text: string): Manifest | null {
  try {
    const m = JSON.parse(text);
    if (
      typeof m?.versionName === "string" && Number.isInteger(m.versionCode) && m.versionCode > 0 &&
      /^[0-9a-f]{64}$/i.test(m.sha256) && typeof m.url === "string" && m.url.startsWith("https://")
    ) return { versionName: m.versionName, versionCode: m.versionCode, sha256: m.sha256.toLowerCase(), size: Number(m.size) || 0, url: m.url };
  } catch {}
  return null;
}

/** An update is offered only when the published APK is newer than the installed one. */
export const isNewer = (m: Manifest | null, installedCode: number): m is Manifest =>
  !!m && m.versionCode > installedCode;
