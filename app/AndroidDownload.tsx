"use client";

import { Capacitor } from "@capacitor/core";
import { AndroidLogo, DownloadSimple } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

const REPO = "rafail3/traffix";
// Stable link: GitHub always redirects it to the newest release's APK.
const APK_URL = `https://github.com/${REPO}/releases/latest/download/traffix.apk`;

export type Apk =
  | { status: "loading" | "none" | "native" }
  | { status: "ready"; version: string; mb: string };

/** Latest released APK, read once from GitHub Releases. "native" inside the Android app itself. */
export function useLatestApk(): Apk {
  const [apk, setApk] = useState<Apk>({ status: "loading" });

  useEffect(() => {
    if (Capacitor.isNativePlatform()) { setApk({ status: "native" }); return; }
    const ctrl = new AbortController();
    // The list endpoint (not /latest) answers 200 with [] before the first release, so no 404 in the console.
    fetch(`https://api.github.com/repos/${REPO}/releases?per_page=1`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then(([rel]) => {
        const file = rel?.assets?.find((a: { name: string }) => a.name === "traffix.apk");
        setApk(file
          ? {
              status: "ready",
              version: rel.tag_name,
              mb: new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 1 }).format(file.size / 1048576),
            }
          : { status: "none" });
      })
      .catch(() => { if (!ctrl.signal.aborted) setApk({ status: "none" }); });
    return () => ctrl.abort();
  }, []);

  return apk;
}

function Qr() {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    import("qrcode").then((q) =>
      q.toString(APK_URL, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#16191d", light: "#ffffff" } }),
    ).then(setSvg, () => {});
  }, []);
  return <div className="qr" role="img" aria-label="Cod QR care descarcă aplicația" dangerouslySetInnerHTML={{ __html: svg }} />;
}

/** The Android app card: side panel on wide screens (with a QR to scan), menu sheet on phones. */
export function AndroidCard({ apk, qr = false }: { apk: Apk; qr?: boolean }) {
  const ready = apk.status === "ready";
  return (
    <section className="app-card" aria-labelledby={qr ? "app-card-title" : "app-sheet-title"}>
      <div className="app-card-head">
        <AndroidLogo size={28} weight="fill" aria-hidden="true" className="app-card-icon" />
        <h2 id={qr ? "app-card-title" : "app-sheet-title"}>Traffix pe Android</h2>
      </div>
      <p className="app-card-text">Aplicația merge și fără internet: numeri pe drum, salvezi jocul și îl vezi apoi în istoric.</p>
      {qr && ready && (
        <div className="app-card-qr">
          <Qr />
          <p>Scanează cu telefonul ca să descarci aplicația.</p>
        </div>
      )}
      {ready ? (
        <>
          <a className="btn primary block" href={APK_URL}>
            <DownloadSimple size={18} weight="bold" aria-hidden="true" />
            Descarcă APK
          </a>
          <p className="app-card-meta">{apk.version} · {apk.mb}&nbsp;MB · Android 7 sau mai nou</p>
        </>
      ) : (
        <p className="app-card-note">
          {apk.status === "loading" ? "Caut ultima versiune…" : "Prima versiune se construiește acum. Revino în câteva minute."}
        </p>
      )}
    </section>
  );
}
