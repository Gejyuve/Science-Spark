import Link from "next/link";
import { notFound } from "next/navigation";
import { sql, ensureSchema } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { levelFor } from "@/lib/levels";
import { fmtDate } from "@/lib/format";
import { toggleFollow } from "../../posts/actions";
import Shell from "../../components/Shell";

export const dynamic = "force-dynamic";

export default async function PublicProfile({ params }) {
  const { id } = await params;
  const uid = Number(id);
  if (!Number.isInteger(uid)) notFound();
  await ensureSchema();
  const me = await getUser();
  const rows = await sql`
    SELECT u.id, u.initial, u.first_name, u.created_at,
      COALESCE((SELECT SUM(delta) FROM points_ledger WHERE user_id = u.id), 0)::int AS points,
      (SELECT COUNT(*) FROM follows WHERE followee_id = u.id)::int AS followers,
      (SELECT COUNT(*) FROM follows WHERE follower_id = u.id)::int AS following
    FROM users u WHERE u.id = ${uid}`;
  if (!rows.length) notFound();
  const u = rows[0];
  const level = levelFor(u.points);
  const posts = await sql`
    SELECT id, kind, title, created_at FROM posts
    WHERE author_id = ${uid} AND (status = 'published' OR author_id = ${me ? me.id : 0})
    ORDER BY created_at DESC LIMIT 50`;
  const following = me
    ? (await sql`SELECT 1 FROM follows WHERE follower_id = ${me.id} AND followee_id = ${uid}`).length > 0
    : false;

  return (
    <Shell user={me} header={false}>
      <div className="ss-card ss-page">
        <p className="muted"><Link href="/">← Нүүр</Link></p>
        <div className="avatar">{u.first_name[0]}</div>
        <h1>{u.initial}.{u.first_name}</h1>
        <div className="stats four">
          <div><b>{u.points}</b><span>оч</span></div>
          <div><b>{level.n}</b><span>{level.name}</span></div>
          <div><b>{u.followers}</b><span>дагагч</span></div>
          <div><b>{u.following}</b><span>дагаж буй</span></div>
        </div>
        {me && me.id !== u.id && (
          <form action={toggleFollow}>
            <input type="hidden" name="user_id" value={u.id} />
            <button className={"btn" + (following ? " ghost" : "")} type="submit">
              {following ? "Дагаж байна ✓" : "Дагах"}
            </button>
          </form>
        )}
        {me && me.id === u.id && <Link className="btn ghost" href="/profile">Миний профайл</Link>}
        <h3>Нийтлэлүүд ({posts.length})</h3>
        {posts.map((p) => (
          <div key={p.id} className="comment">
            <span className="chip">{p.kind}</span>{" "}
            <Link href={`/post/${p.id}`}>{p.title}</Link>
            <span className="muted"> · {fmtDate(p.created_at)}</span>
          </div>
        ))}
        {posts.length === 0 && <p className="muted">Нийтлэл алга.</p>}
      </div>
    </Shell>
  );
}
