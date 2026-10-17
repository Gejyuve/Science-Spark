import Link from "next/link";
import { notFound } from "next/navigation";
import { sql, ensureSchema } from "@/lib/db";
import { getUser, isStaff, isAdmin } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { addComment, sparkPost, removePost, deleteComment } from "../../posts/actions";
import Shell from "../../components/Shell";
import { Avatar, Stat } from "../../components/Bits";

export const dynamic = "force-dynamic";


// Figma: Нийтлэл · Харагдах хуудас
export default async function PostPage({ params, searchParams }) {
  const { id } = await params;
  const { error } = await searchParams;
  const postId = Number(id);
  if (!Number.isInteger(postId)) notFound();
  await ensureSchema();
  const user = await getUser();

  const posts = await sql`
    SELECT p.*, u.initial, u.first_name,
           (SELECT COUNT(*) FROM sparks WHERE post_id = p.id)::int AS sparks,
           COALESCE((SELECT SUM(delta) FROM points_ledger WHERE user_id = u.id), 0)::int AS author_points,
           (SELECT COUNT(*) FROM follows WHERE followee_id = u.id)::int AS author_followers
    FROM posts p JOIN users u ON u.id = p.author_id WHERE p.id = ${postId}`;
  if (!posts.length) notFound();
  const post = posts[0];
  const isAuthor = !!user && user.id === post.author_id;
  const published = post.status === "published";
  if (!published && !isAuthor && !isStaff(user)) notFound();

  const reviewer = post.reviewer_id
    ? (await sql`
        SELECT u.id, u.initial, u.first_name,
               COALESCE((SELECT SUM(delta) FROM points_ledger WHERE user_id = u.id), 0)::int AS points,
               (SELECT COUNT(*) FROM follows WHERE followee_id = u.id)::int AS followers
        FROM users u WHERE u.id = ${post.reviewer_id}`)[0]
    : null;

  const comments = await sql`
    SELECT c.*, u.initial, u.first_name,
           COALESCE((SELECT SUM(delta) FROM points_ledger WHERE user_id = u.id), 0)::int AS points,
           (SELECT COUNT(*) FROM follows WHERE followee_id = u.id)::int AS followers
    FROM comments c JOIN users u ON u.id = c.author_id
    WHERE c.post_id = ${postId} ORDER BY c.created_at`;
  const mine = user
    ? (await sql`SELECT 1 FROM sparks WHERE post_id = ${postId} AND user_id = ${user.id}`).length > 0
    : false;

  const author = { id: post.author_id, initial: post.initial, first_name: post.first_name };
  const [lead, ...rest] = post.body.split(/\n\s*\n/);

  return (
    <Shell user={user} header={false}>
      <div className="ar-col">
        <div className="ar-pagebar">
          <Link href="/" className="ar-home" aria-label="Нүүр">
            <img src="/icons/logo.svg" width={42} height={42} alt="" />
          </Link>
          <Link href="/" className="ar-back">← Буцах</Link>
        </div>

        <article className="ar-card">
          <div className="ar-strip">
            <span><img className="ic" src="/icons/date16.svg" width={16} height={16} alt="" />{fmtDate(post.created_at)}</span>
          </div>

          <div className="ar-content">
            <div className="ar-chips">
              <span className="ar-chip main">{post.kind}</span>
            </div>
            <h1 className="ar-title">{post.title}</h1>

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

            {rest.length > 0 ? (
              <>
                <p className="ar-lead">{lead}</p>
                <div className="ar-divider" />
                {rest.map((para, i) => <p key={i} className="ar-text">{para}</p>)}
              </>
            ) : (
              <p className="ar-text">{post.body}</p>
            )}

            <div className="ar-credits">
              <div>
                <span className="ar-label">Бичсэн:</span>
                <Link href={`/u/${post.author_id}`} className="ss-person">
                  <Avatar user={author} size={40} />
                  <div>
                    <b>{post.initial}.{post.first_name}</b>
                    <Stat points={post.author_points} followers={post.author_followers} />
                  </div>
                </Link>
              </div>
              {published && reviewer && (
                <div>
                  <span className="ar-label">Хянасан:</span>
                  <Link href={`/u/${reviewer.id}`} className="ss-person">
                    <Avatar user={reviewer} size={40} />
                    <div>
                      <b>{reviewer.initial}.{reviewer.first_name}</b>
                      <Stat points={reviewer.points} followers={reviewer.followers} />
                    </div>
                  </Link>
                </div>
              )}
            </div>

            <div className="ar-divider" />
            <div className="ar-reactions">
              <span className="ar-react teal"><img src="/icons/sparkle.svg" width={21} height={23} alt="Оч" />{post.sparks}</span>
              <a href="#comments" className="ar-react"><img className="ic" src="/icons/comment18.svg" width={18} height={18} alt="Сэтгэгдэл" />{comments.length}</a>
              {published && user && !isAuthor && !mine && (
                <form action={sparkPost}>
                  <input type="hidden" name="post_id" value={post.id} />
                  <button className="ar-gift" type="submit">
                    <img src="/icons/gift.svg" width={15} height={15} alt="" />Оч өгөх
                  </button>
                </form>
              )}
              {mine && <span className="ar-gift done"><img src="/icons/gift.svg" width={15} height={15} alt="" />Оч өгсөн</span>}
              {published && !user && (
                <Link href="/login" className="ar-gift"><img src="/icons/gift.svg" width={15} height={15} alt="" />Оч өгөх</Link>
              )}
              <span className="ar-flag soon" title="Тун удахгүй">
                <img src="/icons/flag.svg" width={14} height={14} alt="" />Логик алдаа мэдэгд
              </span>
              {isAuthor && <Link href={`/post/${post.id}/edit`} className="ar-flag">Засах</Link>}
              <span className="ss-grow" />
              <span className="ar-iconbtn soon" title="Хадгалах · тун удахгүй"><img className="ic" src="/icons/save20.svg" width={20} height={20} alt="Хадгалах" /></span>
              <span className="ar-iconbtn soon" title="Хуваалцах · тун удахгүй"><img className="ic" src="/icons/share20.svg" width={20} height={20} alt="Хуваалцах" /></span>
            </div>
            <div className="ar-divider" />

            <div id="comments" />
            {published && (user ? (
              <form action={addComment} className="ar-compose">
                <input type="hidden" name="post_id" value={post.id} />
                <Avatar user={user} size={40} />
                <input name="body" required maxLength={2000} placeholder="Сэтгэгдэл бичих…" aria-label="Сэтгэгдэл" />
                <button type="submit">Илгээх</button>
              </form>
            ) : (
              <p className="muted">Сэтгэгдэл бичихийн тулд <Link href="/login">нэвтэрнэ үү</Link>.</p>
            ))}

            {comments.map((c, i) => (
              <div key={c.id}>
                {i > 0 && <div className="ar-divider" />}
                <div className="ar-comment">
                  <Link href={`/u/${c.author_id}`} className="ss-person">
                    <Avatar user={{ id: c.author_id, first_name: c.first_name }} size={40} />
                    <div>
                      <b>{c.initial}.{c.first_name}</b>
                      <Stat points={c.points} followers={c.followers} />
                    </div>
                  </Link>
                  <p>{c.body}</p>
                  <div className="ar-cactions">
                    <span className="ss-grow" />
                    {user && (c.author_id === user.id || isAdmin(user)) && (
                      <form action={deleteComment}>
                        <input type="hidden" name="comment_id" value={c.id} />
                        <button className="ar-link" type="submit">Устгах</button>
                      </form>
                    )}
                    <span className="ar-cdate">{fmtDate(c.created_at)}</span>
                  </div>
                </div>
              </div>
            ))}

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
          </div>
        </article>
      </div>
    </Shell>
  );
}
