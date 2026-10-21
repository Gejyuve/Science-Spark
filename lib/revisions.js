import { sql } from "./db";

// Засварын төрөл: бичээч өөрөө, редакц, нэгтгэл. «original» нь анхны хувилбар.
export const REV_ROLE = { original: "Анхны хувилбар", author: "Бичээч засварласан", editor: "Редакц засварласан", merge: "Нэгтгэсэн" };

// Засвар бүрийг хадгална. Анхны засвар дээр өмнөх хувилбарыг «original» болгон түрүүлж хадгална.
export async function recordRevision(before, { editorId, role, note = null, title, subtitle, body, checked = false }) {
  const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM post_revisions WHERE post_id = ${before.id}`;
  if (!n) {
    const orig = before.original || {};
    await sql`INSERT INTO post_revisions (post_id, editor_id, role, title, subtitle, body, checked_at, created_at)
              VALUES (${before.id}, ${before.author_id}, 'original', ${orig.title ?? before.title}, ${orig.subtitle ?? before.subtitle},
                      ${orig.body ?? before.body}, now(), ${before.created_at})`;
  }
  await sql`INSERT INTO post_revisions (post_id, editor_id, role, title, subtitle, body, note, checked_at)
            VALUES (${before.id}, ${editorId}, ${role}, ${title}, ${subtitle ?? null}, ${body}, ${note},
                    ${role === "author" && !checked ? null : new Date().toISOString()})`;
}

export async function addCredit(postId, userId, role, at = null) {
  if (!userId) return;
  await sql`INSERT INTO post_credits (post_id, user_id, role, at) VALUES (${postId}, ${userId}, ${role}, COALESCE(${at}::timestamptz, now()))
            ON CONFLICT (post_id, user_id, role) DO NOTHING`;
}

// Бичээч, хянагчид бичсэн, хянасан дарааллаараа: үндсэн бичээч, хянагч, нэгтгэлээр нэмэгдсэн хүмүүс
export async function creditChain(post) {
  const rows = await sql`
    SELECT x.role, x.at, u.id, u.initial, u.first_name, u.avatar_id AS avatar,
           COALESCE((SELECT SUM(delta) FROM points_ledger WHERE user_id = u.id), 0)::int AS points,
           (SELECT COUNT(*) FROM follows WHERE followee_id = u.id)::int AS followers
    FROM (
      SELECT 'author' AS role, ${post.author_id}::int AS user_id, ${post.created_at}::timestamptz AS at
      UNION ALL SELECT 'reviewer', ${post.reviewer_id}::int, COALESCE(${post.reviewed_at}::timestamptz, ${post.created_at}::timestamptz)
        WHERE ${post.reviewer_id}::int IS NOT NULL
      UNION ALL SELECT role, user_id, at FROM post_credits WHERE post_id = ${post.id}
    ) x JOIN users u ON u.id = x.user_id
    ORDER BY x.at, x.role`;
  const seen = new Set();
  const list = rows.filter((r) => {
    const k = r.role + ":" + r.id;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  // Нэгтгэхдээ редакц бичээчдийн дарааллыг сонгосон бол: бичээчид тэр дарааллаар, дараа нь хянагчид
  const order = post.meta?.author_order;
  if (!Array.isArray(order) || !order.length) return list;
  const rank = (r) => (order.indexOf(r.id) === -1 ? order.length : order.indexOf(r.id));
  const authors = list.filter((r) => r.role === "author").sort((x, y) => rank(x) - rank(y));
  return [...authors, ...list.filter((r) => r.role !== "author")];
}

export async function listRevisions(postId) {
  return sql`SELECT r.id, r.role, r.title, r.subtitle, r.body, r.note, r.created_at, r.checked_at,
                    u.id AS user_id, u.initial, u.first_name, u.email
             FROM post_revisions r LEFT JOIN users u ON u.id = r.editor_id
             WHERE r.post_id = ${postId} ORDER BY r.created_at, r.id`;
}
