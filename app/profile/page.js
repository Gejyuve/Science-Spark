import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser, displayName } from "@/lib/auth";
import { sql, ensureSchema } from "@/lib/db";
import { levelFor } from "@/lib/levels";
import { logout } from "../auth/actions";

export const metadata = { title: "Профайл · Science Spark" };

export default async function ProfilePage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const level = levelFor(user.points);
  await ensureSchema();
  const mine = await sql`SELECT id, title, status FROM posts WHERE author_id = ${user.id} AND status <> 'published' ORDER BY created_at DESC`;
  const joined = new Date(user.created_at).toISOString().slice(0, 10).replaceAll("-", ".");

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="avatar">{user.first_name[0]}</div>
        <h1>{displayName(user)}</h1>
        <p className="muted">{user.email}</p>
        <div className="stats">
          <div><b>{user.points}</b><span>оч</span></div>
          <div><b>{level.n}</b><span>{level.name}</span></div>
          <div><b>{joined}</b><span>Нэгдсэн</span></div>
        </div>
        {mine.length > 0 && (
          <div>
            <h3>Миний хүлээгдэж буй нийтлэл</h3>
            {mine.map((p) => (
              <div key={p.id} className="comment">
                <Link href={`/post/${p.id}`}>{p.title}</Link>{" "}
                <span className="muted">· {p.status === "rejected" ? "татгалзсан" : "шалгалтад"}</span>
              </div>
            ))}
          </div>
        )}
        <form action={logout}><button className="btn ghost" type="submit">Гарах</button></form>
        <p className="muted"><Link href="/">← Нүүр</Link></p>
      </div>
    </div>
  );
}
