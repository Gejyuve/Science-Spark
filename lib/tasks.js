import { sql } from "./db";
import { TASK_KIND, TASK_TYPES } from "./tasks-shared";

export * from "./tasks-shared";

// Хэрэглэгчийн удирддаг клуб (даалгаврыг зөвхөн удирдагч клубын нэрээр нэмнэ)
export async function leaderClub(userId) {
  if (!userId) return null;
  const [c] = await sql`SELECT id, name, logo_id AS logo FROM clubs WHERE leader_id = ${userId} AND kind = 'club' AND status = 'active' LIMIT 1`;
  return c || null;
}

// Нийтлэгдсэн даалгаврууд: төрлөөр эсвэл клубээр шүүнэ
export async function listTasks({ type = null, clubId = null, limit = 24 } = {}) {
  return sql`
    SELECT p.id, p.title, p.subtitle, p.image_id, p.meta, p.created_at, p.views,
      c.id AS club_id, c.name AS club_name, c.logo_id AS club_logo,
      (SELECT COUNT(*) FROM sparks WHERE post_id = p.id)::int AS sparks,
      (SELECT COUNT(*) FROM comments WHERE post_id = p.id)::int AS comments
    FROM posts p JOIN clubs c ON c.id = p.club_id
    WHERE p.kind = ${TASK_KIND} AND p.status = 'published'
      AND (${type}::text IS NULL OR p.meta->'types' @> jsonb_build_array(${type}::text))
      AND (${clubId}::int IS NULL OR p.club_id = ${clubId}::int)
    ORDER BY p.created_at DESC LIMIT ${limit}`;
}

export async function taskCount() {
  const [r] = await sql`SELECT COUNT(*)::int AS n FROM posts WHERE kind = ${TASK_KIND} AND status = 'published'`;
  return r.n;
}

// Сонгох төрлүүд: үндсэн жагсаалт + клубуудын нэмсэн, нийтлэгдсэн даалгаварт хэрэглэгдсэн төрлүүд
export async function taskTypes() {
  const used = await sql`
    SELECT t, COUNT(*)::int AS n FROM posts p, jsonb_array_elements_text(COALESCE(p.meta->'types', '[]'::jsonb)) t
    WHERE p.kind = ${TASK_KIND} AND p.status = 'published' GROUP BY t ORDER BY n DESC, t`;
  return [...new Set([...TASK_TYPES, ...used.map((r) => r.t)])];
}
