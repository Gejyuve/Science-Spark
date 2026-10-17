import Link from "next/link";
import { sql, ensureSchema } from "@/lib/db";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Хайлт · Science Spark" };

export default async function SearchPage({ searchParams }) {
  const { q = "" } = await searchParams;
  const term = String(q).trim().slice(0, 100);
  await ensureSchema();
  let posts = [];
  let people = [];
  if (term) {
    const like = `%${term.replace(/[%_\\]/g, "\\$&")}%`;
    posts = await sql`
      SELECT p.id, p.kind, p.title, p.created_at, u.initial, u.first_name
      FROM posts p JOIN users u ON u.id = p.author_id
      WHERE p.status = 'published' AND (p.title ILIKE ${like} OR p.body ILIKE ${like})
      ORDER BY p.created_at DESC LIMIT 30`;
    people = await sql`
      SELECT id, initial, first_name FROM users WHERE first_name ILIKE ${like} LIMIT 10`;
  }
  return (
    <div className="auth-wrap top">
      <div className="auth-card wide">
        <p className="muted"><Link href="/">← Нүүр</Link></p>
        <form action="/search" method="get" className="stack">
          <input name="q" defaultValue={term} placeholder="Хайх…" autoFocus />
        </form>
        {term && <p className="muted">{posts.length + people.length} үр дүн · "{term}"</p>}
        {people.length > 0 && <h3>Хэрэглэгч</h3>}
        {people.map((u) => (
          <div key={u.id} className="comment"><Link href={`/u/${u.id}`}>{u.initial}.{u.first_name}</Link></div>
        ))}
        {posts.length > 0 && <h3>Нийтлэл</h3>}
        {posts.map((p) => (
          <div key={p.id} className="comment">
            <span className="chip">{p.kind}</span> <Link href={`/post/${p.id}`}>{p.title}</Link>
            <span className="muted"> · {p.initial}.{p.first_name} · {fmtDate(p.created_at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
