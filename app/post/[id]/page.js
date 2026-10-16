import Link from "next/link";
import { notFound } from "next/navigation";
import { sql, ensureSchema } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { addComment, sparkPost } from "../../posts/actions";

export default async function PostPage({ params }) {
  const { id } = await params;
  const postId = Number(id);
  if (!Number.isInteger(postId)) notFound();
  await ensureSchema();
  const user = await getUser();

  const posts = await sql`
    SELECT p.*, u.initial, u.first_name,
           (SELECT COUNT(*) FROM sparks WHERE post_id = p.id)::int AS sparks
    FROM posts p JOIN users u ON u.id = p.author_id WHERE p.id = ${postId}`;
  if (!posts.length) notFound();
  const post = posts[0];

  const comments = await sql`
    SELECT c.*, u.initial, u.first_name FROM comments c
    JOIN users u ON u.id = c.author_id WHERE c.post_id = ${postId} ORDER BY c.created_at`;
  const mine = user
    ? (await sql`SELECT 1 FROM sparks WHERE post_id = ${postId} AND user_id = ${user.id}`).length > 0
    : false;
  const isAuthor = user && user.id === post.author_id;

  return (
    <div className="auth-wrap top">
      <article className="auth-card wide">
        <p className="muted"><Link href="/">← Нүүр</Link></p>
        <span className="chip">{post.kind}</span>
        <h1>{post.title}</h1>
        <p className="meta">
          <span>{post.initial}.{post.first_name}</span><span>·</span><span>{fmtDate(post.created_at)}</span>
        </p>
        <div className="body">{post.body}</div>

        <div className="actions">
          <span className="spark">✦ {post.sparks}</span>
          {user && !isAuthor && !mine && (
            <form action={sparkPost}>
              <input type="hidden" name="post_id" value={post.id} />
              <button className="btn" type="submit">✦ Оч өгөх</button>
            </form>
          )}
          {mine && <span className="muted">Та оч өгсөн</span>}
          {!user && <Link className="btn ghost" href="/login">Оч өгөхийн тулд нэвтрэх</Link>}
        </div>

        <h3>Сэтгэгдэл ({comments.length})</h3>
        {comments.map((c) => (
          <div key={c.id} className="comment">
            <b>{c.initial}.{c.first_name}</b> <span className="muted">· {fmtDate(c.created_at)}</span>
            <div>{c.body}</div>
          </div>
        ))}
        {user ? (
          <form action={addComment} className="comment-form">
            <input type="hidden" name="post_id" value={post.id} />
            <textarea name="body" rows={3} required placeholder="Сэтгэгдэл бичих…" />
            <button className="btn" type="submit">Илгээх</button>
          </form>
        ) : (
          <p className="muted">Сэтгэгдэл бичихийн тулд <Link href="/login">нэвтэрнэ үү</Link>.</p>
        )}
      </article>
    </div>
  );
}
