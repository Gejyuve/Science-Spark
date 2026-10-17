import Link from "next/link";
import { getUser } from "@/lib/auth";
import { sql, ensureSchema } from "@/lib/db";
import Shell from "./components/Shell";
import PostCard from "./components/PostCard";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }) {
  const { tab, compose, error } = await searchParams;
  const following = tab === "following";
  let user = null;
  let posts = [];
  try {
    user = await getUser();
    await ensureSchema();
    posts = await sql`
      SELECT p.id, p.author_id, p.kind, p.title, p.body, p.meta, p.created_at, u.initial, u.first_name,
        (SELECT COUNT(*) FROM sparks WHERE post_id = p.id)::int AS sparks,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id)::int AS comments,
        COALESCE((SELECT SUM(delta) FROM points_ledger WHERE user_id = u.id), 0)::int AS author_points,
        (SELECT COUNT(*) FROM follows WHERE followee_id = u.id)::int AS author_followers,
        ta.id AS ta_id, ta.body AS ta_body, ta.author_id AS ta_author, ta.initial AS ta_initial, ta.first_name AS ta_first,
        ta.points AS ta_points, ta.followers AS ta_followers,
        EXISTS (SELECT 1 FROM saves WHERE post_id = p.id AND user_id = ${user ? user.id : 0}) AS saved
      FROM posts p JOIN users u ON u.id = p.author_id
      -- Асуултын шилдэг хариулт: хамгийн их лайктай, тэнцвэл хамгийн сүүлд бичигдсэн
      LEFT JOIN LATERAL (
        SELECT c.id, c.body, c.author_id, cu.initial, cu.first_name,
          COALESCE((SELECT SUM(delta) FROM points_ledger WHERE user_id = cu.id), 0)::int AS points,
          (SELECT COUNT(*) FROM follows WHERE followee_id = cu.id)::int AS followers
        FROM comments c JOIN users cu ON cu.id = c.author_id
        WHERE c.post_id = p.id AND p.kind = 'Асуулт' AND c.parent_id IS NULL
        ORDER BY (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id) DESC, c.created_at DESC, c.id DESC
        LIMIT 1
      ) ta ON true
      WHERE p.status = 'published'
        AND (${!following || !user}::boolean OR p.author_id IN
             (SELECT followee_id FROM follows WHERE follower_id = ${user ? user.id : 0}))
      ORDER BY p.created_at DESC LIMIT 30`;
  } catch (e) {
    // Өгөгдлийн сан холбогдоогүй үед нүүр хуудас хэвийн нээгдэнэ
  }

  return (
    <Shell user={user} active="/" compose={["Асуулт", "share", "Бодрол", "Эвент", "Зарлал"].includes(compose) ? compose : null} composeError={error}>
      {user && (
        <div className="ss-feedtabs">
          <Link href="/" className={following ? "" : "on"}>Бүгд</Link>
          <Link href="/?tab=following" className={following ? "on" : ""}>Дагаж буй</Link>
        </div>
      )}
      {posts.length === 0 && (
        <div className="ss-card">
          <p className="ss-empty">
            {following && user
              ? "Дагаж буй хүмүүсийн нийтлэл алга. Сонирхолтой хүмүүсийг дагаарай."
              : "Одоохондоо нийтлэл алга. Эхний очийг та асаагаарай ✦"}
          </p>
        </div>
      )}
      {posts.map((p) => (
        <PostCard key={p.id} p={p} viewer={user} />
      ))}
    </Shell>
  );
}
