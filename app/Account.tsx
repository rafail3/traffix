"use client";

import { Capacitor } from "@capacitor/core";
import {
  CheckCircle, CloudArrowUp, CloudCheck, CloudSlash, Copy, Eye, EyeSlash, Key, SignIn, SignOut, UserCircle, UserPlus,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  fieldError, formatRecoveryCode, normalizeUsername, placeholderEmail, USERNAME_RE, MIN_PASSWORD,
  type Field, type FormMode,
} from "@/lib/account";
import { mergeProfiles, type CloudData } from "@/lib/sync";

// The site calls its own API; the Android app (no server inside) calls the live site.
const API = typeof window !== "undefined" && Capacitor.isNativePlatform() ? "https://traffix-rafa.vercel.app" : "";
const STORE_KEY = "traffix-auth-v2"; // { token, user }: the user is kept so the panel shows up instantly
const UPLOAD_DELAY = 600;
const POLL_MS = 15_000; // pick up changes made on other devices while this one is open

type User = { id: string; username: string; displayUsername?: string; createdAt: string };
type Mode = FormMode | "code";
type Sync = "idle" | "saving" | "saved" | "offline";
type Stored = { token: string; user: User };

const readStore = (): Stored | null => {
  try {
    const stored = JSON.parse(localStorage.getItem(STORE_KEY) ?? "null");
    if (stored) return stored;
    // First version kept only the token: carry it over, the user is fetched on start.
    const legacy = localStorage.getItem("traffix-auth-v1");
    return legacy ? { token: legacy, user: null as unknown as User } : null;
  } catch { return null; }
};
const writeStore = (s: Stored | null) => {
  try { if (s) localStorage.setItem(STORE_KEY, JSON.stringify(s)); else localStorage.removeItem(STORE_KEY); } catch {}
};

// Better Auth answers with codes; these are the ones a person can run into.
const TAKEN = "Numele ăsta e deja luat. Alege altul.";
const messages: Record<string, string> = {
  USERNAME_IS_ALREADY_TAKEN: TAKEN,
  USERNAME_IS_ALREADY_TAKEN_PLEASE_TRY_ANOTHER: TAKEN,
  USER_ALREADY_EXISTS: TAKEN,
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: TAKEN,
  INVALID_USERNAME_OR_PASSWORD: "Numele de utilizator sau parola nu e corectă.",
  INVALID_USERNAME: "Numele poate avea doar litere, cifre, punct și _.",
  USERNAME_TOO_SHORT: "Numele trebuie să aibă cel puțin 3 caractere.",
  USERNAME_TOO_LONG: "Numele poate avea cel mult 20 de caractere.",
  PASSWORD_TOO_SHORT: `Parola trebuie să aibă cel puțin ${MIN_PASSWORD} caractere.`,
};
const OFFLINE = "Nu mă pot conecta la server. Verifică internetul și încearcă din nou.";

async function call<T>(path: string, init: RequestInit = {}, token = readStore()?.token): Promise<{ data: T; token: string | null }> {
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
  if (!res.ok) throw Object.assign(new Error(messages[data?.code] ?? data?.error ?? "Ceva n-a mers. Încearcă din nou."), { status: res.status });
  return { data, token: res.headers.get("set-auth-token") ?? data?.token ?? null };
}

const same = (a: CloudData, b: CloudData) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The optional account: sign up / in / out, the recovery code, and keeping the brand list and saved
 * games in the cloud. Without an account the game works exactly as before, on this device only.
 */
