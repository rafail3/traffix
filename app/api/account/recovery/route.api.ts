// POST: gives the signed-in user a new recovery code (right after sign-up, or to replace a lost one).
// Only its hash is stored; the plain code is in this response and nowhere else.
import { generateRecoveryCode, normalizeRecoveryCode } from "@/lib/account";
import { currentUser, getAuth } from "@/lib/auth";
import { json, preflight, withCors } from "@/lib/cors";

export const POST = withCors(async (req) => {
  const user = await currentUser(req);
  if (!user) return json({ error: "Nu ești conectat." }, 401);
  const ctx = await getAuth().$context;
  const code = generateRecoveryCode();
  await ctx.internalAdapter.updateUser(user.id, { recoveryHash: await ctx.password.hash(normalizeRecoveryCode(code)) });
  return json({ code });
});

export const OPTIONS = preflight;
