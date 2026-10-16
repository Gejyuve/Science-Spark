import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { sql, ensureSchema } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { KINDS } from "@/lib/format";
import { updatePost, deletePost } from "../../../posts/actions";

export const metadata = { title: "Засах · Science Spark" };

export default async function EditPage({ params }) {
  const { id } = await params;
  const postId = Number(id);
  if (!Number.isInteger(postId)) notFound();
  const user = await getUser();
  if (!user) redirect("/login");
  await ensureSchema();
  const rows = await sql`SELECT * FROM posts WHERE id = ${postId} AND author_id = ${user.id}`;
  if (!rows.length) notFound();
  const post = rows[0];
  return (
    <div className="auth-wrap">
      <div className="auth-card wide">
        <form action={updatePost} className="stack">
          <h1>Нийтлэл засах</h1>
          <input type="hidden" name="post_id" value={post.id} />
          <label>Төрөл
            <select name="kind" defaultValue={post.kind}>
              {KINDS.map((k) => <option key={k}>{k}</option>)}
            </select>
          </label>
          <label>Гарчиг<input name="title" required maxLength={200} defaultValue={post.title} /></label>
          <label>Агуулга<textarea name="body" required rows={10} defaultValue={post.body} /></label>
          <button className="btn" type="submit">Хадгалах</button>
        </form>
        <form action={deletePost}>
          <input type="hidden" name="post_id" value={post.id} />
          <button className="btn ghost danger" type="submit">Нийтлэлийг устгах</button>
        </form>
        <p className="muted"><Link href={`/post/${post.id}`}>← Буцах</Link></p>
      </div>
    </div>
  );
}
