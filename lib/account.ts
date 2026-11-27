// Account rules shared by the server routes and the forms. No I/O here, so it's easy to test.

/** 3-20 characters: lowercase letters, digits, dots and underscores (what the username plugin accepts). */
export const USERNAME_RE = /^[a-z0-9_.]{3,20}$/;
export const MIN_PASSWORD = 8;

export const normalizeUsername = (u: string) => u.trim().toLowerCase();

/** Accounts have no real email; Better Auth still needs one, so each user gets a reserved, undeliverable one. */
export const placeholderEmail = (username: string) => `${normalizeUsername(username)}@users.traffix.invalid`;

// Crockford base32: no I, L, O or U, so a code copied by hand can't be misread.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** 16 random characters (80 bits), shown as XXXX-XXXX-XXXX-XXXX. */
export function generateRecoveryCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const chars = Array.from(bytes, (b) => ALPHABET[b & 31]).join("");
  return chars.match(/.{4}/g)!.join("-");
}

/** Accepts the code however it was typed: lowercase, spaces, missing dashes, O for 0, I or L for 1. */
export function normalizeRecoveryCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
}

/** What the user typed, grouped as XXXX-XXXX-XXXX-XXXX while they type. */
export function formatRecoveryCode(input: string): string {
  const raw = normalizeRecoveryCode(input).replace(/[^0-9A-Z]/g, "").slice(0, 16);
  return raw.match(/.{1,4}/g)?.join("-") ?? "";
}

export type FormMode = "signin" | "signup" | "recover";
export type Field = "username" | "code" | "password";

/** The message for one field of an account form, or "" when it's fine. Runs as the user types. */
export function fieldError(mode: FormMode, field: Field, value: string): string {
  if (field === "username") {
    const u = normalizeUsername(value);
    if (!u) return "Scrie numele de utilizator.";
    if (mode === "signup" && !USERNAME_RE.test(u)) return "Între 3 și 20 de caractere: litere, cifre, punct sau _.";
    return "";
  }
  if (field === "code") {
    const c = normalizeRecoveryCode(value);
    if (!c) return "Scrie codul de recuperare.";
    if (c.length !== 16) return "Codul are 16 caractere, de forma XXXX-XXXX-XXXX-XXXX.";
    return "";
  }
  if (!value) return mode === "recover" ? "Scrie parola nouă." : "Scrie parola.";
  if (mode !== "signin" && value.length < MIN_PASSWORD) return `Parola trebuie să aibă cel puțin ${MIN_PASSWORD} caractere.`;
  return "";
}
