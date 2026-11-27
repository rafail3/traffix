"use client";

import { Capacitor } from "@capacitor/core";
import { DownloadSimple } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { siAndroid } from "simple-icons";
import { Mark } from "./Mark";

const REPO = "rafail3/traffix";
// Our own short link: next.config.ts redirects /download to the newest release's APK, so the
// QR and the button start the download right away and never show a GitHub page.
const DOWNLOAD_PATH = "/download";

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
      q.toString(location.origin + DOWNLOAD_PATH, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#16191d", light: "#ffffff" } }),
    ).then(setSvg, () => {});
  }, []);
  return <div className="qr" role="img" aria-label="Cod QR care descarcă aplicația" dangerouslySetInnerHTML={{ __html: svg }} />;
}

/** The Android app card: side panel on wide screens (with a QR to scan), menu sheet on phones. */
export function AndroidCard({ apk, qr = false }: { apk: Apk; qr?: boolean }) {
  const ready = apk.status === "ready";
  return (
    <section className="panel" aria-labelledby={qr ? "app-card-title" : "app-sheet-title"}>
      <div className="panel-head">
        <Mark icon={siAndroid} size={26} className="panel-icon android" />
        <h2 id={qr ? "app-card-title" : "app-sheet-title"}>Traffix pe Android</h2>
      </div>
      <p className="panel-text">Aplicația merge și fără internet: numeri pe drum, salvezi jocul și îl vezi apoi în istoric.</p>
      {qr && ready && (
        <div className="panel-qr">
          <Qr />
          <p>Scanează cu telefonul ca să descarci aplicația.</p>
        </div>
      )}
      {ready ? (
        <>
          <a className="btn primary block" href={DOWNLOAD_PATH}>
            <DownloadSimple size={18} weight="bold" aria-hidden="true" />
            Descarcă APK
          </a>
          <p className="panel-meta">{apk.version} · {apk.mb}&nbsp;MB · Android 7+</p>
        </>
      ) : (
        <p className="panel-note">
          {apk.status === "loading" ? "Caut ultima versiune…" : "Prima versiune se construiește acum. Revino în câteva minute."}
        </p>
      )}
    </section>
  );
}
