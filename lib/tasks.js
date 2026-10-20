import { sql } from "./db";
import { TASK_KIND, TASK_TYPES, REPORT_KIND } from "./tasks-shared";

export * from "./tasks-shared";

// Хэрэглэгчийн удирддаг клуб (даалгаврыг зөвхөн удирдагч клубийн нэрээр нэмнэ)
export async function leaderClub(userId) {
  if (!userId) return null;
  const [c] = await sql`SELECT id, name, logo_id AS logo, club_type FROM clubs WHERE leader_id = ${userId} AND kind = 'club' AND status = 'active' LIMIT 1`;
  return c || null;
}

// Хэрэглэгчийн удирддаг байгууллага (бүртгүүлсэн админ байгууллагынхаа нэрээр хуваалцана)
export async function leaderOrg(userId) {
  if (!userId) return null;
  const [c] = await sql`SELECT id, name, logo_id AS logo FROM clubs WHERE leader_id = ${userId} AND kind = 'org' AND status = 'active' LIMIT 1`;
  return c || null;
}

// Нийтлэгдсэн даалгаврууд: төрлөөр эсвэл клубээр шүүнэ
export async function listTasks({ type = null, clubId = null, limit = 24 } = {}) {
  return sql`
    SELECT p.id, p.title, p.subtitle, p.image_id, p.meta, p.created_at, p.views,
      c.id AS club_id, c.name AS club_name, c.logo_id AS club_logo,
      (SELECT COUNT(*) FROM sparks WHERE post_id = p.id)::int AS sparks,
      (SELECT COUNT(*) FROM comments WHERE post_id = p.id)::int AS comments,
      (SELECT COUNT(DISTINCT r.club_id) FROM posts r WHERE r.task_id = p.id AND r.kind = ${REPORT_KIND} AND r.status = 'published')::int AS done
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

// Сонгох төрлүүд: үндсэн жагсаалт + клубүүдын нэмсэн, нийтлэгдсэн даалгаварт хэрэглэгдсэн төрлүүд
export async function taskTypes() {
  const used = await sql`
    SELECT t, COUNT(*)::int AS n FROM posts p, jsonb_array_elements_text(COALESCE(p.meta->'types', '[]'::jsonb)) t
    WHERE p.kind = ${TASK_KIND} AND p.status = 'published' GROUP BY t ORDER BY n DESC, t`;
  return [...new Set([...TASK_TYPES, ...used.map((r) => r.t)])];
}

// Нийтлэгдсэн тайлангууд: биелүүлсэн даалгаврын товч мэдээлэлтэй
export async function listReports({ clubId = null, taskId = null, limit = 24 } = {}) {
  return sql`
    SELECT p.id, p.title, p.subtitle, p.image_id, p.meta, p.created_at, p.views,
      c.id AS club_id, c.name AS club_name, c.logo_id AS club_logo,
      t.id AS task_id, t.title AS task_title, t.meta->'types' AS task_types, (t.meta->>'reward')::int AS task_reward,
      (SELECT COUNT(*) FROM sparks WHERE post_id = p.id)::int AS sparks,
      (SELECT COUNT(*) FROM comments WHERE post_id = p.id)::int AS comments
    FROM posts p JOIN clubs c ON c.id = p.club_id LEFT JOIN posts t ON t.id = p.task_id
    WHERE p.kind = ${REPORT_KIND} AND p.status = 'published'
      AND (${clubId}::int IS NULL OR p.club_id = ${clubId}::int)
      AND (${taskId}::int IS NULL OR p.task_id = ${taskId}::int)
    ORDER BY p.created_at DESC LIMIT ${limit}`;
}

export async function reportCount() {
  const [r] = await sql`SELECT COUNT(*)::int AS n FROM posts WHERE kind = ${REPORT_KIND} AND status = 'published'`;
  return r.n;
}

// Тайлан бичихэд сонгох даалгаврууд. clubId: энэ клуб аль хэдийн биелүүлж оч авсан эсэхийг тэмдэглэнэ
export async function taskOptions(clubId) {
  return sql`
    SELECT p.id, p.title, p.image_id, p.meta->'types' AS types, (p.meta->>'reward')::int AS reward,
      c.id AS club_id, c.name AS club_name,
      EXISTS (SELECT 1 FROM posts r WHERE r.task_id = p.id AND r.club_id = ${clubId || 0} AND r.kind = ${REPORT_KIND}
              AND r.status IN ('pending', 'published')) AS done
    FROM posts p JOIN clubs c ON c.id = p.club_id
    WHERE p.kind = ${TASK_KIND} AND p.status = 'published'
    ORDER BY p.created_at DESC LIMIT 300`;
}
