import { sql } from "./db";
import { descendants } from "./tree";

// Нийтлэл, мэдээний жагсаалт (ангиллаар шүүж болно)
export async function listPosts({ kind, category = null, sort = "new", limit = 20 }) {
  const cats = category ? descendants(category) : null;
  return sql`
    SELECT p.id, p.kind, p.title, p.subtitle, p.body, p.image_id, p.created_at, p.author_id, p.category,
           u.initial, u.first_name, u.avatar_id AS avatar
    FROM posts p JOIN users u ON u.id = p.author_id
    WHERE p.status = 'published' AND p.kind = ${kind}
      AND (${!cats}::boolean OR p.category = ANY(${cats || []}))
    ORDER BY CASE WHEN ${sort === "old"}::boolean THEN p.created_at END ASC,
             p.created_at DESC
    LIMIT ${limit}`;
}

// Ангилал бүрийн нийтлэгдсэн нийтлэл, мэдээний тоо
export async function categoryCounts() {
  try {
    return await sql`SELECT category, COUNT(*)::int AS n FROM posts
                     WHERE status = 'published' AND kind IN ('Нийтлэл', 'Мэдээ') AND category IS NOT NULL
                     GROUP BY category`;
  } catch (e) {
    return [];
  }
}

export async function kindCount(kind, category = null) {
  const cats = category ? descendants(category) : null;
  const [r] = await sql`SELECT COUNT(*)::int AS n FROM posts WHERE status = 'published' AND kind = ${kind}
                        AND (${!cats}::boolean OR category = ANY(${cats || []}))`;
  return r.n;
}
