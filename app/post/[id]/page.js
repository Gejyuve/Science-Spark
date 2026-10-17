import Link from "next/link";
import { googleCalUrl, fmtEventRange, spanText, validLocal } from "@/lib/events";
import { notFound } from "next/navigation";
import { sql, ensureSchema } from "@/lib/db";
import { getUser, isStaff, isAdmin } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { addComment, sparkPost, removePost, deleteComment, publishOwn, likeComment, toggleSave } from "../../posts/actions";
import Share from "../../components/Share";
import LogicReport from "../../components/LogicReport";
import Shell from "../../components/Shell";
import { Avatar, Stat, When } from "../../components/Bits";

export const dynamic = "force-dynamic";

// Эвент, зарлал, бодролын нэмэлт мэдээлэл
function MetaBlock({ kind, m }) {
  const rows = kind === "Эвент"
    ? [["f_tag", "Төрөл", m.type], ["f_date", "Огноо, цаг", m.starts_at && fmtEventRange(m)], ["f_globe", "Хэлбэр", m.format],
       ["f_pin", "Байршил", m.location], ["f_clock", "Үргэлжлэх хугацаа", validLocal(m.starts_at) && validLocal(m.ends_at) ? spanText(m.starts_at, m.ends_at) : m.duration], ["f_ticket", "Тасалбар", m.price],
       ["f_people", "Хүний хязгаар", m.capacity], ["f_text", "Бүртгүүлэх заавар", m.register]]
    : kind === "Зарлал"
    ? [["f_date", "Хүчинтэй хугацаа", m.valid_until], ["f_phone", "Холбоо барих", m.contact]]
    : [];
  const link = m.link || m.source;
  const shown = rows.filter((r) => r[2]);
  if (!shown.length && !link) return null;
  return (
    <div className="ar-meta">
      {shown.map(([ic, k, v]) => (
        <div key={k}><img className="ic" src={`/icons/${ic}.svg`} width={18} height={18} alt="" /><span>{k}</span><b>{v}</b></div>
      ))}
      {link && (
        <div><img className="ic" src="/icons/f_link.svg" width={18} height={18} alt="" /><span>Холбоос</span>
          <a href={link} target="_blank" rel="noopener noreferrer nofollow">{link}</a></div>
      )}
    </div>
  );
}


// Нэг сэтгэгдэл ба түүний хариултууд (Figma: Асуулт · Дэлгэрэнгүй — муруй зураастай давхар хариулт)
function CommentNode({ c, kids, user, postId, canReply, depth }) {
  const children = kids[c.id] || [];
  return (
    <div className={"ar-comment" + (depth ? " reply" : "")} id={`c${c.id}`}>
      {depth > 0 && <span className="ss-curve" aria-hidden="true" />}
      <Link href={`/u/${c.author_id}`} className="ss-person">
        <Avatar user={{ id: c.author_id, first_name: c.first_name }} size={depth ? 32 : 40} />
        <div>
          <b>{c.initial}.{c.first_name}</b>
          <Stat points={c.points} followers={c.followers} />
        </div>
      </Link>
      <p>{c.body}</p>
      <div className="ar-cactions">
        {user && c.author_id !== user.id ? (
          <form action={likeComment}>
            <input type="hidden" name="comment_id" value={c.id} />
            <button type="submit" className={"ar-spark" + (c.liked ? " on" : "")} title={c.liked ? "Очоо буцаах" : "Оч өгөх"}>
              <img src={`/icons/${c.liked ? "spark" : "aspark"}.svg`} width={16} height={16} alt="Оч" className={c.liked ? "" : "ic"} />{c.likes}
            </button>
          </form>
        ) : (
          <span className="ar-spark static"><img src="/icons/spark.svg" width={16} height={16} alt="Оч" />{c.likes}</span>
        )}
        {canReply && user && (
          <details className="ar-replybox">
            <summary className="ar-link reply">Хариулах</summary>
            <form action={addComment} className="ar-compose small">
              <input type="hidden" name="post_id" value={postId} />
              <input type="hidden" name="parent_id" value={c.id} />
              <input name="body" required maxLength={2000} placeholder={`${c.initial}.${c.first_name}-д хариулах…`} aria-label="Хариулт" />
              <button type="submit">Хариулах</button>
            </form>
          </details>
        )}
        {canReply && !user && <Link href="/login" className="ar-link reply">Хариулах</Link>}
        <span className="ss-grow" />
        {user && (c.author_id === user.id || isAdmin(user)) && (
          <form action={deleteComment}>
            <input type="hidden" name="comment_id" value={c.id} />
            <button className="ar-link" type="submit">Устгах</button>
          </form>
        )}
        <When d={c.created_at} size={12} className="ar-cdate" />
      </div>
      {children.length > 0 && (
        <div className="ar-replies">
          {children.map((k) => <CommentNode key={k.id} c={k} kids={kids} user={user} postId={postId} canReply={canReply} depth={depth + 1} />)}
        </div>
      )}
    </div>
  );
}

