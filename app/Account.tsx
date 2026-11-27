"use client";

import { Capacitor } from "@capacitor/core";
import {
  CheckCircle, CloudArrowUp, CloudCheck, CloudSlash, Copy, Key, SignIn, SignOut, UserCircle, UserPlus,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { MIN_PASSWORD, USERNAME_RE, normalizeUsername, placeholderEmail } from "@/lib/account";
import { mergeProfiles, type CloudData } from "@/lib/sync";

// The site calls its own API; the Android app (no server inside) calls the live site.
const API = typeof window !== "undefined" && Capacitor.isNativePlatform() ? "https://traffix-rafa.vercel.app" : "";
const TOKEN_KEY = "traffix-auth-v1";

type User = { id: string; username: string; displayUsername?: string; createdAt: string };
type Mode = "signin" | "signup" | "recover" | "code";
type Sync = "idle" | "saving" | "saved" | "offline";

const readToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
const writeToken = (t: string | null) => {
  try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch {}
};

// Better Auth answers with codes; these are the ones a person can run into.
const messages: Record<string, string> = {
  USERNAME_IS_ALREADY_TAKEN: "Numele ăsta e deja luat. Alege altul.",
  USERNAME_IS_ALREADY_TAKEN_PLEASE_TRY_ANOTHER: "Numele ăsta e deja luat. Alege altul.",
  USER_ALREADY_EXISTS: "Numele ăsta e deja luat. Alege altul.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Numele ăsta e deja luat. Alege altul.",
  INVALID_USERNAME_OR_PASSWORD: "Numele de utilizator sau parola nu e corectă.",
  INVALID_USERNAME: "Numele poate avea doar litere mici, cifre, punct și _.",
  USERNAME_TOO_SHORT: "Numele trebuie să aibă cel puțin 3 caractere.",
  USERNAME_TOO_LONG: "Numele poate avea cel mult 20 de caractere.",
  PASSWORD_TOO_SHORT: `Parola trebuie să aibă cel puțin ${MIN_PASSWORD} caractere.`,
};
const OFFLINE = "Nu mă pot conecta la server. Verifică internetul și încearcă din nou.";

async function call<T>(path: string, init: RequestInit = {}): Promise<{ data: T; token: string | null }> {
  const token = readToken();
  let res: Response;
  try {
    res = await fetch(API + path, {
      ...init,
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...init.headers },
    });
  } catch {
    throw new Error(OFFLINE);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(messages[data?.code] ?? data?.error ?? "Ceva n-a mers. Încearcă din nou.");
  return { data, token: res.headers.get("set-auth-token") ?? data?.token ?? null };
}

/**
 * The optional account: sign up / in / out, the recovery code, and keeping the brand list and saved
 * games in the cloud. Without an account the game works exactly as before, on this device only.
 */
export function useAccount(local: CloudData | null, apply: (d: CloudData) => void) {
  const [user, setUser] = useState<User | null>(null);
  const [checked, setChecked] = useState(false);
  const [mode, setMode] = useState<Mode | null>(null);
  const [code, setCode] = useState("");
  const [sync, setSync] = useState<Sync>("idle");
  const [retry, setRetry] = useState(0);
  const pulled = useRef(false);
  const localRef = useRef(local);
  localRef.current = local;
  const applyRef = useRef(apply);
  applyRef.current = apply;

  // Merge the account's copy into this device. Applying it changes the local data, and the
  // upload effect below then sends the merged result back.
  const pulling = useRef(false);
  const pull = useCallback(async () => {
    const mine = localRef.current;
    if (!mine || pulling.current) return;
    pulling.current = true;
    try {
      const { data } = await call<{ data: CloudData | null }>("/api/profile");
      pulled.current = true;
      applyRef.current(mergeProfiles(mine, data.data));
    } catch {
      setSync("offline");
    } finally {
      pulling.current = false;
    }
  }, []);

  const signedIn = (token: string | null, u: User) => {
    writeToken(token);
    pulled.current = false;
    setUser(u);
  };

  // Restore the session on start.
  useEffect(() => {
    if (!readToken()) { setChecked(true); return; }
    call<{ user: User } | null>("/api/auth/get-session")
      .then(({ data }) => { if (data?.user) setUser(data.user); else writeToken(null); })
      .catch(() => { /* offline: stay signed in, sync later */ })
      .finally(() => setChecked(true));
  }, []);

  // First sync once the device's data is loaded and the user is known.
  useEffect(() => {
    if (user && local && !pulled.current) pull();
  }, [user, local, pull]);

  // Lost connection: try again as soon as the device is back online.
  useEffect(() => {
    if (!user) return;
    const again = () => (pulled.current ? setRetry((n) => n + 1) : pull());
    window.addEventListener("online", again);
    return () => window.removeEventListener("online", again);
  }, [user, pull]);

  // Every change is uploaded a moment later.
  useEffect(() => {
    if (!user || !local || !pulled.current) return;
    setSync("saving");
    const t = setTimeout(() => {
      call("/api/profile", { method: "PUT", body: JSON.stringify({ data: local }) })
        .then(() => setSync("saved"), () => setSync("offline"));
    }, 1500);
    return () => clearTimeout(t);
  }, [user, local, retry]);

  const signUp = async (username: string, password: string) => {
    const u = normalizeUsername(username);
    const { data, token } = await call<{ user: User }>("/api/auth/sign-up/email", {
      method: "POST",
      body: JSON.stringify({ email: placeholderEmail(u), name: u, username: u, password }),
    });
    writeToken(token);
    const rec = await call<{ code: string }>("/api/account/recovery", { method: "POST" });
    setCode(rec.data.code);
    setMode("code");
    signedIn(token, data.user);
  };

  const signIn = async (username: string, password: string) => {
    const { data, token } = await call<{ user: User }>("/api/auth/sign-in/username", {
      method: "POST",
      body: JSON.stringify({ username: normalizeUsername(username), password }),
    });
    setMode(null);
    signedIn(token, data.user);
  };

  const recover = async (username: string, recoveryCode: string, password: string) => {
    const { data } = await call<{ code: string }>("/api/account/recover", {
      method: "POST",
      body: JSON.stringify({ username, code: recoveryCode, password }),
    });
    await signIn(username, password);
    setCode(data.code);
    setMode("code");
  };

  const newCode = async () => {
    const { data } = await call<{ code: string }>("/api/account/recovery", { method: "POST" });
    setCode(data.code);
    setMode("code");
  };

  const signOut = async () => {
    await call("/api/auth/sign-out", { method: "POST", body: "{}" }).catch(() => {});
    writeToken(null);
    setUser(null);
    setSync("idle");
    pulled.current = false;
  };

  return { user, checked, mode, setMode, code, sync, signUp, signIn, recover, newCode, signOut };
}

export type Account = ReturnType<typeof useAccount>;

const memberSince = (iso: string) =>
  new Date(iso).toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" });

const syncText: Record<Sync, string> = {
  idle: "",
  saving: "Se salvează în cont…",
  saved: "Jocurile și lista sunt salvate în cont",
  offline: "Fără conexiune. Salvez când revine internetul.",
};

/** Account panel: in the side column on wide screens and at the top of the menu. */
export function AccountPanel({ acc, id, savedGames }: { acc: Account; id: string; savedGames: number }) {
  if (!acc.checked) return null;
  if (!acc.user) {
    return (
      <section className="panel" aria-labelledby={id}>
        <div className="panel-head">
          <UserCircle size={26} weight="duotone" className="panel-icon" aria-hidden="true" />
          <h2 id={id}>Contul tău</h2>
        </div>
        <p className="panel-text">Opțional. Cu un cont, jocurile salvate și lista ta de mărci te urmează pe orice telefon sau laptop.</p>
        <div className="panel-actions">
          <button className="btn primary" type="button" onClick={() => acc.setMode("signup")}>
            <UserPlus size={18} weight="bold" aria-hidden="true" />Creează cont
          </button>
          <button className="btn" type="button" onClick={() => acc.setMode("signin")}>
            <SignIn size={18} weight="bold" aria-hidden="true" />Intră în cont
          </button>
        </div>
      </section>
    );
  }
  const SyncIcon = acc.sync === "offline" ? CloudSlash : acc.sync === "saving" ? CloudArrowUp : CloudCheck;
  return (
    <section className="panel" aria-labelledby={id}>
      <div className="panel-head">
        <UserCircle size={26} weight="duotone" className="panel-icon" aria-hidden="true" />
        <h2 id={id}>{acc.user.displayUsername ?? acc.user.username}</h2>
      </div>
      <p className="panel-text">
        În Traffix din {memberSince(acc.user.createdAt)} · {savedGames} {savedGames === 1 ? "joc salvat" : "jocuri salvate"}
      </p>
      {acc.sync !== "idle" && (
        <p className={`sync-line ${acc.sync}`} aria-live="polite">
          <SyncIcon size={18} weight="bold" aria-hidden="true" />{syncText[acc.sync]}
        </p>
      )}
      <div className="panel-actions">
        <button className="btn" type="button" onClick={() => acc.newCode().catch(() => {})}>
          <Key size={18} weight="bold" aria-hidden="true" />Cod nou de recuperare
        </button>
        <button className="btn" type="button" onClick={acc.signOut}>
          <SignOut size={18} weight="bold" aria-hidden="true" />Ieși din cont
        </button>
      </div>
    </section>
  );
}

const titles: Record<Mode, string> = {
  signin: "Intră în cont",
  signup: "Creează cont",
  recover: "Ai uitat parola?",
  code: "Codul tău de recuperare",
};

/** One dialog for every account step: sign in, sign up, forgotten password, and showing the recovery code. */
export function AccountDialog({ acc }: { acc: Account }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const mode = acc.mode;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (mode && !d.open) d.showModal();
    if (!mode && d.open) d.close();
    setError("");
    setCopied(false);
  }, [mode]);

  const close = () => { if (!busy) acc.setMode(null); };

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const username = String(f.get("username") ?? "");
    const password = String(f.get("password") ?? "");
    if (mode === "signup" && !USERNAME_RE.test(normalizeUsername(username))) {
      setError("Numele trebuie să aibă 3-20 caractere: litere mici, cifre, punct sau _.");
      return;
    }
    if (mode !== "signin" && password.length < MIN_PASSWORD) {
      setError(`Parola trebuie să aibă cel puțin ${MIN_PASSWORD} caractere.`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (mode === "signup") await acc.signUp(username, password);
      else if (mode === "signin") await acc.signIn(username, password);
      else if (mode === "recover") await acc.recover(username, String(f.get("code") ?? ""), password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try { await navigator.clipboard.writeText(acc.code); setCopied(true); } catch {}
  }

  return (
    <dialog
      ref={ref}
      className="dlg"
      aria-labelledby="acc-title"
      // The recovery code is shown once: leaving it needs the button, not a stray back press.
      onCancel={(e) => { e.preventDefault(); if (mode !== "code") close(); }}
    >
      {mode && (
        <div className="dlg-stack">
          <h2 id="acc-title">{titles[mode]}</h2>

          {mode === "code" ? (
            <>
              <p className="dlg-sub">Notează-l undeva sigur. Dacă uiți parola, cu el îți faci una nouă. Nu-l mai afișăm a doua oară.</p>
              <output className="recovery-code" aria-label="Codul de recuperare">{acc.code}</output>
              <div className="dlg-actions">
                <button className="btn" type="button" onClick={copy}>
                  {copied ? <CheckCircle size={18} weight="bold" aria-hidden="true" /> : <Copy size={18} weight="bold" aria-hidden="true" />}
                  {copied ? "Copiat" : "Copiază"}
                </button>
                <button className="btn primary" type="button" onClick={() => acc.setMode(null)}>L-am salvat</button>
              </div>
            </>
          ) : (
            <form onSubmit={submit} noValidate>
              {mode === "recover" && (
                <p className="dlg-sub">Scrie numele de utilizator, codul de recuperare primit la crearea contului și o parolă nouă.</p>
              )}
              <label htmlFor="acc-user">Nume de utilizator</label>
              <input
                id="acc-user" name="username" required autoComplete="username" autoCapitalize="none"
                spellCheck={false} maxLength={20} placeholder={mode === "signup" ? "de ex. rafa_99" : undefined}
              />
              {mode === "recover" && (
                <>
                  <label htmlFor="acc-code">Cod de recuperare</label>
                  <input
                    id="acc-code" name="code" required autoComplete="one-time-code" autoCapitalize="characters"
                    spellCheck={false} placeholder="XXXX-XXXX-XXXX-XXXX" className="mono"
                  />
                </>
              )}
              <label htmlFor="acc-pass">{mode === "recover" ? "Parolă nouă" : "Parolă"}</label>
              <input
                id="acc-pass" name="password" type="password" required minLength={mode === "signin" ? undefined : MIN_PASSWORD}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
              {mode !== "signin" && <p className="field-hint">Cel puțin {MIN_PASSWORD} caractere.</p>}
              {error && <p className="field-err" role="alert">{error}</p>}

              {mode === "signin" && (
                <div className="dlg-links">
                  <button className="link-btn" type="button" onClick={() => acc.setMode("recover")}>Ai uitat parola?</button>
                  <button className="link-btn" type="button" onClick={() => acc.setMode("signup")}>Nu ai cont? Creează unul</button>
                </div>
              )}
              {mode === "signup" && (
                <div className="dlg-links">
                  <button className="link-btn" type="button" onClick={() => acc.setMode("signin")}>Ai deja cont? Intră</button>
                </div>
              )}

              <div className="dlg-actions">
                <button className="btn" type="button" onClick={close} disabled={busy}>Anulează</button>
                <button className="btn primary" type="submit" disabled={busy}>
                  {busy ? "Un moment…" : mode === "signup" ? "Creează contul" : mode === "signin" ? "Intră" : "Schimbă parola"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </dialog>
  );
}
