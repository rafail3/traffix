// POST { username, code, password }: forgotten password. The recovery code sets a new password,
// signs the account out everywhere and is replaced by a new code (each code works once).
import { MIN_PASSWORD, generateRecoveryCode, normalizeRecoveryCode, normalizeUsername } from "@/lib/account";
import { getAuth } from "@/lib/auth";
import { json, preflight, withCors } from "@/lib/cors";

type UserRow = { id: string; recoveryHash?: string | null };
const WRONG = "Numele de utilizator sau codul de recuperare nu e corect.";

export const POST = withCors(async (req) => {
  const body = await req.json().catch(() => null);
  const username = typeof body?.username === "string" ? normalizeUsername(body.username) : "";
  const code = typeof body?.code === "string" ? normalizeRecoveryCode(body.code) : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!username || code.length !== 16) return json({ error: WRONG }, 400);
  if (password.length < MIN_PASSWORD || password.length > 128) {
    return json({ error: `Parola nouă trebuie să aibă cel puțin ${MIN_PASSWORD} caractere.` }, 400);
  }

  const ctx = await getAuth().$context;
  const user = await ctx.adapter.findOne<UserRow>({ model: "user", where: [{ field: "username", value: username }] });
  const ok = !!user?.recoveryHash && (await ctx.password.verify({ password: code, hash: user.recoveryHash }));
  if (!user || !ok) return json({ error: WRONG }, 400);

  await ctx.internalAdapter.updatePassword(user.id, await ctx.password.hash(password));
  await ctx.internalAdapter.deleteUserSessions(user.id);
  const next = generateRecoveryCode();
  await ctx.internalAdapter.updateUser(user.id, { recoveryHash: await ctx.password.hash(normalizeRecoveryCode(next)) });
  return json({ code: next });
});

export const OPTIONS = preflight;
