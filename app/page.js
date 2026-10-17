import Link from "next/link";
import ThemeToggle from "./components/ThemeToggle";
import { getUser, displayName, isStaff, isSuperAdmin } from "@/lib/auth";
import { sql, ensureSchema } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { levelFor } from "@/lib/levels";

export const dynamic = "force-dynamic";

const nav = [
  { icon: "💧", label: "Урсгал", active: true },
  { icon: "🌿", label: "Мод" },
  { icon: "📖", label: "Толь" },
  { icon: "🎮", label: "Тоглоом" },
  { icon: "🔥", label: "Төслүүд" },
  { icon: "❔", label: "Тусламж" },
];

export default async function Home() {
  let user = null;
  let posts = [];
  let top = [];
  try {
    user = await getUser();
    await ensureSchema();
    posts = await sql`
      SELECT p.id, p.author_id, p.kind, p.title, p.body, p.created_at, u.initial, u.first_name,
        (SELECT COUNT(*) FROM sparks WHERE post_id = p.id)::int AS sparks,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id)::int AS comments
      FROM posts p JOIN users u ON u.id = p.author_id
      WHERE p.status = 'published'
      ORDER BY p.created_at DESC LIMIT 30`;
    top = await sql`
      SELECT u.id, u.initial, u.first_name, SUM(l.delta)::int AS points
      FROM points_ledger l JOIN users u ON u.id = l.user_id
      GROUP BY u.id HAVING SUM(l.delta) > 0
      ORDER BY points DESC LIMIT 5`;
  } catch (e) {
    // Өгөгдлийн сан холбогдоогүй үед нүүр хуудас хэвийн нээгдэнэ
  }
  return (
    <div className="shell">
      <aside className="side left">
        <div className="brand">✦ Science Spark</div>
        <form action="/search" method="get">
          <input className="search" name="q" placeholder="Хайх" aria-label="Хайх" />
        </form>
        <nav>
          {nav.map((n) => (
            <a key={n.label} href="#" className={"nav-item" + (n.active ? " active" : "")}>
              <span>{n.icon}</span>
              {n.label}
            </a>
          ))}
        </nav>
        {isStaff(user) && <Link href="/review" className="nav-item">🛡 Хянах самбар</Link>}
        {isSuperAdmin(user) && <Link href="/admin" className="nav-item">⚙ Супер админ</Link>}
        <div className="grow" />
        {user ? (
          <Link href="/profile" className="btn ghost">👤 {displayName(user)}</Link>
        ) : (
          <Link href="/login" className="btn">Нэвтрэх</Link>
        )}
        <ThemeToggle />
      </aside>

      <main className="feed">
        <Link href={user ? "/write" : "/login"} className="composer">
          {user ? "Өнөөдөр ямар оч асаах гэж байна даа?" : "Нийтлэл бичихийн тулд нэвтэрнэ үү"}
        </Link>
        {posts.length === 0 && (
          <div className="card"><p>Одоохондоо нийтлэл алга. Эхний очийг та асаагаарай ✦</p></div>
        )}
        {posts.map((p) => (
          <article key={p.id} className="card">
            <span className="chip">{p.kind}</span>
            <h2><Link href={`/post/${p.id}`}>{p.title}</Link></h2>
            <p>{p.body.length > 180 ? p.body.slice(0, 180) + "…" : p.body}</p>
            <div className="meta">
              <Link href={`/u/${p.author_id}`}>{p.initial}.{p.first_name}</Link>
              <span>·</span>
              <span>{fmtDate(p.created_at)}</span>
              <span className="spark">✦ {p.sparks} · 💬 {p.comments}</span>
            </div>
          </article>
        ))}
      </main>

      <aside className="side right">
        {user && (
          <div className="panel">
            <h3><Link href={`/u/${user.id}`}>{displayName(user)}</Link></h3>
            <p className="muted">
              {user.points.toLocaleString("en-US")} оч · Түвшин {levelFor(user.points).n} · {levelFor(user.points).name}
            </p>
          </div>
        )}
        <div className="panel">
          <h3>🔥 Асаж буй оч</h3>
          {top.length === 0 ? (
            <p className="muted">Одоохондоо оч цуглуулсан хүн алга.</p>
          ) : (
            <p className="muted">
              {top.map((t, i) => (
                <span key={t.id}>{i > 0 && " · "}<Link href={`/u/${t.id}`}>{t.initial}.{t.first_name}</Link> ✦{t.points}</span>
              ))}
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
