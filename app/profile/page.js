import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser, displayName } from "@/lib/auth";
import { sql, ensureSchema } from "@/lib/db";
import { levelFor } from "@/lib/levels";
import { logout, changePassword } from "../auth/actions";
import Shell from "../components/Shell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Профайл · Science Spark" };

export default async function ProfilePage({ searchParams }) {
  const { error, ok } = await searchParams;
  const user = await getUser();
  if (!user) redirect("/login");
  const level = levelFor(user.points);
  await ensureSchema();
  const mine = await sql`SELECT id, title, status FROM posts WHERE author_id = ${user.id} AND status <> 'published' ORDER BY created_at DESC`;
  const joined = new Date(user.created_at).toISOString().slice(0, 10).replaceAll("-", ".");

  return (
    <Shell user={user} header={false}>
      <div className="ss-card ss-page">
        <div className="avatar">{user.first_name[0]}</div>
        <h1>{displayName(user)}</h1>
        <p className="muted">{user.email}</p>
        {error && <p className="error">{error}</p>}
        {ok && <p className="notice">{ok}</p>}
        <div className="stats">
          <div><b>{user.points}</b><span>оч</span></div>
          <div><b>{level.n}</b><span>{level.name}</span></div>
          <div><b>{joined}</b><span>Нэгдсэн</span></div>
        </div>
        {mine.length > 0 && (
          <div>
            <h3>Миний нийтлэгдээгүй нийтлэл</h3>
            {mine.map((p) => (
              <div key={p.id} className="comment">
                <Link href={`/post/${p.id}`}>{p.title}</Link>{" "}
                <span className="muted">· {p.status === "rejected" ? "татгалзсан" : p.status === "removed" ? "хасагдсан" : "шалгалтад"}</span>
              </div>
            ))}
          </div>
        )}
        <details className="mod">
          <summary className="muted">Нууц үг солих</summary>
          <form action={changePassword} className="stack">
            <input name="current" type="password" required placeholder="Одоогийн нууц үг" autoComplete="current-password" />
            <input name="next" type="password" required minLength={8} placeholder="Шинэ нууц үг (8+)" autoComplete="new-password" />
            <button className="btn" type="submit">Солих</button>
          </form>
        </details>
        <p className="muted"><Link href={`/u/${user.id}`}>Нийтэд харагдах профайл →</Link></p>
        <form action={logout}><button className="btn ghost" type="submit">Гарах</button></form>
        <p className="muted"><Link href="/">← Нүүр</Link></p>
      </div>
    </Shell>
  );
}
