import Link from "next/link";
import { redirect } from "next/navigation";
import { sql, ensureSchema } from "@/lib/db";
import { getUser, isStaff } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { reviewPost } from "../posts/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Хянах самбар · Science Spark" };

export default async function ReviewPage({ searchParams }) {
  const user = await getUser();
  if (!isStaff(user)) redirect("/");
  const { error } = await searchParams;
  await ensureSchema();
  const pending = await sql`
    SELECT p.id, p.kind, p.title, p.body, p.created_at, p.author_id, u.initial, u.first_name
    FROM posts p JOIN users u ON u.id = p.author_id
    WHERE p.status = 'pending' ORDER BY p.created_at`;
  return (
    <div className="auth-wrap top">
      <div className="auth-card wide">
        <p className="muted"><Link href="/">← Нүүр</Link></p>
        <h1>Хянах самбар</h1>
        {error && <p className="error">{error}</p>}
        <p className="muted">Хүлээгдэж буй: {pending.length}</p>
        {pending.length === 0 && <p>Шалгах нийтлэл алга ✓</p>}
        {pending.map((p) => (
          <div key={p.id} className="review-card">
            <span className="chip">{p.kind}</span>
            <h3>{p.title}</h3>
            <p className="muted">{p.initial}.{p.first_name} · {fmtDate(p.created_at)}</p>
            <div className="body">{p.body}</div>
            {p.author_id === user.id ? (
              <p className="muted">Өөрийн нийтлэлийг өөр хянагч батална.</p>
            ) : (
              <form action={reviewPost} className="stack">
                <input type="hidden" name="post_id" value={p.id} />
                <input name="note" placeholder="Тайлбар (татгалзахад заавал)" />
                <div className="row">
                  <button className="btn" name="decision" value="approve" type="submit">Батлах</button>
                  <button className="btn ghost danger" name="decision" value="reject" type="submit">Татгалзах</button>
                </div>
              </form>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
