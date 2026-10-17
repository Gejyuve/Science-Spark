import Link from "next/link";
import { googleCalUrl, fmtEventRange, spanText, validLocal } from "@/lib/events";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import crypto from "node:crypto";
import { sql, ensureSchema } from "@/lib/db";
import { getUser, isStaff, isAdmin } from "@/lib/auth";
import { fmtDate, KIND_HREF, untilText } from "@/lib/format";
import { addComment, sparkPost, removePost, deleteComment, publishOwn, likeComment, toggleSave } from "../../posts/actions";
import Share from "../../components/Share";
import EventCover from "../../components/EventCover";
import LogicReport from "../../components/LogicReport";
import Shell from "../../components/Shell";
import { Avatar, Stat, When, Person, followingSet } from "../../components/Bits";

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
function CommentNode({ c, kids, user, postId, canReply, depth, following }) {
  const children = kids[c.id] || [];
  return (
    <div className={"ar-comment" + (depth ? " reply" : "")} id={`c${c.id}`}>
      {depth > 0 && <span className="ss-curve" aria-hidden="true" />}
      <Person id={c.author_id} initial={c.initial} first_name={c.first_name} avatar={c.avatar} points={c.points} followers={c.followers} size={depth ? 32 : 40} viewer={user} following={following} />
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
          {children.map((k) => <CommentNode key={k.id} c={k} kids={kids} user={user} postId={postId} canReply={canReply} depth={depth + 1} following={following} />)}
        </div>
      )}
    </div>
  );
}

// Figma 508:368 · Эвент · Дэлгэрэнгүй: дээд хэсэг (мэдээлэл + зураг) ба гарчиг
function EventTop({ post, m }) {
  const place = m.format === "Онлайн" ? "Онлайн" : [m.location, m.format && m.format !== "Танхим" ? m.format : null].filter(Boolean).join(" · ");
  const rows = [
    ["f_date", fmtEventRange(m)],
    place && ["f_pin", place],
    validLocal(m.starts_at) && ["f_clock", `Үргэлжлэх хугацаа: ${validLocal(m.ends_at) ? spanText(m.starts_at, m.ends_at) : m.duration || "—"}`],
    m.price && ["f_ticket", `Тасалбар: ${m.price}`],
    m.capacity && ["f_people", `Бүртгэх хязгаар: ${m.capacity} хүн`],
  ].filter(Boolean);
  return (
    <>
      <div className="evd-top">
        <div className="evd-facts">
          <div className="evd-chips">
            <Link href="/events" className="ar-chip main link">Эвент</Link>
            {m.type && <span className="evd-chip">{m.type}</span>}
          </div>
          {rows.map(([ic, v]) => (
            <span key={ic} className="evd-row"><img className="ic" src={`/icons/${ic}.svg`} width={18} height={18} alt="" />{v}</span>
          ))}
        </div>
        <div className="evd-cover">
          {post.image_id ? <img src={`/img/${post.image_id}`} alt="" /> : <EventCover type={m.type} starts={m.starts_at} />}
        </div>
      </div>
      <h1 className="ar-title evd-title">{post.title}</h1>
    </>
  );
}

