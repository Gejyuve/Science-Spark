import { headers } from "next/headers";
import { sql, ensureSchema } from "@/lib/db";
import { getUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Нээлттэй хуудаснаас минут тутам ирэх дохио: 5 минутаас дотор ирвэл тухайн айлчлалыг сунгана, үгүй бол шинэ айлчлал.
export async function POST(req) {
  let v = "";
  try {
    v = String((await req.json()).v || "");
  } catch (e) {}
  if (!/^[a-z0-9]{12,40}$/i.test(v)) return new Response(null, { status: 204 });
  try {
    await ensureSchema();
    const user = await getUser();
    const uid = user?.id || null;
    const up = await sql`UPDATE site_visits SET last_at = now(), user_id = COALESCE(user_id, ${uid})
      WHERE id = (SELECT id FROM site_visits WHERE visitor = ${v} AND last_at > now() - interval '5 minutes' ORDER BY id DESC LIMIT 1)
      RETURNING id`;
    if (!up.length) {
      const h = await headers();
      const dec = (x) => { try { return x ? decodeURIComponent(x).slice(0, 80) : null; } catch (e) { return null; } };
      await sql`INSERT INTO site_visits (visitor, user_id, country, city)
                VALUES (${v}, ${uid}, ${dec(h.get("x-vercel-ip-country"))}, ${dec(h.get("x-vercel-ip-city"))})`;
    }
  } catch (e) {}
  return new Response(null, { status: 204 });
}
