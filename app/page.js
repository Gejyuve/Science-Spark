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
        (SELECT COUNT(*) FROM follows WHERE followee_id = u.id)::int AS author_followers
      FROM posts p JOIN users u ON u.id = p.author_id
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
        <PostCard key={p.id} p={p} />
      ))}
    </Shell>
  );
}