export function useAccount(local: CloudData | null, apply: (d: CloudData) => void) {
  // Starts from what this device remembers, so nothing waits for the network.
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<Mode | null>(null);
  const [code, setCode] = useState("");
  const [sync, setSync] = useState<Sync>("idle");
  const [retry, setRetry] = useState(0);
  const pulled = useRef(false); // the account's copy has been merged in at least once
  const dirty = useRef(false); // local changes not uploaded yet
  const busy = useRef(false);
  const localRef = useRef(local);
  localRef.current = local;
  const applyRef = useRef(apply);
  applyRef.current = apply;
  const lastSent = useRef<string>("");

  const forget = useCallback(() => {
    writeStore(null);
    setUser(null);
    setSync("idle");
    pulled.current = false;
  }, []);

  // Bring in the account's copy (other devices' changes). Skipped while this device has unsent edits.
  const pull = useCallback(async () => {
    const mine = localRef.current;
    if (!mine || busy.current || dirty.current) return;
    busy.current = true;
    try {
      const { data } = await call<{ data: CloudData | null }>("/api/profile");
      const merged = mergeProfiles(mine, data.data);
      pulled.current = true;
      lastSent.current = data.data ? JSON.stringify(data.data) : "";
      if (!same(merged, mine)) applyRef.current(merged);
      else if (!data.data || !same(merged, data.data)) setRetry((n) => n + 1); // account is behind: upload
      else setSync("saved");
    } catch (e) {
      if ((e as { status?: number }).status === 401) forget();
      else setSync("offline");
    } finally {
      busy.current = false;
    }
  }, [forget]);

  const signedIn = (token: string | null, u: User) => {
    if (token) writeStore({ token, user: u });
    pulled.current = false;
    dirty.current = false;
    setUser(u);
  };

  // On start: show the remembered account right away, then confirm it with the server.
  useEffect(() => {
    const stored = readStore();
    if (stored?.user) setUser(stored.user);
    setReady(true);
    if (!stored) return;
    call<{ user: User } | null>("/api/auth/get-session")
      .then(({ data }) => {
        if (data?.user) {
          writeStore({ token: stored.token, user: data.user });
          try { localStorage.removeItem("traffix-auth-v1"); } catch {}
          setUser(data.user);
        }
        else forget();
      })
      .catch(() => { /* offline: keep the remembered account, sync later */ });
  }, [forget]);

  // First merge once the device's data is loaded and the user is known.
  useEffect(() => {
    if (user && local && !pulled.current) pull();
  }, [user, local, pull]);

  // Keep up with other devices: when the app comes back to the screen, when the connection
  // returns, and every few seconds while it's open.
  useEffect(() => {
    if (!user) return;
    const again = () => { if (document.visibilityState === "visible") pull(); };
    const online = () => (dirty.current ? setRetry((n) => n + 1) : pull());
    document.addEventListener("visibilitychange", again);
    window.addEventListener("focus", again);
    window.addEventListener("online", online);
    const timer = window.setInterval(again, POLL_MS);
    return () => {
      document.removeEventListener("visibilitychange", again);
      window.removeEventListener("focus", again);
      window.removeEventListener("online", online);
      clearInterval(timer);
    };
  }, [user, pull]);

  // Every change is uploaded a moment later (only what actually changed).
  useEffect(() => {
    if (!user || !local || !pulled.current) return;
    const body = JSON.stringify(local);
    if (body === lastSent.current) { setSync("saved"); return; }
    dirty.current = true;
    setSync("saving");
    const t = setTimeout(() => {
      call("/api/profile", { method: "PUT", body: JSON.stringify({ data: local }) })
        .then(() => { lastSent.current = body; dirty.current = false; setSync("saved"); })
        .catch((e) => { if ((e as { status?: number }).status === 401) forget(); else setSync("offline"); });
    }, UPLOAD_DELAY);
    return () => clearTimeout(t);
  }, [user, local, retry, forget]);

  const signUp = async (username: string, password: string) => {
    const u = normalizeUsername(username);
    const { data, token } = await call<{ user: User }>("/api/auth/sign-up/email", {
      method: "POST",
      body: JSON.stringify({ email: placeholderEmail(u), name: u, username: u, password }),
    });
    const rec = await call<{ code: string }>("/api/account/recovery", { method: "POST" }, token ?? undefined);
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
    const token = readStore()?.token;
    forget(); // instant; the server is told in the background
    if (token) call("/api/auth/sign-out", { method: "POST", body: "{}" }, token).catch(() => {});
  };

  return { user, ready, mode, setMode, code, sync, signUp, signIn, recover, newCode, signOut };
}

export type Account = ReturnType<typeof useAccount>;

const memberSince = (iso: string) =>
  new Date(iso).toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" });

const syncText: Record<Sync, string> = {
  idle: "",
  saving: "Se salvează în cont…",
  saved: "Totul e salvat în cont",
  offline: "Fără conexiune. Salvez când revine internetul.",
};

/** Account panel: in the side column on wide screens and at the top of the menu. */
export function AccountPanel({ acc, id, savedGames }: { acc: Account; id: string; savedGames: number }) {
  if (!acc.ready) return null;
  if (!acc.user) {
    return (
      <section className="panel" aria-labelledby={id}>
        <div className="panel-head">
          <UserCircle size={26} weight="duotone" className="panel-icon" aria-hidden="true" />
          <h2 id={id}>Contul tău</h2>
        </div>
        <p className="panel-text">Opțional. Cu un cont, jocurile salvate și lista ta de mărci te urmează pe orice telefon sau laptop.</p>
        <div className="panel-actions split">
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

const fieldsFor: Record<FormMode, Field[]> = {
  signin: ["username", "password"],
  signup: ["username", "password"],
  recover: ["username", "code", "password"],
};
const EMPTY = { username: "", code: "", password: "" };

/** Checks, while the user types, whether a username is still free (sign-up only). */
function useUsernameCheck(mode: Mode | null, username: string) {
  const [state, setState] = useState<"" | "checking" | "free" | "taken">("");
  useEffect(() => {
    const u = normalizeUsername(username);
    if (mode !== "signup" || !USERNAME_RE.test(u)) { setState(""); return; }
    setState("checking");
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`${API}/api/auth/is-username-available`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: u }), signal: ctrl.signal,
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setState(d?.available === false ? "taken" : d?.available ? "free" : ""))
        .catch(() => setState(""));
    }, 350);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [mode, username]);
  return state;
}

