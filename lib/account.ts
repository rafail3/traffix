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
