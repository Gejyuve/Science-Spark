import { sql, ensureSchema } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { syncQpay } from "@/lib/payments";

export const dynamic = "force-dynamic";

// Төлбөрийн цонх хэдэн секунд тутам асууна: төлөгдсөн бол тэр дор нь баталгаажуулна (callback хоцорсон ч)
export async function GET(req) {
  const user = await getUser();
  if (!user) return Response.json({ error: "login" }, { status: 401 });
  await ensureSchema();
  const code = new URL(req.url).searchParams.get("code") || "";
  const [r] = await sql`SELECT * FROM payment_requests WHERE code = ${code} AND user_id = ${user.id}`;
  if (!r) return Response.json({ error: "not_found" }, { status: 404 });
  const status = r.status === "pending" ? await syncQpay(r, 3000) : r.status;
  return Response.json({ status }, { headers: { "Cache-Control": "no-store" } });
}
