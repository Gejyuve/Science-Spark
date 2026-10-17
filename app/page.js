import Link from "next/link";
import crypto from "node:crypto";
import { getUser } from "@/lib/auth";
import { sql, ensureSchema } from "@/lib/db";
import Shell from "./components/Shell";
import PostCard from "./components/PostCard";
import { followingSet } from "./components/Bits";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }) {
  const { tab, compose, error, f } = await searchParams;
  const qa = f === "qa"; // Асуулт ба бодрол · сүүлд орсноор
  const ann = f === "ann"; // Зарлалууд
  const top = f === "top"; // Сүүлийн 24 цагт хамгийн их оч авсан
  const rand = f === "rand"; // Санамсаргүй: хэрэглэгч бүрт, дарах бүрт өөр дараалал
  const seed = crypto.randomUUID();
  const following = tab === "following";
  let user = null;
  let posts = [];
  try {
    user = await getUser();
    await ensureSchema();
    posts = await sql`
      SELECT p.id, p.author_id, p.kind, p.title, p.body, p.meta, p.image_id, p.views, p.created_at, u.initial, u.first_name, u.avatar_id AS avatar,
        (SELECT COUNT(*) FROM sparks WHERE post_id = p.id)::int AS sparks,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id)::int AS comments,
        COALESCE((SELECT SUM(delta) FROM points_ledger WHERE user_id = u.id), 0)::int AS author_points,
        (SELECT COUNT(*) FROM follows WHERE followee_id = u.id)::int AS author_followers,
        ta.id AS ta_id, ta.body AS ta_body, ta.author_id AS ta_author, ta.initial AS ta_initial, ta.first_name AS ta_first,
        ta.points AS ta_points, ta.followers AS ta_followers, ta.avatar AS ta_avatar,
        EXISTS (SELECT 1 FROM saves WHERE post_id = p.id AND user_id = ${user ? user.id : 0}) AS saved,
        EXISTS (SELECT 1 FROM sparks WHERE post_id = p.id AND user_id = ${user ? user.id : 0}) AS sparked,
        (SELECT COUNT(*) FROM sparks WHERE post_id = p.id AND created_at > now() - interval '24 hours')::int AS sparks24
      FROM posts p JOIN users u ON u.id = p.author_id
      -- Асуултын шилдэг хариулт: хамгийн их лайктай, тэнцвэл хамгийн сүүлд бичигдсэн
      LEFT JOIN LATERAL (
        SELECT c.id, c.body, c.author_id, cu.initial, cu.first_name, cu.avatar_id AS avatar,
          COALESCE((SELECT SUM(delta) FROM points_ledger WHERE user_id = cu.id), 0)::int AS points,
          (SELECT COUNT(*) FROM follows WHERE followee_id = cu.id)::int AS followers
        FROM comments c JOIN users cu ON cu.id = c.author_id
        WHERE c.post_id = p.id AND p.kind = 'Асуулт' AND c.parent_id IS NULL
        ORDER BY (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id) DESC, c.created_at DESC, c.id DESC
        LIMIT 1
      ) ta ON true
      WHERE p.status = 'published'
        AND (NOT ${qa}::boolean OR p.kind IN ('Асуулт', 'Бодрол'))
        AND (NOT ${ann}::boolean OR p.kind = 'Зарлал')
        AND (${!following || !user}::boolean OR p.author_id IN
             (SELECT followee_id FROM follows WHERE follower_id = ${user ? user.id : 0}))
      ORDER BY
        -- Санамсаргүй: үзээгүй контент нь эхэнд, дотроо холилдсон
        CASE WHEN ${rand}::boolean THEN EXISTS (SELECT 1 FROM post_views v WHERE v.post_id = p.id AND v.viewer = ${user ? "u:" + user.id : ""}) END ASC NULLS LAST,
        CASE WHEN ${rand}::boolean THEN md5(p.id::text || ${seed}) END ASC NULLS LAST,
        CASE WHEN ${top}::boolean THEN (SELECT COUNT(*) FROM sparks WHERE post_id = p.id AND created_at > now() - interval '24 hours') END DESC NULLS LAST,
        CASE WHEN ${top}::boolean THEN (SELECT COUNT(*) FROM sparks WHERE post_id = p.id) END DESC NULLS LAST,
        p.created_at DESC
      LIMIT 30`;
  } catch (e) {
    // Өгөгдлийн сан холбогдоогүй үед нүүр хуудас хэвийн нээгдэнэ
  }

  const followSet = await followingSet(user);
  return (
    <Shell user={user} active={qa ? "qa" : top ? "top" : rand ? "rand" : "/"} compose={["Асуулт", "share", "Бодрол", "Эвент", "Зарлал"].includes(compose) ? compose : null} composeError={error}>
      {qa && (
        <div className="ss-feedtabs">
          <span className="on">Асуулт ба бодрол · сүүлд орсноор</span>
          <Link href="/">× Бүгдийг харах</Link>
        </div>
      )}
      {top && (
        <div className="ss-topbar"><span aria-hidden="true">✦</span>Сүүлийн 24 цагийн хамгийн их оч авсан контентууд</div>
      )}
      {rand && (
        <div className="ss-topbar"><span aria-hidden="true">⚄</span>Санамсаргүй дарааллаар · таны үзээгүй контент эхэнд
          <span className="ss-grow" /><Link href={`/?f=rand&r=${seed.slice(0, 8)}`} className="ss-reshuffle">Дахин холих</Link></div>
      )}
      {ann && (
        <div className="ss-feedtabs">
          <span className="on">Зарлал · сүүлд орсноор</span>
          <Link href="/">× Бүгдийг харах</Link>
        </div>
      )}
      {user && !qa && !ann && !top && !rand && (
        <div className="ss-feedtabs">
          <Link href="/" className={following ? "" : "on"}>Бүгд</Link>
          <Link href="/?tab=following" className={following ? "on" : ""}>Дагаж буй</Link>
        </div>
      )}
      {posts.length === 0 && (
        <div className="ss-card">
          <p className="ss-empty">
            {ann
              ? "Одоохондоо зарлал алга."
              : qa
              ? "Одоохондоо асуулт, бодрол алга. Эхнийхийг нь та асуугаарай ✦"
              : following && user
              ? "Дагаж буй хүмүүсийн нийтлэл алга. Сонирхолтой хүмүүсийг дагаарай."
              : "Одоохондоо нийтлэл алга. Эхний очийг та асаагаарай ✦"}
          </p>
        </div>
      )}
      {posts.map((p) => (
        <PostCard key={p.id} p={p} viewer={user} following={followSet} />
      ))}
    </Shell>
  );
}
