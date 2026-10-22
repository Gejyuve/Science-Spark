import { sql } from "./db";

// Асуулт, Бодрол картын доорх сэтгэгдэл: тус бүрийн хамгийн их лайктай сэтгэгдэл, лайк тэнцвэл (эсвэл лайкгүй бол) хамгийн эхнийх.
// Нэг асуулгаар ta_* талбаруудыг нэмнэ. Нийтлэгдсэн ч сэтгэгдэлгүй бол ta_id = null (асуултад «Анхны хариултыг та өг»).
export async function withTopComments(posts) {
  const ids = posts.filter((p) => (p.kind === "Асуулт" || p.kind === "Бодрол") && (p.status === undefined || p.status === "published")).map((p) => p.id);
  if (!ids.length) return posts;
  const rows = await sql`
    SELECT DISTINCT ON (c.post_id) c.post_id, c.id, c.body, c.author_id, cu.initial, cu.first_name, cu.avatar_id AS avatar,
      COALESCE((SELECT SUM(delta) FROM points_ledger WHERE user_id = cu.id), 0)::int AS points,
      (SELECT COUNT(*) FROM follows WHERE followee_id = cu.id)::int AS followers
    FROM comments c JOIN users cu ON cu.id = c.author_id
    WHERE c.post_id = ANY(${ids}) AND c.parent_id IS NULL
    ORDER BY c.post_id, (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id) DESC, c.created_at, c.id`;
  const by = Object.fromEntries(rows.map((r) => [r.post_id, r]));
  for (const p of posts) {
    if (!ids.includes(p.id)) continue;
    const t = by[p.id];
    Object.assign(p, t
      ? { ta_id: t.id, ta_body: t.body, ta_author: t.author_id, ta_initial: t.initial, ta_first: t.first_name, ta_avatar: t.avatar, ta_points: t.points, ta_followers: t.followers }
      : { ta_id: null });
  }
  return posts;
}
