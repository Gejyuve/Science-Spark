import Link from "next/link";
import { notFound } from "next/navigation";
import { sql, ensureSchema } from "@/lib/db";
import { getUser, isPremium } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { toggleFollow } from "../../posts/actions";
import { fileComplaint, answerWarning } from "../../profile/actions";
import { paraDiff } from "@/lib/diff";
import { defaultCover } from "@/lib/covers";
import { influenceCount } from "@/lib/referral";
import Shell from "../../components/Shell";
import PostCard from "../../components/PostCard";
import { InfluenceBtn } from "../../components/Influence";
import { Avatar, fmtK, followingSet, NameBadges } from "../../components/Bits";

export const dynamic = "force-dynamic";

function ago(d) {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 864e5);
  if (days < 1) return "Өнөөдөр";
  if (days < 30) return `${days} өдрийн өмнө`;
  if (days < 365) return `${Math.floor(days / 30)} сарын өмнө`;
  return `${Math.floor(days / 365)} жилийн өмнө`;
}

const SOCIAL_ICON = { facebook: "s_fb", instagram: "s_ig", x: "s_x", linkedin: "s_li", youtube: "s_yt" };

// Гомдол, хариуны төлөв
function Answer({ status, body, note, label }) {
  if (!status) return null;
  const st = status === "open" ? ["Редакц шалгаж байна", "wait"] : status === "resolved" ? ["Хүлээн авсан", "ok"] : ["Үндэслэлгүй гэж үзсэн", "bad"];
  return (
    <div className="rp-answer">
      <span><b>{label}:</b> “{body}”</span>
      <em className={st[1]}>{st[0]}</em>
      {note && <small>Редакцын хариу: “{note}”</small>}
    </div>
  );
}

