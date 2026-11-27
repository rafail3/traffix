"use client";

import { App as CapApp } from "@capacitor/app";
import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { ArrowCircleUp, DownloadSimple } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { isNewer, parseManifest, type Manifest } from "@/lib/update";

/** Native side: android/app/src/main/java/ro/traffix/app/ApkUpdaterPlugin.java */
type ApkUpdater = {
  fetchText(o: { url: string }): Promise<{ status: number; text: string }>;
  canInstall(): Promise<{ allowed: boolean }>;
  openInstallSettings(): Promise<void>;
  install(o: { url: string; sha256: string }): Promise<void>;
  addListener(e: "progress", fn: (p: { percent: number; stage?: string }) => void): Promise<PluginListenerHandle>;
};
const Updater = registerPlugin<ApkUpdater>("ApkUpdater");

// The APK's own version, published with every release (a web-only release copies the old one).
const MANIFEST_URL = "https://github.com/rafail3/traffix/releases/latest/download/traffix.json";
const KEY = "traffix-update-v1";

type Saved = { manifest: Manifest | null; dismissedCode: number };
type Phase =
  | { s: "idle" }
  | { s: "permission" }
  | { s: "downloading"; percent: number }
  | { s: "installing" }
  | { s: "error"; message: string };

const read = (): Saved => {
  try { return { manifest: null, dismissedCode: 0, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }; }
  catch { return { manifest: null, dismissedCode: 0 }; }
};
const write = (s: Saved) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} };

const errorText: Record<string, string> = {
  CHECKSUM: "Fișierul descărcat nu se potrivește cu versiunea publicată, așa că nu l-am instalat. Încearcă din nou.",
  NETWORK: "Descărcarea nu a mers. Verifică internetul și încearcă din nou.",
  DOWNLOAD: "Descărcarea nu a mers. Verifică internetul și încearcă din nou.",
  INSTALL: "Android nu a putut instala actualizarea. Încearcă din nou.",
};

export type AppUpdate = ReturnType<typeof useAppUpdate>;

/**
 * In the Android app only: on start and every time the app comes back to the foreground, compare
 * the installed APK with the newest published one. A newer APK opens the update dialog once per
 * version; after "Mai târziu" it stays in the menu (and survives restarts) until it's installed.
 */
export function useAppUpdate() {
  const native = Capacitor.isNativePlatform();
  const [installed, setInstalled] = useState<{ name: string; code: number } | null>(null);
  const [update, setUpdate] = useState<Manifest | null>(null);
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>({ s: "idle" });
  const resumeInstall = useRef(false);

  const check = useCallback(async () => {
    const info = await CapApp.getInfo();
    const code = Number(info.build) || 0;
    setInstalled({ name: info.version, code });
    const saved = read();
    // Show what we already know right away (works offline), then ask GitHub.
    if (isNewer(saved.manifest, code)) setUpdate(saved.manifest);
    else if (saved.manifest) write({ ...saved, manifest: null });
    try {
      const res = await Updater.fetchText({ url: MANIFEST_URL });
      const m = parseManifest(res.text);
      if (isNewer(m, code)) {
        write({ ...read(), manifest: m });
        setUpdate(m);
        if (read().dismissedCode !== m.versionCode) setOpen(true);
      } else if (m) {
        write({ ...read(), manifest: null });
        setUpdate(null);
      }
    } catch { /* offline or GitHub unreachable: keep what we had */ }
  }, []);

  const install = useCallback(async () => {
    if (!update) return;
    setOpen(true);
    const { allowed } = await Updater.canInstall();
    if (!allowed) { resumeInstall.current = true; setPhase({ s: "permission" }); return; }
    setPhase({ s: "downloading", percent: 0 });
    const sub = await Updater.addListener("progress", (p) =>
      setPhase(p.stage === "installing" ? { s: "installing" } : { s: "downloading", percent: Math.max(0, p.percent) }));
    try {
      await Updater.install({ url: update.url, sha256: update.sha256 });
      setPhase({ s: "installing" }); // Android closes the app to replace it
    } catch (e) {
      const code = (e as { code?: string }).code ?? "";
      setPhase(code === "CANCELLED" ? { s: "idle" } : { s: "error", message: errorText[code] ?? errorText.INSTALL });
    } finally {
      sub.remove();
    }
  }, [update]);
  const installRef = useRef(install);
  installRef.current = install;

  useEffect(() => {
    if (!native) return;
    check();
    const sub = CapApp.addListener("resume", async () => {
      // Back from the "install unknown apps" screen: carry on if it was switched on.
      if (resumeInstall.current) {
        resumeInstall.current = false;
        if ((await Updater.canInstall()).allowed) { installRef.current(); return; }
        setPhase({ s: "idle" });
      }
      check();
    });
    return () => { sub.then((s) => s.remove()); };
  }, [native, check]);

  const later = () => {
    if (update) write({ ...read(), dismissedCode: update.versionCode });
    if (phase.s !== "downloading" && phase.s !== "installing") setPhase({ s: "idle" });
    setOpen(false);
  };

  return { native, installed, update, open, phase, install, later, openSettings: () => Updater.openInstallSettings() };
}

