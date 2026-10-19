import { getUser } from "@/lib/auth";
import { ensureSchema } from "@/lib/db";
import { searchSources } from "@/lib/referral";

export const dynamic = "force-dynamic";

// Баярын цонхны «Хаанаас сонссон бэ?» хайлт: ?k=person|org|club&q=нэр
export async function GET(req) {
  const user = await getUser();
  if (!user) return Response.json({ items: [] }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  await ensureSchema();
  return Response.json({ items: await searchSources(user.id, sp.get("k"), sp.get("q")) });
}
