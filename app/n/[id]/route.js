import { getUser } from "@/lib/auth";
import { sql, ensureSchema } from "@/lib/db";
import { notifTarget } from "@/lib/notify";

export const dynamic = "force-dynamic";

// Мэдэгдэл нээх: уншсан болгоод холбогдох хуудас руу шилжүүлнэ
export async function GET(req, { params }) {
  const { id } = await params;
  const user = await getUser();
  const home = new URL("/", req.url);
  if (!user) return Response.redirect(new URL("/login", req.url), 303);
  const n = Number(id);
  if (!Number.isInteger(n)) return Response.redirect(home, 303);
  await ensureSchema();
  const [row] = await sql`UPDATE notifications SET read_at = COALESCE(read_at, now())
                          WHERE id = ${n} AND user_id = ${user.id} RETURNING kind, post_id, actor_id, club_id`;
  return Response.redirect(new URL(row ? notifTarget(row) : "/notifications", req.url), 303);
}