const mb = (bytes: number) => new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 1 }).format(bytes / 1048576);

export function UpdateDialog({ u }: { u: AppUpdate }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (u.open && !d.open) d.showModal();
    if (!u.open && d.open) d.close();
  }, [u.open]);
  if (!u.update) return null;

  const busy = u.phase.s === "downloading" || u.phase.s === "installing";
  return (
    <dialog ref={ref} className="dlg" aria-labelledby="upd-title" onCancel={(e) => { e.preventDefault(); if (!busy) u.later(); }}>
      <div className="dlg-stack">
      <h2 id="upd-title">Versiune nouă: v{u.update.versionName}</h2>
      <p className="dlg-sub">
        Ai acum v{u.installed?.name}. Jocurile salvate și lista ta rămân cum sunt.
        {u.update.size > 0 && <> Descărcarea are {mb(u.update.size)}&nbsp;MB.</>}
      </p>

      {u.phase.s === "permission" && (
        <p className="dlg-sub">Android îți cere o singură dată să permiți instalarea de actualizări din Traffix. Activează opțiunea și revino aici.</p>
      )}
      {(u.phase.s === "downloading" || u.phase.s === "installing") && (
        <div className="upd-progress">
          <progress max={100} value={u.phase.s === "installing" ? 100 : u.phase.percent} aria-label="Progresul descărcării" />
          <p aria-live="polite">
            {u.phase.s === "installing"
              ? "Se instalează… Aplicația se închide la final; o deschizi din nou și ai noua versiune."
              : `Se descarcă… ${u.phase.percent}%`}
          </p>
        </div>
      )}
      {u.phase.s === "error" && <p className="field-err" role="alert">{u.phase.message}</p>}

      <div className="dlg-actions">
        <button className="btn" type="button" onClick={u.later} disabled={busy}>Mai târziu</button>
        {u.phase.s === "permission" ? (
          <button className="btn primary" type="button" onClick={u.openSettings}>Deschide setările</button>
        ) : (
          <button className="btn primary" type="button" onClick={u.install} disabled={busy}>
            <DownloadSimple size={18} weight="bold" aria-hidden="true" />
            {u.phase.s === "error" ? "Încearcă din nou" : "Instalează"}
          </button>
        )}
      </div>
      </div>
    </dialog>
  );
}

/** Bottom of the app menu: the pending update (until it's installed), or the current version. */
export function UpdateBar({ u, onInstall }: { u: AppUpdate; onInstall: () => void }) {
  if (!u.native || !u.installed) return null;
  if (!u.update) return <p className="sheet-foot version">Traffix v{u.installed.name} · ai ultima versiune</p>;
  return (
    <div className="sheet-foot update-bar">
      <ArrowCircleUp size={26} weight="fill" aria-hidden="true" className="update-icon" />
      <div className="update-text">
        <strong>Actualizare disponibilă</strong>
        <span>v{u.installed.name} → v{u.update.versionName}</span>
      </div>
      <button className="btn primary" type="button" onClick={onInstall}>Instalează</button>
    </div>
  );
}
