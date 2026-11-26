"use client";

import { Capacitor } from "@capacitor/core";
import { useEffect, useState } from "react";

const REPO = "rafail3/traffix";
// Stable link: GitHub always redirects it to the newest release's APK.
const APK_URL = `https://github.com/${REPO}/releases/latest/download/traffix.apk`;

type Latest = { version: string; mb: string };

/** "Descarcă pentru Android", shown on the website only once a release has an APK attached. */
export default function AndroidDownload() {
  const [latest, setLatest] = useState<Latest | null>(null);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;
    const ctrl = new AbortController();
    fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((rel) => {
        const apk = rel?.assets?.find((a: { name: string }) => a.name === "traffix.apk");
        if (apk) {
          setLatest({
            version: rel.tag_name,
            mb: new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 1 }).format(apk.size / 1048576),
          });
        }
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, []);

  if (!latest) return null;
  return (
    <div className="download">
      <a className="btn" href={APK_URL}>Descarcă pentru Android</a>
      <span className="download-meta">{latest.version} · {latest.mb}&nbsp;MB</span>
    </div>
  );
}
