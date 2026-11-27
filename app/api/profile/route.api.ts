// The signed-in user's cloud copy of their brand list and saved games.
// GET returns it ({ data: null } before the first upload), PUT replaces it.
import { currentUser, getAuth } from "@/lib/auth";
import { json, preflight, withCors } from "@/lib/cors";
import { isCloudData } from "@/lib/sync";

type Row = { id: string; userId: string; data: string; updatedAt: Date };
const MAX_BYTES = 512 * 1024;

export const GET = withCors(async (req) => {
  const user = await currentUser(req);
  if (!user) return json({ error: "Nu ești conectat." }, 401);
  const ctx = await getAuth().$context;
  const row = await ctx.adapter.findOne<Row>({ model: "profileData", where: [{ field: "userId", value: user.id }] });
  return json({ data: row ? JSON.parse(row.data) : null, updatedAt: row?.updatedAt ?? null });
});

export const PUT = withCors(async (req) => {
  const user = await currentUser(req);
  if (!user) return json({ error: "Nu ești conectat." }, 401);
  const text = await req.text();
  if (text.length > MAX_BYTES) return json({ error: "Prea multe date." }, 413);
  let data: unknown;
  try { data = JSON.parse(text)?.data; } catch { return json({ error: "Date greșite." }, 400); }
  if (!isCloudData(data)) return json({ error: "Date greșite." }, 400);

  const ctx = await getAuth().$context;
  const where = [{ field: "userId", value: user.id }];
  const fields = { data: JSON.stringify(data), updatedAt: new Date() };
  const existing = await ctx.adapter.findOne<Row>({ model: "profileData", where });
  if (existing) await ctx.adapter.update({ model: "profileData", where, update: fields });
  else await ctx.adapter.create({ model: "profileData", data: { userId: user.id, ...fields } });
  return json({ ok: true, updatedAt: fields.updatedAt });
});

export const OPTIONS = preflight;
