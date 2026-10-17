import Link from "next/link";
import { notFound } from "next/navigation";
import { sql, ensureSchema } from "@/lib/db";
import { getUser, isStaff, isAdmin } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { addComment, sparkPost, removePost, deleteComment } from "../../posts/actions";

export const dynamic = "force-dynamic";

export default async function PostPage({ params, searchParams }) {
  const { id } = await params;
  const { error } = await searchParams;
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
  const isAuthor = user && user.id === post.author_id;
  const published = post.status === "published";
  if (!published && !isAuthor && !isStaff(user)) notFound();
  const reviewers = post.reviewer_id
    ? await sql`SELECT initial, first_name, id FROM users WHERE id = ${post.reviewer_id}`
    : [];
  const reviewer = reviewers[0];

  const comments = await sql`
    SELECT c.*, u.initial, u.first_name FROM comments c
    JOIN users u ON u.id = c.author_id WHERE c.post_id = ${postId} ORDER BY c.created_at`;
  const mine = user
    ? (await sql`SELECT 1 FROM sparks WHERE post_id = ${postId} AND user_id = ${user.id}`).length > 0
    : false;

  return (
    <div className="auth-wrap top">
      <article className="auth-card wide">
        <p className="muted"><Link href="/">← Нүүр</Link></p>
        <span className="chip">{post.kind}</span>
        <h1>{post.title}</h1>
        <p className="meta">
          <Link href={`/u/${post.author_id}`}>{post.initial}.{post.first_name}</Link><span>·</span><span>{fmtDate(post.created_at)}</span>
        </p>
        {error && <p className="error">{error}</p>}
        {!published && (
          <p className={post.status === "pending" ? "notice" : "error"}>
            {post.status === "rejected"
              ? `Хянагч татгалзсан: ${post.review_note || ""}`
              : post.status === "removed"
              ? `Админ нийтээс хассан: ${post.review_note || ""}`
              : "Хянагчийн шалгалтад байна. Батлагдсаны дараа бусдад харагдана."}
          </p>
        )}
        {!published && isAuthor && post.status !== "pending" && (
          <p className="muted">Засаад хадгалбал дахин хянагчийн шалгалтад орно.</p>
        )}
        <div className="body">{post.body}</div>

        <div className="credits">
          <div><span className="muted">Бичсэн</span><br /><Link href={`/u/${post.author_id}`}>{post.initial}.{post.first_name}</Link></div>
          {published && reviewer && (
            <div><span className="muted">Хянасан</span><br /><Link href={`/u/${reviewer.id}`}>{reviewer.initial}.{reviewer.first_name}</Link></div>
          )}
        </div>

        <div className="actions">
          <span className="spark">✦ {post.sparks}</span>
          {published && user && !isAuthor && !mine && (
            <form action={sparkPost}>
              <input type="hidden" name="post_id" value={post.id} />
              <button className="btn" type="submit">✦ Оч өгөх</button>
            </form>
          )}
          {mine && <span className="muted">Та оч өгсөн</span>}
          {isAuthor && <Link className="btn ghost" href={`/post/${post.id}/edit`}>Засах</Link>}
          {published && !user && <Link className="btn ghost" href="/login">Оч өгөхийн тулд нэвтрэх</Link>}
        </div>

        <h3>Сэтгэгдэл ({comments.length})</h3>
        {comments.map((c) => (
          <div key={c.id} className="comment">
            <b><Link href={`/u/${c.author_id}`}>{c.initial}.{c.first_name}</Link></b> <span className="muted">· {fmtDate(c.created_at)}</span>
            <div>{c.body}</div>
            {user && (c.author_id === user.id || isAdmin(user)) && (
              <form action={deleteComment}>
                <input type="hidden" name="comment_id" value={c.id} />
                <button className="btn ghost danger small" type="submit">Устгах</button>
              </form>
            )}
          </div>
        ))}
        {!published ? null : user ? (
          <form action={addComment} className="comment-form">
            <input type="hidden" name="post_id" value={post.id} />
            <textarea name="body" rows={3} required placeholder="Сэтгэгдэл бичих…" />
            <button className="btn" type="submit">Илгээх</button>
          </form>
        ) : (
          <p className="muted">Сэтгэгдэл бичихийн тулд <Link href="/login">нэвтэрнэ үү</Link>.</p>
        )}
        {published && isAdmin(user) && !isAuthor && (
          <details className="mod">
            <summary className="muted">Админ: нийтээс хасах</summary>
            <form action={removePost} className="stack">
              <input type="hidden" name="post_id" value={post.id} />
              <input name="note" required placeholder="Хасах шалтгаан" />
              <button className="btn ghost danger" type="submit">Нийтээс хасах</button>
            </form>
          </details>
        )}
      </article>
    </div>
  );
}
