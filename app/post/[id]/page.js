import Link from "next/link";
import { googleCalUrl, fmtEventRange, spanText, validLocal } from "@/lib/events";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import crypto from "node:crypto";
import { sql, ensureSchema } from "@/lib/db";
import { getUser, isStaff, isAdmin } from "@/lib/auth";
import { fmtDate, KIND_HREF, untilText } from "@/lib/format";
import { addComment, sparkPost, removePost, deleteComment, publishOwn, likeComment, toggleSave, awardBounty, addBounty, deletePost } from "../../posts/actions";
import { waitTone, BOUNTY_MIN, BOUNTY_MAX, REFUND_AFTER_ANSWERS } from "@/lib/bounty";
import { walletBalance, fmtMnt } from "@/lib/money";
import Share from "../../components/Share";
import EventCover from "../../components/EventCover";
import LogicReport from "../../components/LogicReport";
import Shell from "../../components/Shell";
import SupportModal from "../../components/SupportModal";
import { supportModalProps } from "@/lib/supportModal";
import { Avatar, Stat, When, Person, followingSet } from "../../components/Bits";
import { Langs, VoteBox } from "../../components/Terms";
import { TERM_KIND, daysLeft, synonyms, shortUrl } from "@/lib/terms";
import { crumbs } from "@/lib/tree";
import { render, outline } from "@/lib/md";
import { Sources } from "../../components/RichEditor";

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
function CommentNode({ c, kids, user, postId, canReply, depth, following, bounty }) {
  const children = kids[c.id] || [];
  const won = !depth && bounty?.status === "awarded" && bounty.comment_id === c.id;
  // Асуугч шагналтай асуултынхаа бусдын үндсэн хариултаас нэгийг сонгоно
  const canPick = !depth && bounty?.status === "open" && user && bounty.user_id === user.id && c.author_id !== user.id;
  return (
    <div className={"ar-comment" + (depth ? " reply" : "") + (won ? " won" : "")} id={`c${c.id}`}>
      {depth > 0 && <span className="ss-curve" aria-hidden="true" />}
      {won && <span className="bq-won">🏆 Асуугч энэ хариултыг сонгож, {fmtMnt(bounty.amount)}-ийн шагнал олгосон</span>}
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
        {canPick && (
          <form action={awardBounty}>
            <input type="hidden" name="comment_id" value={c.id} />
            <button type="submit" className="bq-pick" title={`${fmtMnt(bounty.amount)}-ийн шагналыг ${c.initial}.${c.first_name}-д олгоно. Буцаах боломжгүй.`}>✓ Энэ хариултыг сонгох</button>
          </form>
        )}
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

// Шагналтай асуултын тууз: дүн, хариулт хүлээсэн хугацаа (удах тусам дулаан өнгө) эсвэл хэнд олгосон
function BountyBanner({ b, answers }) {
  if (b.status === "awarded") {
    return (
      <div className="bq-banner done">
        <span className="bq-amt">🏆 {fmtMnt(b.amount)}</span>
        <span>Шагналыг <Link href={`/u/${b.winner_id}`}>{b.w_initial}.{b.w_first}</Link>-д олгосон. Мэдлэгээ хуваалцсанд баярлалаа!</span>
      </div>
    );
  }
  return (
    <div className="bq-banner">
      <span className="bq-amt">🏆 {fmtMnt(b.amount)}</span>
      <span>Шагналтай асуулт. Хамгийн зөв хариулт өгсөн хүнд асуугч шагналыг олгоно.</span>
      <span className="ss-grow" />
      <span className={`bq-wait ${waitTone(b.created_at)}`}>
        <When d={b.created_at} size={12} className="bq-when" /> {answers ? `${answers} хариулт` : "хариулт хүлээж байна"}
      </span>
    </div>
  );
}

// Асуугчийн хэрэгсэл: шагнал нэмэх, асуултаа устгах (түгжсэн мөнгө буцна)
function AskerTools({ post, bounty, othersAnswered, wallet }) {
  const locked = bounty?.status === "open" && othersAnswered && !REFUND_AFTER_ANSWERS;
  return (
    <div className="bq-tools">
      {!bounty && (
        <details className="bq-add">
          <summary>🏆 Шагнал нэмэх</summary>
          <form action={addBounty} className="bq-addform">
            <input type="hidden" name="post_id" value={post.id} />
            <input name="bounty" type="number" required min={BOUNTY_MIN} max={BOUNTY_MAX} step={500} placeholder="5000" inputMode="numeric" aria-label="Шагналын дүн" />
            <button type="submit" className="btn">Шагнал тавих</button>
            <small>Хэтэвчинд: {fmtMnt(wallet)}. Мөнгө түгжигдэж, таны сонгосон хариулагчийн хэтэвч рүү шууд орно.{wallet < BOUNTY_MIN && <> <Link href="/wallet">Хэтэвч</Link> хоосон байна.</>}</small>
          </form>
        </details>
      )}
      {bounty?.status === "open" && othersAnswered && <p className="muted bq-hint">Хамгийн зөв хариултын доорх «✓ Энэ хариултыг сонгох» товчийг дарж шагналаа олгоно уу.</p>}
      {!locked && bounty?.status !== "awarded" && (
        <details className="bq-del">
          <summary>Асуултаа устгах</summary>
          <form action={deletePost}>
            <input type="hidden" name="post_id" value={post.id} />
            <p className="muted">{bounty ? `Асуулт устаж, түгжсэн ${fmtMnt(bounty.amount)} хэтэвчинд тань буцна.` : "Асуулт бүр мөсөн устна."}</p>
            <button type="submit" className="btn ghost danger">Устгах</button>
          </form>
        </details>
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
        <div className="evd-cover">{post.image_id ? <img src={`/img/${post.image_id}`} alt="" /> : <EventCover type={m.type || "Зарлал"} />}</div>
      </div>
      <h1 className="ar-title evd-title">{post.title}</h1>
    </>
  );
}

// Нийтлэл доторх Толь-ийн нэр томьёог тодруулж, дээр нь очиход тайлбарыг харуулна (Figma 552:400)
function withTerms(text, terms, used) {
  let nodes = [text];
  for (const t of terms) {
    if (used.has(t.id)) continue;
    const needle = t.title.toLowerCase();
    const next = [];
    let done = false;
    for (const n of nodes) {
      if (done || typeof n !== "string") { next.push(n); continue; }
      const k = n.toLowerCase().indexOf(needle);
      if (k === -1) { next.push(n); continue; }
      next.push(n.slice(0, k));
      next.push(
        <span key={`t${t.id}`} className="tm-term" tabIndex={0}>
          <Link href={`/post/${t.id}`}>{n.slice(k, k + needle.length)}</Link>
          <span className="tm-pop" role="tooltip">
            <span className="tm-card">
              <span className="tm-card-top"><b>{t.title}</b><em className="tm-badge"><img src="/icons/dict.svg" width={11} height={11} alt="" />Толь</em></span>
              <span className="tm-langs">{t.meta?.en && <span><i>EN</i>{t.meta.en}</span>}{t.meta?.ru && <span><i>RU</i>{t.meta.ru}</span>}{t.meta?.la && <span><i>LA</i>{t.meta.la}</span>}</span>
              <span className="tm-p">{t.body.length > 220 ? t.body.slice(0, 220) + "…" : t.body}</span>
              {synonyms(t.meta).length > 0 && <small><span>Ижил утгатай:</span> <b>{synonyms(t.meta).join(", ")}</b></small>}
              <span className="tm-card-foot">{t.meta?.source ? <span className="tm-src">↗ {shortUrl(t.meta.source).split("/")[0]}</span> : <span />}<Link href={`/post/${t.id}`} className="tm-go">Толь руу →</Link></span>
            </span>
          </span>
        </span>
      );
      next.push(n.slice(k + needle.length));
      used.add(t.id);
      done = true;
    }
    nodes = next;
  }
  return nodes;
}

// Figma 557:409 / 567:708 · Толь · Дэлгэрэнгүй
function TermBody({ post, m, paras, user, following, reviewer, votes }) {
  const syn = synonyms(m);
  const disc = post.status === "discussion";
  const refs = String(m.refs || "").split(/\n|;/).map((x) => x.trim()).filter(Boolean);
  return (
    <>
      <div className="ar-chips"><Link href="/dict" className="ar-chip main link tl-chip"><img src="/icons/dict.svg" width={12} height={12} alt="" />Толь</Link></div>
      <h1 className="ar-title tl-h1">{post.title}</h1>
      <Langs m={m} big />
      <div className="tl-body">
        <h3>Тайлбар</h3>
        {paras.map((x, i) => <p key={i} className="ar-text">{x}</p>)}
        {syn.length > 0 && (
          <>
            <h3>Ижил утгатай өөр монгол үг</h3>
            <div className="tl-syns">{syn.map((x) => <span key={x}>{x}</span>)}</div>
          </>
        )}
        {(m.source || refs.length > 0) && (
          <>
            <h3>Эх сурвалж</h3>
            <div className="tl-src">
              {m.source && <a href={m.source} target="_blank" rel="noopener noreferrer nofollow"><img className="ic" src="/icons/f_link.svg" width={15} height={15} alt="" />{shortUrl(m.source)} ↗</a>}
              {refs.map((r) => <span key={r}><img className="ic" src="/icons/book18.svg" width={15} height={15} alt="" />{r}</span>)}
            </div>
          </>
        )}
      </div>
      <div className="ar-credits">
        <div>
          <span className="ar-label">{disc ? "Дэвшүүлсэн:" : "Нэмсэн:"}</span>
          <Person id={post.author_id} initial={post.initial} first_name={post.first_name} avatar={post.avatar} points={post.author_points} followers={post.author_followers} viewer={user} following={following} />
        </div>
        {!disc && reviewer && (
          <div>
            <span className="ar-label">Хянасан:</span>
            <Person id={reviewer.id} initial={reviewer.initial} first_name={reviewer.first_name} avatar={reviewer.avatar} points={reviewer.points} followers={reviewer.followers} viewer={user} following={following} />
          </div>
        )}
      </div>
      {disc && <VoteBox t={{ id: post.id, author_id: post.author_id, ...votes }} user={user} back={`/post/${post.id}`} detail />}
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
  if ((post.status === "published" || (post.kind === TERM_KIND && post.status === "discussion")) && !isAuthor) {
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
  const isTerm = post.kind === TERM_KIND;
  const published = post.status === "published";
  // Хэлэлцэж буй үг нийтэд нээлттэй: санал, сэтгэгдэл, хадгалах, хуваалцах боломжтой
  const open = published || (isTerm && post.status === "discussion");
  if (!open && !isAuthor && !isStaff(user)) notFound();
  const votes = isTerm
    ? (await sql`SELECT COUNT(*) FILTER (WHERE vote = 1)::int AS up, COUNT(*) FILTER (WHERE vote = -1)::int AS down,
                        MAX(CASE WHEN user_id = ${user ? user.id : 0} THEN vote END)::int AS my_vote
                 FROM term_votes WHERE post_id = ${post.id}`)[0]
    : null;

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
  const [bounty] = isQ
    ? await sql`SELECT b.*, w.initial AS w_initial, w.first_name AS w_first FROM bounties b LEFT JOIN users w ON w.id = b.winner_id
                WHERE b.post_id = ${postId} AND b.status IN ('open', 'awarded')`
    : [];
  // Сонгогдсон хариулт хамгийн дээр
  const roots = comments.filter((c) => !c.parent_id).sort((a, b) => (b.id === bounty?.comment_id) - (a.id === bounty?.comment_id));
  const othersAnswered = roots.some((c) => c.author_id !== post.author_id);
  const myWallet = isQ && isAuthor && published && !bounty ? await walletBalance(user.id) : 0;
  const following = await followingSet(user);
  const saved = user
    ? (await sql`SELECT 1 FROM saves WHERE post_id = ${postId} AND user_id = ${user.id}`).length > 0
    : false;
  const mine = user
    ? (await sql`SELECT 1 FROM sparks WHERE post_id = ${postId} AND user_id = ${user.id}`).length > 0
    : false;

  const author = { id: post.author_id, initial: post.initial, first_name: post.first_name };
  const paras = post.body.split(/\n\s*\n/);
  const glossary = isArticle
    ? await sql`SELECT id, title, body, meta FROM posts WHERE kind = ${TERM_KIND} AND status = 'published'
                AND char_length(title) >= 3 AND position(lower(title) in lower(${post.body})) > 0
                ORDER BY char_length(title) DESC LIMIT 40`
    : [];
  const usedTerms = new Set();
  const plain = post.kind === "Зарлал"; // зарлал: бүх догол мөр ижил
  // Нийтлэл, мэдээ: тэмдэглэгээтэй агуулга (lib/md.js) тул эхний догол мөрийг автоматаар тодруулахгүй
  const lead = plain ? null : post.subtitle || (!isArticle && paras.length > 1 ? paras[0] : null);
  const rest = plain || post.subtitle || isArticle ? paras : paras.length > 1 ? paras.slice(1) : paras;
  const srcList = isArticle && Array.isArray(post.meta?.sources) ? post.meta.sources : [];
  const heads = isArticle ? outline(post.body) : [];
  const cover = isArticle ? post.meta?.cover : null;

  return (
    <Shell user={user} header={false}>
      <div className="ar-col">
        <div className="ar-pagebar">
          <Link href={isTerm ? "/dict" : "/"} className="ar-back">← Буцах</Link>
        </div>

        <article className="ar-card">
          <div className="ar-strip">
            {isTerm && post.status === "discussion" ? (
              <span className="tl-strip orange"><img src="/icons/f_clock.svg" width={14} height={14} alt="" />Хэлэлцэж байна · {daysLeft(post.meta, post.created_at) ? `${daysLeft(post.meta, post.created_at)} хоног үлдсэн` : "хугацаа дууссан, зөвшөөрөгчийг хүлээж байна"}</span>
            ) : isTerm && published ? (
              <span className="tl-strip">✓ Батлагдсан {fmtDate(post.meta?.approved_at || post.reviewed_at)}</span>
            ) : (
              <When d={post.created_at} size={16} className="ar-when" align="left" />
            )}
            <span className="ss-grow" />
            <span className="ar-views tip" data-tip={`Энэ контентыг ${views.toLocaleString("en-US")} хүн нээж үзсэн`} tabIndex={0}>
              <img className="ic" src="/icons/eye.svg" width={16} height={16} alt="Үзсэн" />{views.toLocaleString("en-US")}
            </span>
          </div>

          {post.image_id && isArticle && (
            <figure className="ar-coverfig">
              <img className="ar-cover" src={`/img/${post.image_id}`} alt="" />
              {cover?.source && (
                <figcaption>Зураг: {cover.url ? <a href={cover.url} target="_blank" rel="noopener noreferrer nofollow">{cover.source}</a> : cover.source}</figcaption>
              )}
            </figure>
          )}
          <div className="ar-content">
            {isQ && (
              <Person className="ar-qauthor" id={post.author_id} initial={post.initial} first_name={post.first_name} avatar={post.avatar} points={post.author_points} followers={post.author_followers} viewer={user} following={following} />
            )}
            {isEvent && <EventTop post={post} m={post.meta || {}} />}
            {isAnn && <AnnTop post={post} m={post.meta || {}} />}
            {isTerm && <TermBody post={post} m={post.meta || {}} paras={paras} user={user} following={following} reviewer={reviewer} votes={votes} />}
            {!isEvent && !isAnn && !isTerm && <div className="ar-chips">
              {KIND_HREF[post.kind]
                ? <Link href={KIND_HREF[post.kind]} className="ar-chip main link">{post.kind}</Link>
                : <span className="ar-chip main">{post.kind}</span>}
              {post.category && crumbs(post.category).map((c) => (
                <Link key={c.path} href={`/tree/${c.path}`} className="ar-chip cat">{c.name}</Link>
              ))}
            </div>}
            {!["Асуулт", "Бодрол", "Эвент", "Зарлал", TERM_KIND].includes(post.kind) && <h1 className="ar-title">{post.title}</h1>}

            {error && <p className="error">{error}</p>}
            {ok && <p className="notice">{ok}</p>}
            {post.status === "draft" && (
              <p className="notice">Ноорог. {isAuthor ? <Link href={`/post/${post.id}/preview`}>Урьдчилж хараад редакц руу илгээх →</Link> : "Бичээч хараахан илгээгээгүй."}</p>
            )}
            {!open && post.status !== "approved" && post.status !== "draft" && (
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

            {isTerm ? null : isEvent ? (
              <EventBody post={post} m={post.meta || {}} paras={paras} published={published} />
            ) : <>
            {lead && (
              <>
                <p className="ar-lead">{lead}</p>
                <div className="ar-divider" />
              </>
            )}
            {isQ ? (
              <>
                {bounty && <BountyBanner b={bounty} answers={roots.length} />}
                <div className="ar-qbox">{post.body}</div>
                {isAuthor && published && <AskerTools post={post} bounty={bounty} othersAnswered={othersAnswered} wallet={myWallet} />}
              </>
            ) : (
              isArticle ? (
                <div className={"ar-tocwrap" + (heads.length >= 2 ? " has" : "")}>
                  {heads.length >= 2 && (
                    <nav className="ar-toc" aria-label="Нийтлэлийн бүтэц">
                      <b>Энэ нийтлэлд</b>
                      <ol>{heads.map((x) => <li key={x.id} className={`l${x.level}`}><a href={`#${x.id}`}>{x.text}</a></li>)}</ol>
                    </nav>
                  )}
                  <div className="ar-body">
                    {render(post.body, { text: glossary.length ? (s) => withTerms(s, glossary, usedTerms) : undefined })}
                    {srcList.length > 0 && <Sources sources={srcList} />}
                  </div>
                </div>
              ) : rest.map((para, i) => <p key={i} className="ar-text">{glossary.length ? withTerms(para, glossary, usedTerms) : para}</p>)
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

            {!isQ && !isTerm && <div className="ar-credits">
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
                {open && user && !isAuthor && !mine ? (
                  <form action={sparkPost}>
                    <input type="hidden" name="post_id" value={post.id} />
                    <button type="submit" className="ar-react teal ar-sparkbtn" title="Оч өгөх">
                      <img src="/icons/sparkle.svg" width={24} height={26} alt="Оч өгөх" />{post.sparks}
                    </button>
                  </form>
                ) : open && !user ? (
                  <Link href="/login" className="ar-react teal ar-sparkbtn" title="Оч өгөх"><img src="/icons/sparkle.svg" width={24} height={26} alt="Оч" />{post.sparks}</Link>
                ) : (
                  <span className={"ar-react teal" + (mine ? " given" : "")} title={mine ? "Та оч өгсөн" : "Оч"}><img src="/icons/sparkle.svg" width={24} height={26} alt="Оч" />{post.sparks}</span>
                )}
                <a href="#comments" className="ar-react"><img className="ic" src="/icons/comment20.svg" width={20} height={20} alt="Сэтгэгдэл" />{comments.length}</a>
              </span>
              {isAuthor && ["Нийтлэл", "Мэдээ"].includes(post.kind) && <Link href={`/post/${post.id}/edit`} className="ar-flag">Засах</Link>}
              <span className="ss-grow" />
              {published && !isQ && !isAuthor && (
                <SupportModal kind="tip" className="ar-gift" label={<><img src="/icons/gift.svg" width={15} height={15} alt="" />Шагнал</>}
                  writer={{ id: post.author_id, name: `${post.initial}.${post.first_name}` }} postId={post.id} {...supportModalProps(user)} />
              )}
              <span className="ar-right">
                {published && !isAuthor && <LogicReport postId={post.id} kind={post.kind} title={post.title} loggedIn={!!user} />}
                {open && (user ? (
                  <form action={toggleSave}>
                    <input type="hidden" name="post_id" value={post.id} />
                    <button type="submit" className="ar-iconbtn" title={saved ? "Хадгалснаас хасах" : "Хадгалах"} aria-pressed={saved}>
                      <img className={saved ? "" : "ic"} src={`/icons/${saved ? "saved20" : "save20"}.svg`} width={20} height={20} alt={saved ? "Хадгалсан" : "Хадгалах"} />
                    </button>
                  </form>
                ) : (
                  <Link href="/login" className="ar-iconbtn" title="Хадгалах"><img className="ic" src="/icons/save20.svg" width={20} height={20} alt="Хадгалах" /></Link>
                ))}
                {open && <Share path={`/post/${post.id}`} title={post.title} align="right" />}
              </span>
            </div>
            <div className="ar-divider" />

            <div id="comments" />
            {isTerm && (
              <div className="tl-dhead">
                <h2>Хэлэлцүүлэг <em>{comments.length}</em>
                  {published && <span className="tl-arch"><img className="ic" src="/icons/save18.svg" width={12} height={12} alt="" />Архив · Дэвшүүлсэн {fmtDate(post.created_at)}</span>}
                </h2>
                <small>Орчуулга, тайлбар, ижил утгатай үгийг хамтдаа сайжруулах орон зай.</small>
              </div>
            )}
            {open && (user ? (
              <form action={addComment} className="ar-compose">
                <input type="hidden" name="post_id" value={post.id} />
                <Avatar user={user} size={40} />
                <input name="body" required maxLength={2000} placeholder={post.kind === "Асуулт" ? "Хариултаа бичнэ үү…" : isTerm ? "Санал, засвар, асуултаа бичнэ үү…" : "Сэтгэгдэл бичих…"} aria-label="Сэтгэгдэл" />
                <button type="submit">{isQ ? "Хариулах" : "Илгээх"}</button>
              </form>
            ) : (
              <p className="muted">Сэтгэгдэл бичихийн тулд <Link href="/login">нэвтэрнэ үү</Link>.</p>
            ))}

            {roots.map((c, i) => (
              <div key={c.id}>
                {i > 0 && <div className="ar-divider" />}
                <CommentNode c={c} kids={kids} user={user} postId={post.id} canReply={open} depth={0} following={following} bounty={bounty} />
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
