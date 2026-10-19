import { getUser } from "@/lib/auth";
import { sql, ensureSchema } from "@/lib/db";

export const dynamic = "force-dynamic";

// Хэрэглэгч хайх (клубийн удирдах зөвлөлд гишүүн нэмэх үед). Имэйл задруулахгүй.
export async function GET(req) {
  const user = await getUser();
  if (!user) return Response.json({ users: [] }, { status: 401 });
  const q = (new URL(req.url).searchParams.get("q") || "").trim().slice(0, 40);
  if (q.length < 2) return Response.json({ users: [] });
  await ensureSchema();
  const like = `%${q.replace(/[%_\\]/g, (m) => "\\" + m)}%`;
  const rows = await sql`
    SELECT u.id, u.initial, u.first_name, u.surname, u.avatar_id AS avatar, p.job
    FROM users u LEFT JOIN profiles p ON p.user_id = u.id
    WHERE u.id <> ${user.id} AND u.restricted_at IS NULL AND u.first_name <> ''
      AND (u.first_name ILIKE ${like} OR u.surname ILIKE ${like} OR (u.initial || '.' || u.first_name) ILIKE ${like})
    ORDER BY u.first_name LIMIT 8`;
  return Response.json({ users: rows.map((r) => ({ id: r.id, name: `${r.initial}.${r.first_name}`, avatar: r.avatar, job: r.job || "" })) });
}