/** One dialog for every account step: sign in, sign up, forgotten password, and showing the recovery code. */
export function AccountDialog({ acc }: { acc: Account }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const mode = acc.mode;
  const nameState = useUsernameCheck(mode, values.username);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (mode && !d.open) d.showModal();
    if (!mode && d.open) d.close();
    // Switching between sign in / sign up / recover keeps the username, clears the rest.
    setValues((v) => ({ ...EMPTY, username: v.username }));
    setErrors({});
    setFormError("");
    setCopied(false);
    setShowPass(false);
  }, [mode]);

  const close = () => { if (!busy) acc.setMode(null); };

  const check = (f: Field, value: string) => (mode && mode !== "code" ? fieldError(mode, f, value) : "");

  function change(f: Field, raw: string) {
    const value = f === "code" ? formatRecoveryCode(raw) : raw;
    setValues((v) => ({ ...v, [f]: value }));
    setFormError("");
    // A field that already shows an error re-checks on every keystroke, so it clears the moment it's right.
    if (errors[f]) setErrors((e) => ({ ...e, [f]: check(f, value) }));
  }

  const blur = (f: Field) => { if (values[f]) setErrors((e) => ({ ...e, [f]: check(f, values[f]) })); };

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!mode || mode === "code") return;
    const found: Partial<Record<Field, string>> = {};
    for (const f of fieldsFor[mode]) {
      const msg = check(f, values[f]);
      if (msg) found[f] = msg;
    }
    if (mode === "signup" && nameState === "taken") found.username = TAKEN;
    setErrors(found);
    const first = fieldsFor[mode].find((f) => found[f]);
    if (first) { document.getElementById(`acc-${first}`)?.focus(); return; }

    setBusy(true);
    setFormError("");
    try {
      if (mode === "signup") await acc.signUp(values.username, values.password);
      else if (mode === "signin") await acc.signIn(values.username, values.password);
      else await acc.recover(values.username, values.code, values.password);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg === TAKEN) { setErrors({ username: msg }); document.getElementById("acc-username")?.focus(); }
      else setFormError(msg);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try { await navigator.clipboard.writeText(acc.code); setCopied(true); } catch {}
  }

  const describe = (f: Field, hint?: string) => [errors[f] ? `acc-${f}-err` : "", hint ?? ""].filter(Boolean).join(" ") || undefined;
  const err = (f: Field) => errors[f] && <p id={`acc-${f}-err`} className="field-err" role="alert">{errors[f]}</p>;

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

              <label htmlFor="acc-username">Nume de utilizator</label>
              <input
                id="acc-username" name="username" value={values.username} autoComplete="username" autoCapitalize="none"
                spellCheck={false} maxLength={20} aria-invalid={!!errors.username} aria-describedby={describe("username", mode === "signup" ? "acc-username-state" : undefined)}
                onChange={(e) => change("username", e.target.value)} onBlur={() => blur("username")}
              />
              {err("username")}
              {mode === "signup" && !errors.username && nameState && nameState !== "checking" && (
                <p id="acc-username-state" className={`field-hint ${nameState === "taken" ? "bad" : "good"}`} aria-live="polite">
                  {nameState === "taken" ? TAKEN : "Numele e liber."}
                </p>
              )}

              {mode === "recover" && (
                <>
                  <label htmlFor="acc-code">Cod de recuperare</label>
                  <input
                    id="acc-code" name="code" value={values.code} autoComplete="one-time-code" autoCapitalize="characters"
                    spellCheck={false} inputMode="text" maxLength={19} className="mono"
                    aria-invalid={!!errors.code} aria-describedby={describe("code")}
                    onChange={(e) => change("code", e.target.value)} onBlur={() => blur("code")}
                  />
                  {err("code")}
                </>
              )}

              <label htmlFor="acc-password">{mode === "recover" ? "Parolă nouă" : "Parolă"}</label>
              <div className="pw">
                <input
                  id="acc-password" name="password" value={values.password} type={showPass ? "text" : "password"}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"} autoCapitalize="none" spellCheck={false}
                  aria-invalid={!!errors.password} aria-describedby={describe("password", mode !== "signin" ? "acc-password-hint" : undefined)}
                  onChange={(e) => change("password", e.target.value)} onBlur={() => blur("password")}
                />
                <button
                  type="button" className="pw-toggle" aria-pressed={showPass}
                  aria-label={showPass ? "Ascunde parola" : "Arată parola"} onClick={() => setShowPass((s) => !s)}
                >
                  {showPass ? <EyeSlash size={20} weight="bold" aria-hidden="true" /> : <Eye size={20} weight="bold" aria-hidden="true" />}
                </button>
              </div>
              {err("password")}
              {mode !== "signin" && !errors.password && (
                <p id="acc-password-hint" className="field-hint">Cel puțin {MIN_PASSWORD} caractere.</p>
              )}

              {formError && <p className="field-err form-err" role="alert">{formError}</p>}

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