// Figma 523:368 · Зарлал · Дэлгэрэнгүй: мэдээлэл + дөрвөлжин зураг, дараа нь гарчиг
function AnnTop({ post, m }) {
  const link = m.link || m.source;
  const rows = [
    m.valid_until && ["f_date", untilText(m.valid_until)],
    m.location && ["f_pin", m.location],
    m.contact && ["f_phone", m.contact],
    link && ["f_link", <a href={link} target="_blank" rel="noopener noreferrer nofollow" className="evd-url">{link.replace(/^https?:\/\//, "").replace(/\/$/, "")}</a>],
  ].filter(Boolean);
  return (
    <>
      <div className="evd-top">
        <div className="evd-facts">
          <div className="evd-chips">
            <Link href={KIND_HREF["Зарлал"]} className="ar-chip main link">Зарлал</Link>
            {m.type && <span className="evd-chip">{m.type}</span>}
          </div>
          {rows.map(([ic, v]) => (
            <span key={ic} className="evd-row"><img className="ic" src={`/icons/${ic}.svg`} width={18} height={18} alt="" />{v}</span>
          ))}
        </div>
        {post.image_id && <div className="evd-cover"><img src={`/img/${post.image_id}`} alt="" /></div>}
      </div>
      <h1 className="ar-title evd-title">{post.title}</h1>
    </>
  );
}

// Эвентийн үндсэн хэсэг: тайлбар, хөтөлбөр, газрын зураг, бүртгүүлэх заавар
function EventBody({ post, m, paras, published }) {
  const url = `https://science-spark-sable.vercel.app/post/${post.id}`;
  const cal = published && googleCalUrl(post.title, m, post.body, url);
  const showMap = m.format !== "Онлайн" && m.location && !/^https?:/i.test(m.location);
  return (
    <div className="evd-body">
      <h3>Тайлбар</h3>
      {paras.map((para, i) => <p key={i} className="ar-text">{para}</p>)}
      {m.program && (
        <>
          <h3>Хөтөлбөр</h3>
          <img className="evd-program" src={`/img/${m.program}`} alt="Хөтөлбөр" />
        </>
      )}
      {showMap && (
        <>
          <h3>Газрын зураг</h3>
          <div className="evd-map">
            <iframe title="Газрын зураг" loading="lazy" referrerPolicy="no-referrer-when-downgrade"
              src={`https://www.google.com/maps?q=${encodeURIComponent(m.location)}&output=embed`} />
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(m.location)}`} target="_blank" rel="noopener noreferrer" className="evd-maplink">Google Maps дээр нээх ↗</a>
          </div>
        </>
      )}
      {(m.register || m.link) && (
        <>
          <h3>Бүртгүүлэх заавар</h3>
          {m.register && <p className="ar-text">{m.register}</p>}
        </>
      )}
      <div className="evd-acts">
        {m.link && <a href={m.link} target="_blank" rel="noopener noreferrer nofollow" className="evd-btn">Бүртгүүлэх ↗</a>}
        {cal && <a href={cal} target="_blank" rel="noopener noreferrer" className="evd-btn ghost">Google Calendar-т нэмэх</a>}
        {published && <a href={`/post/${post.id}/ics`} className="evd-btn ghost">Утас / Outlook-т нэмэх</a>}
      </div>
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
    SELECT p.*, u.initial, u.first_name, u.avatar_id AS avatar,
           (SELECT COUNT(*) FROM sparks WHERE post_id = p.id)::int AS sparks,
           COALESCE((SELECT SUM(delta) FROM points_ledger WHERE user_id = u.id), 0)::int AS author_points,
           (SELECT COUNT(*) FROM follows WHERE followee_id = u.id)::int AS author_followers
    FROM posts p JOIN users u ON u.id = p.author_id WHERE p.id = ${postId}`;
  if (!posts.length) notFound();
  const post = posts[0];
  const isAuthor = !!user && user.id === post.author_id;
  const isArticle = post.kind === "Нийтлэл" || post.kind === "Мэдээ";
  // Үзсэн хүний тоо: нийтлэгдсэн контентыг зохиогчоос бусад хүн анх нээхэд +1
  let views = post.views || 0;
  if (post.status === "published" && !isAuthor) {
    try {
      let viewer = user ? `u:${user.id}` : null;
      if (!viewer) {
        const h = await headers();
        const ip = (h.get("x-forwarded-for") || "").split(",")[0].trim() || h.get("x-real-ip") || "";
        viewer = "a:" + crypto.createHash("sha256").update(ip + "|" + (h.get("user-agent") || "")).digest("hex").slice(0, 32);
      }
      const ins = await sql`INSERT INTO post_views (post_id, viewer) VALUES (${post.id}, ${viewer}) ON CONFLICT DO NOTHING RETURNING 1`;
      if (ins.length) views = (await sql`UPDATE posts SET views = views + 1 WHERE id = ${post.id} RETURNING views`)[0].views;
    } catch (e) {}
  }
  const isQ = post.kind === "Асуулт";
  const isEvent = post.kind === "Эвент";
  const isAnn = post.kind === "Зарлал";
  const published = post.status === "published";
  if (!published && !isAuthor && !isStaff(user)) notFound();

  const reviewer = post.reviewer_id
    ? (await sql`
        SELECT u.id, u.initial, u.first_name, u.avatar_id AS avatar,
               COALESCE((SELECT SUM(delta) FROM points_ledger WHERE user_id = u.id), 0)::int AS points,
               (SELECT COUNT(*) FROM follows WHERE followee_id = u.id)::int AS followers
        FROM users u WHERE u.id = ${post.reviewer_id}`)[0]
    : null;

  const comments = await sql`
    SELECT c.*, u.initial, u.first_name, u.avatar_id AS avatar,
           COALESCE((SELECT SUM(delta) FROM points_ledger WHERE user_id = u.id), 0)::int AS points,
           (SELECT COUNT(*) FROM follows WHERE followee_id = u.id)::int AS followers,
           (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id)::int AS likes,
           EXISTS (SELECT 1 FROM comment_likes WHERE comment_id = c.id AND user_id = ${user ? user.id : 0}) AS liked
    FROM comments c JOIN users u ON u.id = c.author_id
    WHERE c.post_id = ${postId} ORDER BY c.created_at`;
  const kids = {};
  for (const c of comments) if (c.parent_id) (kids[c.parent_id] ||= []).push(c);
  const roots = comments.filter((c) => !c.parent_id);
  const following = await followingSet(user);
  const saved = user
    ? (await sql`SELECT 1 FROM saves WHERE post_id = ${postId} AND user_id = ${user.id}`).length > 0
    : false;
  const mine = user
    ? (await sql`SELECT 1 FROM sparks WHERE post_id = ${postId} AND user_id = ${user.id}`).length > 0
    : false;

  const author = { id: post.author_id, initial: post.initial, first_name: post.first_name };
  const paras = post.body.split(/\n\s*\n/);
  const plain = post.kind === "Зарлал"; // зарлал: бүх догол мөр ижил
  const lead = plain ? null : post.subtitle || (paras.length > 1 ? paras[0] : null);
  const rest = plain || post.subtitle ? paras : paras.length > 1 ? paras.slice(1) : paras;

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
            <When d={post.created_at} size={16} className="ar-when" align="left" />
            <span className="ss-grow" />
            <span className="ar-views tip" data-tip={`Энэ контентыг ${views.toLocaleString("en-US")} хүн нээж үзсэн`} tabIndex={0}>
              <img className="ic" src="/icons/eye.svg" width={16} height={16} alt="Үзсэн" />{views.toLocaleString("en-US")}
            </span>
          </div>

          {post.image_id && isArticle && <img className="ar-cover" src={`/img/${post.image_id}`} alt="" />}
          <div className="ar-content">
            {isQ && (
              <Person className="ar-qauthor" id={post.author_id} initial={post.initial} first_name={post.first_name} avatar={post.avatar} points={post.author_points} followers={post.author_followers} viewer={user} following={following} />
            )}
            {isEvent && <EventTop post={post} m={post.meta || {}} />}
            {isAnn && <AnnTop post={post} m={post.meta || {}} />}
            {!isEvent && !isAnn && <div className="ar-chips">
              {KIND_HREF[post.kind]
                ? <Link href={KIND_HREF[post.kind]} className="ar-chip main link">{post.kind}</Link>
                : <span className="ar-chip main">{post.kind}</span>}
            </div>}
            {!["Асуулт", "Бодрол", "Эвент", "Зарлал"].includes(post.kind) && <h1 className="ar-title">{post.title}</h1>}

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

            {isEvent ? (
              <EventBody post={post} m={post.meta || {}} paras={paras} published={published} />
            ) : <>
            {lead && (
              <>
                <p className="ar-lead">{lead}</p>
                <div className="ar-divider" />
              </>
            )}
            {isQ ? (
              <div className="ar-qbox">{post.body}</div>
            ) : (
              rest.map((para, i) => <p key={i} className="ar-text">{para}</p>)
            )}
            {post.image_id && !isArticle && !isAnn && <img className={"ar-img" + (["Эвент", "Зарлал"].includes(post.kind) ? " sq" : "")} src={`/img/${post.image_id}`} alt="" />}
            {!isAnn && <MetaBlock kind={post.kind} m={post.meta || {}} />}
            {post.meta?.program && <figure className="ar-program"><figcaption>Хөтөлбөр</figcaption><img src={`/img/${post.meta.program}`} alt="Хөтөлбөр" /></figure>}
            {post.kind === "Эвент" && published && googleCalUrl(post.title, post.meta || {}, post.body, `https://science-spark-sable.vercel.app/post/${post.id}`) && (
              <div className="ev-addcal">
                <span>Календарьт нэмэх:</span>
                <a href={googleCalUrl(post.title, post.meta || {}, post.body, `https://science-spark-sable.vercel.app/post/${post.id}`)} target="_blank" rel="noopener noreferrer">Google Calendar</a>
                <a href={`/post/${post.id}/ics`}>Утас / Outlook / Apple (.ics)</a>
              </div>
            )}
            </>}

            {!isQ && <div className="ar-credits">
              <div>
                <span className="ar-label">{isAnn ? "Зарласан:" : "Бичсэн:"}</span>
                <Person id={post.author_id} initial={post.initial} first_name={post.first_name} avatar={post.avatar} points={post.author_points} followers={post.author_followers} viewer={user} following={following} />
              </div>
              {published && reviewer && (
                <div>
                  <span className="ar-label">Хянасан:</span>
                  <Person id={reviewer.id} initial={reviewer.initial} first_name={reviewer.first_name} avatar={reviewer.avatar} points={reviewer.points} followers={reviewer.followers} viewer={user} following={following} />
                </div>
              )}
            </div>}

            <div className="ar-divider" />
            <div className="ar-reactions">
              <span className="ar-left">
                {published && user && !isAuthor && !mine ? (
                  <form action={sparkPost}>
                    <input type="hidden" name="post_id" value={post.id} />
                    <button type="submit" className="ar-react teal ar-sparkbtn" title="Оч өгөх">
                      <img src="/icons/sparkle.svg" width={24} height={26} alt="Оч өгөх" />{post.sparks}
                    </button>
                  </form>
                ) : published && !user ? (
                  <Link href="/login" className="ar-react teal ar-sparkbtn" title="Оч өгөх"><img src="/icons/sparkle.svg" width={24} height={26} alt="Оч" />{post.sparks}</Link>
                ) : (
                  <span className={"ar-react teal" + (mine ? " given" : "")} title={mine ? "Та оч өгсөн" : "Оч"}><img src="/icons/sparkle.svg" width={24} height={26} alt="Оч" />{post.sparks}</span>
                )}
                <a href="#comments" className="ar-react"><img className="ic" src="/icons/comment20.svg" width={20} height={20} alt="Сэтгэгдэл" />{comments.length}</a>
              </span>
              {isAuthor && ["Нийтлэл", "Мэдээ"].includes(post.kind) && <Link href={`/post/${post.id}/edit`} className="ar-flag">Засах</Link>}
              <span className="ss-grow" />
              {published && !isQ && (
                <span className="ar-gift soon" title="Шагнах · тун удахгүй">
                  <img src="/icons/gift.svg" width={15} height={15} alt="" />Шагнах
                </span>
              )}
              <span className="ar-right">
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
                {published && <Share path={`/post/${post.id}`} title={post.title} align="right" />}
              </span>
            </div>
            <div className="ar-divider" />

            <div id="comments" />
            {published && (user ? (
              <form action={addComment} className="ar-compose">
                <input type="hidden" name="post_id" value={post.id} />
                <Avatar user={user} size={40} />
                <input name="body" required maxLength={2000} placeholder={post.kind === "Асуулт" ? "Хариултаа бичнэ үү…" : "Сэтгэгдэл бичих…"} aria-label="Сэтгэгдэл" />
                <button type="submit">{isQ ? "Хариулах" : "Илгээх"}</button>
              </form>
            ) : (
              <p className="muted">Сэтгэгдэл бичихийн тулд <Link href="/login">нэвтэрнэ үү</Link>.</p>
            ))}

            {roots.map((c, i) => (
              <div key={c.id}>
                {i > 0 && <div className="ar-divider" />}
                <CommentNode c={c} kids={kids} user={user} postId={post.id} canReply={published} depth={0} following={following} />
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