// Figma: Нийтлэл · Харагдах хуудас
export default async function PostPage({ params, searchParams }) {
  const { id } = await params;
  const { error, ok } = await searchParams;
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
  const isArticle = post.kind === "Нийтлэл" || post.kind === "Мэдээ";
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
           (SELECT COUNT(*) FROM follows WHERE followee_id = u.id)::int AS followers,
           (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id)::int AS likes,
           EXISTS (SELECT 1 FROM comment_likes WHERE comment_id = c.id AND user_id = ${user ? user.id : 0}) AS liked
    FROM comments c JOIN users u ON u.id = c.author_id
    WHERE c.post_id = ${postId} ORDER BY c.created_at`;
  const kids = {};
  for (const c of comments) if (c.parent_id) (kids[c.parent_id] ||= []).push(c);
  const roots = comments.filter((c) => !c.parent_id);
  const saved = user
    ? (await sql`SELECT 1 FROM saves WHERE post_id = ${postId} AND user_id = ${user.id}`).length > 0
    : false;
  const mine = user
    ? (await sql`SELECT 1 FROM sparks WHERE post_id = ${postId} AND user_id = ${user.id}`).length > 0
    : false;

  const author = { id: post.author_id, initial: post.initial, first_name: post.first_name };
  const paras = post.body.split(/\n\s*\n/);
  const lead = post.subtitle || (paras.length > 1 ? paras[0] : null);
  const rest = post.subtitle ? paras : paras.length > 1 ? paras.slice(1) : paras;

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
            <span className="ss-grow" />
            <When d={post.created_at} size={16} className="ar-when" />
          </div>

          <div className="ar-content">
            <div className="ar-chips">
              <span className="ar-chip main">{post.kind}</span>
            </div>
            {!["Асуулт", "Бодрол"].includes(post.kind) && <h1 className="ar-title">{post.title}</h1>}

            {error && <p className="error">{error}</p>}
            {ok && <p className="notice">{ok}</p>}
            {!published && post.status !== "approved" && (
              <p className={post.status === "pending" ? "notice" : "error"}>
                {post.status === "rejected"
                  ? `Редакц засвар хийхээр буцаасан: ${post.review_note || ""}`
                  : post.status === "removed"
                  ? `Редакц нуусан: ${post.review_note || ""}`
                  : isArticle
                  ? "Редакцын хяналтад орсны дараа та өөрөө нийтлэх боломжтой болно."
                  : "Редакцын хяналтад орсны дараа нийтлэгдэнэ."}
                {post.status === "pending" && isStaff(user) && !isAuthor && (
                  <> <Link href={`/review/${post.id}`}>Хянах самбар нээх →</Link></>
                )}
              </p>
            )}
            {post.status === "approved" && (
              isAuthor ? (
                <div className="ar-ready">
                  <b>Редакц таны нийтлэлийг хянаж зөвшөөрлөө 🎉</b>
                  <p>
                    {post.original ? "Хянагч зарим засвар оруулсан. Доорх хувилбарыг шалгаад нийтлээрэй." : "Доорх хувилбарыг шалгаад нийтлээрэй."}
                    {post.review_note && <><br />Хянагчийн тайлбар: “{post.review_note}”</>}
                  </p>
                  {post.original && (
                    <details className="ar-orig">
                      <summary>Миний анхны хувилбарыг харах</summary>
                      <b>{post.original.title}</b>
                      {post.original.subtitle && <i>{post.original.subtitle}</i>}
                      <p>{post.original.body}</p>
                    </details>
                  )}
                  <div className="ar-ready-acts">
                    <form action={publishOwn}>
                      <input type="hidden" name="post_id" value={post.id} />
                      <button type="submit" className="btn">Нийтлэх</button>
                    </form>
                    <Link href={`/post/${post.id}/edit`} className="btn ghost">Засах (дахин хяналтад орно)</Link>
                  </div>
                </div>
              ) : (
                <p className="notice">Редакц зөвшөөрсөн. Бичээч нийтлэхийг хүлээж байна.</p>
              )
            )}
            {!published && isAuthor && (post.status === "rejected" || post.status === "removed") && (
              <p className="muted">Засаад хадгалбал дахин редакцын хяналтад орно.</p>
            )}

            {lead && (
              <>
                <p className="ar-lead">{lead}</p>
                <div className="ar-divider" />
              </>
            )}
            {rest.map((para, i) => <p key={i} className="ar-text">{para}</p>)}
            <MetaBlock kind={post.kind} m={post.meta || {}} />
            {post.kind === "Эвент" && published && googleCalUrl(post.title, post.meta || {}, post.body, `https://science-spark-sable.vercel.app/post/${post.id}`) && (
              <div className="ev-addcal">
                <span>Календарьт нэмэх:</span>
                <a href={googleCalUrl(post.title, post.meta || {}, post.body, `https://science-spark-sable.vercel.app/post/${post.id}`)} target="_blank" rel="noopener noreferrer">Google Calendar</a>
                <a href={`/post/${post.id}/ics`}>Утас / Outlook / Apple (.ics)</a>
              </div>
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
              {published && user && !isAuthor && !mine ? (
                <form action={sparkPost}>
                  <input type="hidden" name="post_id" value={post.id} />
                  <button type="submit" className="ar-react teal ar-sparkbtn" title="Оч өгөх">
                    <img src="/icons/sparkle.svg" width={21} height={23} alt="Оч өгөх" />{post.sparks}
                  </button>
                </form>
              ) : published && !user ? (
                <Link href="/login" className="ar-react teal ar-sparkbtn" title="Оч өгөх"><img src="/icons/sparkle.svg" width={21} height={23} alt="Оч" />{post.sparks}</Link>
              ) : (
                <span className={"ar-react teal" + (mine ? " given" : "")} title={mine ? "Та оч өгсөн" : "Оч"}><img src="/icons/sparkle.svg" width={21} height={23} alt="Оч" />{post.sparks}</span>
              )}
              <a href="#comments" className="ar-react"><img className="ic" src="/icons/comment18.svg" width={18} height={18} alt="Сэтгэгдэл" />{comments.length}</a>
              {published && !isAuthor && <LogicReport postId={post.id} kind={post.kind} title={post.title} loggedIn={!!user} />}
              {published && (user ? (
                <form action={toggleSave}>
                  <input type="hidden" name="post_id" value={post.id} />
                  <button type="submit" className="ar-iconbtn" title={saved ? "Хадгалснаас хасах" : "Хадгалах"} aria-pressed={saved}>
                    <img className={saved ? "" : "ic"} src={`/icons/${saved ? "saved20" : "save20"}.svg`} width={20} height={20} alt={saved ? "Хадгалсан" : "Хадгалах"} />
                  </button>
                </form>
              ) : (
                <Link href="/login" className="ar-iconbtn" title="Хадгалах"><img className="ic" src="/icons/save20.svg" width={20} height={20} alt="Хадгалах" /></Link>
              ))}
              {published && <Share path={`/post/${post.id}`} title={post.title} />}
              {isAuthor && ["Нийтлэл", "Мэдээ"].includes(post.kind) && <Link href={`/post/${post.id}/edit`} className="ar-flag">Засах</Link>}
              <span className="ss-grow" />
              {published && (
                <span className="ar-gift soon" title="Оч хандивлах · тун удахгүй">
                  <img src="/icons/gift.svg" width={15} height={15} alt="" />Оч хандивлах
                </span>
              )}
            </div>
            <div className="ar-divider" />

            <div id="comments" />
            {published && (user ? (
              <form action={addComment} className="ar-compose">
                <input type="hidden" name="post_id" value={post.id} />
                <Avatar user={user} size={40} />
                <input name="body" required maxLength={2000} placeholder={post.kind === "Асуулт" ? "Хариултаа бичнэ үү…" : "Сэтгэгдэл бичих…"} aria-label="Сэтгэгдэл" />
                <button type="submit">Илгээх</button>
              </form>
            ) : (
              <p className="muted">Сэтгэгдэл бичихийн тулд <Link href="/login">нэвтэрнэ үү</Link>.</p>
            ))}

            {roots.map((c, i) => (
              <div key={c.id}>
                {i > 0 && <div className="ar-divider" />}
                <CommentNode c={c} kids={kids} user={user} postId={post.id} canReply={published} depth={0} />
              </div>
            ))}

            {published && isAdmin(user) && !isAuthor && (
              <details className="mod">
                <summary className="muted">Админ: нуух</summary>
                <form action={removePost} className="stack">
                  <input type="hidden" name="post_id" value={post.id} />
                  <input name="note" required placeholder="Нуух шалтгаан (бичээчид очно)" />
                  <button className="btn ghost danger" type="submit">Нуух</button>
                </form>
              </details>
            )}
          </div>
        </article>
      </div>
    </Shell>
  );
}
