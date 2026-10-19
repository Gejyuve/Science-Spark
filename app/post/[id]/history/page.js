import Link from "next/link";
import { notFound } from "next/navigation";
import { sql, ensureSchema } from "@/lib/db";
import { getUser, isStaff } from "@/lib/auth";
import { listRevisions, REV_ROLE } from "@/lib/revisions";
import Shell from "../../../components/Shell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Засварын түүх · Science Spark" };

const when = (d) => new Date(d).toLocaleString("sv-SE", { timeZone: "Asia/Ulaanbaatar" }).slice(0, 16).replace(/-/g, ".");

// Контентод оруулсан засварууд он цагийн дарааллаар, нийтэд нээлттэй
export default async function History({ params }) {
  const { id } = await params;
  const postId = Number(id);
  if (!Number.isInteger(postId)) notFound();
  await ensureSchema();
  const user = await getUser();
  const [post] = await sql`SELECT id, author_id, kind, title, status FROM posts WHERE id = ${postId}`;
  if (!post) notFound();
  if (post.status !== "published" && !isStaff(user) && user?.id !== post.author_id) notFound();
  const revs = await listRevisions(post.id);
  return (
    <Shell user={user} header="nav">
      <div className="ed-page">
        <h1>Засварын түүх</h1>
        <p className="muted">«<Link href={`/post/${post.id}`}>{post.title}</Link>»-д оруулсан бүх засвар он цагийн дарааллаар. Хувилбар бүрийг дэлгэж харна.</p>
        {revs.length === 0 ? <p className="muted">Засвар ороогүй байна.</p> : (
          <ul className="rv-hist ed-form">
            {revs.map((r, i) => (
              <li key={r.id}>
                <span className="rv-hmeta">
                  <span className={"rv-tag " + r.role}>{REV_ROLE[r.role] || r.role}</span>
                  {r.user_id ? <Link href={`/u/${r.user_id}`}>{r.first_name ? `${r.initial}.${r.first_name}` : "Хэрэглэгч"}</Link> : <span>Устгагдсан хэрэглэгч</span>}
                  <small>{when(r.created_at)}</small>
                </span>
                {r.note && <p className="rv-hnote">“{r.note}”</p>}
                <details open={i === revs.length - 1 && revs.length === 1}>
                  <summary>{i === revs.length - 1 ? "Одоогийн хувилбар" : "Энэ хувилбарыг харах"}</summary>
                  <div className="rv-hbody">{r.title && <b>{r.title}{"\n"}</b>}{r.subtitle && <i>{r.subtitle}{"\n"}</i>}{"\n"}{r.body}</div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Shell>
  );
}