// Figma: Нийтийн профайл
export default async function PublicProfile({ params, searchParams }) {
  const { id } = await params;
  const { tab = "published", k: kindParam = "", ok, error, saved } = await searchParams;
  const uid = Number(id);
  if (!Number.isInteger(uid)) notFound();
  await ensureSchema();
  const me = await getUser();
  const myFollowing = await followingSet(me);
  const rows = await sql`
    SELECT u.id, u.initial, u.first_name, u.surname, u.avatar_id AS avatar, u.email, u.created_at, u.premium_until,
      COALESCE((SELECT SUM(delta) FROM points_ledger WHERE user_id = u.id), 0)::int AS points,
      (SELECT COUNT(*) FROM follows WHERE followee_id = u.id)::int AS followers
    FROM users u WHERE u.id = ${uid}`;
  if (rows.length) rows[0].influence = await influenceCount("person", uid);
  if (!rows.length) notFound();
  const u = rows[0];
  const isMe = !!me && me.id === u.id;
  const pr = (await sql`SELECT * FROM profiles WHERE user_id = ${uid}`)[0] || {};

  const all = await sql`
    SELECT p.id, p.author_id, p.kind, p.title, p.body, p.meta, p.status, p.image_id, p.views, p.created_at, u.initial, u.first_name, u.avatar_id AS avatar,
      EXISTS (SELECT 1 FROM saves WHERE post_id = p.id AND user_id = ${me ? me.id : 0}) AS saved,
      EXISTS (SELECT 1 FROM sparks WHERE post_id = p.id AND user_id = ${me ? me.id : 0}) AS sparked,
      (SELECT COUNT(*) FROM sparks WHERE post_id = p.id)::int AS sparks,
      (SELECT COUNT(*) FROM comments WHERE post_id = p.id)::int AS comments
    FROM posts p JOIN users u ON u.id = p.author_id
    WHERE p.author_id = ${uid} AND p.club_id IS NULL AND (p.status = 'published' OR ${isMe}::boolean)
    ORDER BY p.created_at DESC LIMIT 100`;
  for (const p of all) { p.author_points = u.points; p.author_followers = u.followers; }
  const savedList = isMe
    ? await sql`
      SELECT p.id, p.author_id, p.kind, p.title, p.body, p.meta, p.status, p.image_id, p.views, p.created_at, a.initial, a.first_name, a.avatar_id AS avatar, true AS saved,
        EXISTS (SELECT 1 FROM sparks WHERE post_id = p.id AND user_id = ${uid}) AS sparked,
        (SELECT COUNT(*) FROM sparks WHERE post_id = p.id)::int AS sparks,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id)::int AS comments,
        COALESCE((SELECT SUM(delta) FROM points_ledger WHERE user_id = a.id), 0)::int AS author_points,
        (SELECT COUNT(*) FROM follows WHERE followee_id = a.id)::int AS author_followers
      FROM saves s JOIN posts p ON p.id = s.post_id JOIN users a ON a.id = p.author_id
      WHERE s.user_id = ${uid} AND p.status = 'published'
      ORDER BY s.created_at DESC LIMIT 100`
    : [];
  // «Редакцаас хариу ирсэн»: редакцын засвар, нэгтгэл (өмнөх хувилбартай нь), сануулга, тэдгээрт бичсэн гомдол, хариу
  const edits = isMe
    ? await sql`
      SELECT x.*, l.status AS c_status, l.body AS c_body, l.note AS c_note FROM (
        SELECT r.id, r.post_id, r.role, r.note, r.title, r.body, r.created_at, r.editor_id,
          LAG(r.title) OVER w AS prev_title, LAG(r.body) OVER w AS prev_body
        FROM post_revisions r
        WHERE r.post_id IN (SELECT id FROM posts WHERE author_id = ${uid}
                            UNION SELECT post_id FROM post_credits WHERE user_id = ${uid} AND role = 'author')
        WINDOW w AS (PARTITION BY r.post_id ORDER BY r.created_at, r.id)
      ) x
      LEFT JOIN LATERAL (SELECT status, body, note FROM logic_reports WHERE revision_id = x.id AND user_id = ${uid} ORDER BY id DESC LIMIT 1) l ON true
      WHERE x.role IN ('editor', 'merge') AND x.editor_id IS DISTINCT FROM ${uid}
      ORDER BY x.created_at DESC LIMIT 50`
    : [];
  const postTitle = isMe && edits.length
    ? Object.fromEntries((await sql`SELECT id, title, kind, status FROM posts WHERE id = ANY(${[...new Set(edits.map((e) => e.post_id))]})`).map((p) => [p.id, p]))
    : {};
  const warnings = isMe
    ? await sql`
      SELECT w.id, w.note, w.created_at, l.status AS c_status, l.body AS c_body, l.note AS c_note
      FROM user_warnings w
      LEFT JOIN LATERAL (SELECT status, body, note FROM logic_reports WHERE warning_id = w.id ORDER BY id DESC LIMIT 1) l ON true
      WHERE w.user_id = ${uid} ORDER BY w.created_at DESC`
    : [];
  const hiddenComplaints = isMe
    ? Object.fromEntries((await sql`SELECT DISTINCT ON (post_id) post_id, status, body, note FROM logic_reports
                                    WHERE user_id = ${uid} AND type = 'complaint' AND revision_id IS NULL ORDER BY post_id, id DESC`).map((r) => [r.post_id, r]))
    : {};
  const groups = {
    saved: isMe ? savedList : null,
    all,
    published: all.filter((p) => p.status === "published"),
    pending: all.filter((p) => ["pending", "discussion", "draft"].includes(p.status)),
    replied: all.filter((p) => p.status === "rejected" || p.status === "removed"),
  };
  const current = groups[tab] && (isMe || tab === "published") ? tab : "published";
  // Төрлийн сонгогч (Figma 680:563): сонгосон төлөв доторх төрлөөр шүүнэ
  const base = groups[current] || [];
  const KIND_LIST = ["Нийтлэл", "Мэдээ", "Асуулт", "Бодрол", "Эвент", "Зарлал", "Үг"];
  const kind = KIND_LIST.includes(kindParam) ? kindParam : "";
  const kindCounts = Object.fromEntries(KIND_LIST.map((x) => [x, base.filter((p) => p.kind === x).length]));
  const list = kind ? base.filter((p) => p.kind === kind) : base;
  const href = (t, kk) => {
    const q = new URLSearchParams();
    if (t && t !== "published") q.set("tab", t);
    if (kk) q.set("k", kk);
    const s = q.toString();
    return `/u/${uid}${s ? `?${s}` : ""}`;
  };

  const following = me && !isMe
    ? (await sql`SELECT 1 FROM follows WHERE follower_id = ${me.id} AND followee_id = ${uid}`).length > 0
    : false;

  const place = (city, country) => [city, country].filter(Boolean).join(", ");
  const left = [
    ["i_join", "Асаасан өдөр", ago(u.created_at)],
    pr.email_public && ["i_mail", "И-мэйл", u.email],
    pr.gender && ["i_gender", "Хүйс", pr.gender],
    pr.birth_date && ["i_birth", "Төрсөн он, сар, өдөр", fmtDate(pr.birth_date)],
    (pr.live_city || pr.live_country) && ["i_live", "Амьдарч буй газар", place(pr.live_city, pr.live_country)],
    (pr.birth_city || pr.birth_country) && ["i_home", "Төрсөн газар", place(pr.birth_city, pr.birth_country)],
    (pr.education || pr.school) && ["i_edu", "Боловсрол", [pr.education, pr.school].filter(Boolean).join(" · ")],
  ].filter(Boolean);
  const right = [
    pr.profession && ["i_prof", "Төгссөн мэргэжил", pr.profession],
    pr.job && ["i_job", "Одоо хийж буй ажил", pr.job],
    pr.orcid && ["i_orcid", "ORCID iD", pr.orcid],
    pr.origin_view && ["i_origin", "Амьдралын үүслийн тухай үзэл", pr.origin_view],
    pr.belief && ["i_belief", "Итгэл үнэмшил", pr.belief],
    pr.religion && ["i_relig", "Шашин", pr.religion],
    pr.politics && ["i_polit", "Улс төрийн үзэл", pr.politics],
  ].filter(Boolean);
  const socials = Object.entries(pr.socials || {}).filter(([k]) => SOCIAL_ICON[k]);
  const Info = ({ items }) => (
    <div className="pu-col">
      {items.map(([icon, k, v]) => (
        <div key={k} className="pu-item">
          <img src={`/icons/${icon}.svg`} width={28} height={28} alt="" />
          <div><span>{k}</span><b>{v}</b></div>
        </div>
      ))}
    </div>
  );
  // iconOnly: зөвхөн дүрс (нэр нь хулгана аваачихад гарна)
  const TabLink = ({ k, icon, label, count, warn, iconOnly, mobIcon }) => (
    <Link href={href(k, kind)} className={"pu-tab" + (current === k ? " on" : "") + (iconOnly ? " icon" : "") + (mobIcon ? " mob-icon" : "")} title={label} aria-label={label}>
      {icon && <img src={`/icons/${icon}.svg`} width={16} height={16} alt="" />}
      {!iconOnly && <span className="pu-tlabel">{label}</span>}
      {count > 0 && <em className={warn ? "warn" : ""}>{count}</em>}
    </Link>
  );

  return (
    <Shell user={me} header="nav">
      {isMe && saved !== undefined && (
        <p className="pu-saved" role="status">
          <span>✓ Профайл тань хадгалагдлаа{Number(saved) > 0 && <> · <b>+{Number(saved)} оч</b> нэмэгдлээ</>}</span>
          <Link href="/profile/edit">Дахин засах</Link>
        </p>
      )}
      <section className="pu-card">
        <div className="pu-cover" style={{ backgroundImage: `url(${pr.cover_id ? `/img/${pr.cover_id}` : defaultCover(u.id)})`, backgroundSize: "cover", backgroundPosition: "center" }} />
        <div className="pu-top">
          <span className="pu-avatar"><Avatar user={u} size={96} /></span>
          <div className="pu-name">
            {/* Овгийг бүтнээр нь зөвхөн тухайн хүний өөрийн хуудсанд харуулна */}
            <h1>{u.surname ? `${u.surname} ${u.first_name}` : `${u.initial}.${u.first_name}`}<NameBadges points={u.points} supporter={isPremium(u)} size={22} /></h1>
            <div className="pu-stats">
              <Link href={isMe ? "/och#rules" : "/och"} className="pu-stat-link" title="Очны учир"><img src="/icons/pts.svg" width={14} height={14} alt="" /><b>{fmtK(u.points)}</b> оч</Link>
              <Link href={`/u/${u.id}/followers`} className="pu-stat-link" title="Дагагчдын жагсаалт"><img src="/icons/followers.svg" width={12} height={12} alt="" /><b>{fmtK(u.followers)}</b> дагагч</Link>
              <InfluenceBtn href={`/u/${u.id}/influence`} n={u.influence} />
            </div>
          </div>
          <div className="pu-actions">
            {socials.map(([k, v]) => (
              <a key={k} href={v} target="_blank" rel="noopener noreferrer nofollow" title={k}>
                <img src={`/icons/${SOCIAL_ICON[k]}.svg`} width={44} height={44} alt={k} />
              </a>
            ))}
            {isMe ? (
              <Link href="/profile/edit" className="pu-follow ghost">Профайл засах</Link>
            ) : me ? (
              <form action={toggleFollow}>
                <input type="hidden" name="user_id" value={u.id} />
                <button type="submit" className={"pu-follow" + (following ? " ghost" : "")}>
                  {following ? "Дагаж байна ✓" : <><img src="/icons/plus18.svg" width={18} height={18} alt="" />Дагах</>}
                </button>
              </form>
            ) : (
              <Link href="/login" className="pu-follow"><img src="/icons/plus18.svg" width={18} height={18} alt="" />Дагах</Link>
            )}
          </div>
        </div>

        <div className="pu-body">
          {pr.about && <p className="pu-quote">“{pr.about}”</p>}
          <div className="pu-divider" />
          <div className="pu-grid">
            <Info items={left} />
            <Info items={right} />
          </div>
          {isMe && right.length + left.length <= 2 && (
            <p className="muted">Профайлаа бөглөвөл энд мэдээлэл тань харагдана. <Link href="/profile/edit">Профайл засах</Link></p>
          )}
        </div>
      </section>

      <div className="pu-tabs">
        <details className="pu-kind">
          <summary>{kind || "Бүгд"} <em>{kind ? kindCounts[kind] : base.length}</em><img className="ic" src="/icons/chevdown.svg" width={14} height={14} alt="" /></summary>
          <div className="pu-kind-menu">
            <Link href={href(current, "")} className={kind ? "" : "on"}>Бүгд <em>{base.length}</em>{!kind && <i>✓</i>}</Link>
            {KIND_LIST.map((x) => (
              <Link key={x} href={href(current, x)} className={kind === x ? "on" : ""}>{x} <em>{kindCounts[x]}</em>{kind === x && <i>✓</i>}</Link>
            ))}
          </div>
        </details>
        <TabLink k="published" icon="t_pub" label="Нийтлэгдсэн" count={groups.published.length} mobIcon />
        {isMe && <TabLink k="pending" icon="t_wait" label="Редакцын хяналт хүлээж байгаа" count={groups.pending.length} warn iconOnly />}
        {isMe && <TabLink k="replied" icon="t_reply" label="Редакцаас хариу ирсэн" count={groups.replied.length + edits.length + warnings.length} iconOnly />}
        <span className="ss-grow" />
        {isMe && <TabLink k="saved" icon="t_saved" label="Хадгалсан" count={groups.saved.length} iconOnly />}
      </div>

      {current === "saved" && <p className="pu-savednote">Хадгалсан контент зөвхөн танд харагдана · {list.length} контент</p>}
      {current === "replied" && (
        <>
          {(ok || error) && <p className={error ? "error" : "notice"}>{error || ok}</p>}
          <p className="pu-savednote">Редакцын засвар, сануулга зөвхөн танд харагдана. Санал нийлэхгүй бол гомдол, хариугаа бичээрэй. Редакц шалгаад мэдэгдэнэ.</p>
          {warnings.length > 0 && (
            <section className="ss-card rp-box">
              <h2>Сануулга <em>{warnings.length}</em></h2>
              {warnings.map((w) => (
                <article key={w.id} className="rp-item warn">
                  <div className="rp-head"><b>Редакцаас сануулга</b><small>{fmtDate(w.created_at)}</small></div>
                  <p className="rp-text">“{w.note}”</p>
                  <Answer status={w.c_status} body={w.c_body} note={w.c_note} label="Таны хариу" />
                  {w.c_status !== "open" && (
                    <details className="rp-form">
                      <summary>{w.c_status ? "Дахин хариу бичих" : "Хариу бичих"}</summary>
                      <form action={answerWarning}>
                        <input type="hidden" name="warning_id" value={w.id} />
                        <textarea name="body" required minLength={10} maxLength={1000} rows={3} placeholder="Сануулгатай санал нийлэхгүй бол шалтгаанаа бичнэ үү" />
                        <button className="btn">Илгээх</button>
                      </form>
                    </details>
                  )}
                </article>
              ))}
            </section>
          )}
          {edits.length > 0 && (
            <section className="ss-card rp-box">
              <h2>Редакцын засвар <em>{edits.length}</em></h2>
              {edits.map((e) => {
                const post = postTitle[e.post_id] || {};
                const diff = paraDiff(e.prev_body, e.body);
                return (
                  <article key={e.id} className="rp-item">
                    <div className="rp-head">
                      <b>{e.role === "merge" ? "Нэгтгэсэн" : "Засварласан"}: <Link href={`/post/${e.post_id}`}>{post.title || e.title}</Link></b>
                      <small>{fmtDate(e.created_at)}</small>
                    </div>
                    {e.note && <p className="rp-text">Редакцын тайлбар: “{e.note}”</p>}
                    <details className="rp-diff">
                      <summary>Юу өөрчлөгдсөнийг харах</summary>
                      {e.prev_title && e.prev_title !== e.title && (
                        <p className="rp-title"><del>{e.prev_title}</del> <ins>{e.title}</ins></p>
                      )}
                      {diff.length === 0 ? <p className="muted">Агуулгад өөрчлөлт ороогүй.</p> : diff.map((d, i) =>
                        d.op === "gap" ? <p key={i} className="rp-gap">…</p> : d.op === "add" ? <ins key={i}>{d.text}</ins> : <del key={i}>{d.text}</del>
                      )}
                      <Link href={`/post/${e.post_id}/history`} className="rp-more">Засварын бүх түүх</Link>
                    </details>
                    <Answer status={e.c_status} body={e.c_body} note={e.c_note} label="Таны гомдол" />
                    {!e.c_status && (
                      <details className="rp-form">
                        <summary>Гомдол гаргах</summary>
                        <form action={fileComplaint}>
                          <input type="hidden" name="post_id" value={e.post_id} />
                          <input type="hidden" name="revision_id" value={e.id} />
                          <textarea name="body" required minLength={10} maxLength={1000} rows={3} placeholder="Засварын аль хэсэгтэй санал нийлэхгүй байгаа, яагаад гэдгээ бичнэ үү" />
                          <button className="btn">Илгээх</button>
                        </form>
                      </details>
                    )}
                  </article>
                );
              })}
            </section>
          )}
        </>
      )}
      {list.length === 0 && !(current === "replied" && edits.length + warnings.length > 0) && <div className="ss-card"><p className="ss-empty">{current === "saved" ? "Хадгалсан контент алга. Нийтлэл дээрх хадгалах дүрсээр хадгална." : current === "replied" ? "Редакцаас хариу ирээгүй байна." : kind ? `${kind} алга.` : "Нийтлэл алга."}</p></div>}
      {list.map((p) => (
        <div key={p.id} className="pu-post">
          <PostCard p={p} viewer={me} following={myFollowing} />
          {current === "replied" && p.status === "removed" && (
            <div className="rp-under">
              <Answer status={hiddenComplaints[p.id]?.status} body={hiddenComplaints[p.id]?.body} note={hiddenComplaints[p.id]?.note} label="Таны гомдол" />
              {!hiddenComplaints[p.id] && (
                <details className="rp-form">
                  <summary>Нуусанд гомдол гаргах</summary>
                  <form action={fileComplaint}>
                    <input type="hidden" name="post_id" value={p.id} />
                    <textarea name="body" required minLength={10} maxLength={1000} rows={3} placeholder="Яагаад нуух шаардлагагүй гэж үзэж байгаагаа бичнэ үү" />
                    <button className="btn">Илгээх</button>
                  </form>
                </details>
              )}
            </div>
          )}
        </div>
      ))}
    </Shell>
  );
}
