import Link from "next/link";
import { notFound } from "next/navigation";
import { sql, ensureSchema } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { toggleFollow } from "../../posts/actions";
import Shell from "../../components/Shell";
import PostCard from "../../components/PostCard";
import { Avatar, fmtK, followingSet } from "../../components/Bits";

export const dynamic = "force-dynamic";

function ago(d) {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 864e5);
  if (days < 1) return "Өнөөдөр";
  if (days < 30) return `${days} өдрийн өмнө`;
  if (days < 365) return `${Math.floor(days / 30)} сарын өмнө`;
  return `${Math.floor(days / 365)} жилийн өмнө`;
}

const SOCIAL_ICON = { facebook: "s_fb", instagram: "s_ig", x: "s_x", linkedin: "s_li", youtube: "s_yt" };

// Figma: Нийтийн профайл
export default async function PublicProfile({ params, searchParams }) {
  const { id } = await params;
  const { tab = "all" } = await searchParams;
  const uid = Number(id);
  if (!Number.isInteger(uid)) notFound();
  await ensureSchema();
  const me = await getUser();
  const myFollowing = await followingSet(me);
  const rows = await sql`
    SELECT u.id, u.initial, u.first_name, u.surname, u.email, u.created_at,
      COALESCE((SELECT SUM(delta) FROM points_ledger WHERE user_id = u.id), 0)::int AS points,
      (SELECT COUNT(*) FROM follows WHERE followee_id = u.id)::int AS followers
    FROM users u WHERE u.id = ${uid}`;
  if (!rows.length) notFound();
  const u = rows[0];
  const isMe = !!me && me.id === u.id;
  const pr = (await sql`SELECT * FROM profiles WHERE user_id = ${uid}`)[0] || {};

  const all = await sql`
    SELECT p.id, p.author_id, p.kind, p.title, p.body, p.meta, p.status, p.created_at, u.initial, u.first_name,
      EXISTS (SELECT 1 FROM saves WHERE post_id = p.id AND user_id = ${me ? me.id : 0}) AS saved,
      (SELECT COUNT(*) FROM sparks WHERE post_id = p.id)::int AS sparks,
      (SELECT COUNT(*) FROM comments WHERE post_id = p.id)::int AS comments
    FROM posts p JOIN users u ON u.id = p.author_id
    WHERE p.author_id = ${uid} AND (p.status = 'published' OR ${isMe}::boolean)
    ORDER BY p.created_at DESC LIMIT 100`;
  for (const p of all) { p.author_points = u.points; p.author_followers = u.followers; }
  const savedList = isMe
    ? await sql`
      SELECT p.id, p.author_id, p.kind, p.title, p.body, p.meta, p.status, p.created_at, a.initial, a.first_name, true AS saved,
        (SELECT COUNT(*) FROM sparks WHERE post_id = p.id)::int AS sparks,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id)::int AS comments,
        COALESCE((SELECT SUM(delta) FROM points_ledger WHERE user_id = a.id), 0)::int AS author_points,
        (SELECT COUNT(*) FROM follows WHERE followee_id = a.id)::int AS author_followers
      FROM saves s JOIN posts p ON p.id = s.post_id JOIN users a ON a.id = p.author_id
      WHERE s.user_id = ${uid} AND p.status = 'published'
      ORDER BY s.created_at DESC LIMIT 100`
    : [];
  const groups = {
    saved: isMe ? savedList : null,
    all,
    published: all.filter((p) => p.status === "published"),
    pending: all.filter((p) => p.status === "pending" || p.status === "approved"),
    replied: all.filter((p) => p.status === "rejected" || p.status === "removed"),
  };
  const current = groups[tab] ? tab : "all";
  const list = groups[current];

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
    (pr.education || pr.school) && ["i_edu", "Одоогийн боловсролын түвшин", [pr.education, pr.school].filter(Boolean).join(" · ")],
  ].filter(Boolean);
  const right = [
    pr.profession && ["i_prof", "Төгссөн мэргэжил", pr.profession],
    pr.job && ["i_job", "Одоо хийж буй ажил", pr.job],
    pr.orcid && ["i_orcid", "ORCID iD", pr.orcid],
    pr.origin_view && ["i_origin", "Амьдралын үүслийн тухай үзэл", pr.origin_view],
    pr.religion && ["i_relig", "Шашны урсгал", pr.religion],
    pr.belief && ["i_belief", "Итгэл үнэмшил", pr.belief],
    pr.politics && ["i_polit", "Улс төрийн суртал", pr.politics],
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
  const TabLink = ({ k, icon, label, count, warn }) => (
    <Link href={`/u/${uid}${k === "all" ? "" : `?tab=${k}`}`} className={"pu-tab" + (current === k ? " on" : "")}>
      {icon && <img src={`/icons/${icon}.svg`} width={16} height={16} alt="" />}
      {label}
      {count > 0 && <em className={warn ? "warn" : ""}>{count}</em>}
    </Link>
  );

  return (
    <Shell user={me} header="nav">
      <section className="pu-card">
        <div className="pu-cover" />
        <div className="pu-top">
          <span className="pu-avatar"><Avatar user={u} size={96} /></span>
          <div className="pu-name">
            {/* Овгийг бүтнээр нь зөвхөн тухайн хүний өөрийн хуудсанд харуулна */}
            <h1>{u.surname ? `${u.surname} ${u.first_name}` : `${u.initial}.${u.first_name}`}</h1>
            <div className="pu-stats">
              <span><img src="/icons/pts.svg" width={14} height={14} alt="" /><b>{fmtK(u.points)}</b> оч</span>
              <span><img src="/icons/followers.svg" width={12} height={12} alt="" /><b>{fmtK(u.followers)}</b> дагагч</span>
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
        <TabLink k="all" label="Бүгд" count={groups.all.length} />
        <TabLink k="published" icon={current === "published" ? "t_pub" : null} label="Нийтлэгдсэн" />
        {isMe && <TabLink k="pending" icon="t_wait" label="Редакцын хяналт хүлээж байгаа" count={groups.pending.length} warn />}
        {isMe && <TabLink k="replied" icon="t_reply" label="Редакцаас хариу ирсэн" count={groups.replied.length} />}
        <span className="ss-grow" />
        {isMe && <TabLink k="saved" icon="t_saved" label="Хадгалсан" count={groups.saved.length} />}
      </div>

      {current === "saved" && <p className="pu-savednote">Хадгалсан контент зөвхөн танд харагдана · {list.length} контент</p>}
      {list.length === 0 && <div className="ss-card"><p className="ss-empty">{current === "saved" ? "Хадгалсан контент алга. Нийтлэл дээрх хадгалах дүрсээр хадгална." : "Нийтлэл алга."}</p></div>}
      {list.map((p) => (
        <div key={p.id} className="pu-post">
          {p.status !== "published" && (
            <span className={"pu-status " + p.status}>
              {p.status === "pending" ? "Редакцын хяналтад" : p.status === "approved" ? "Нийтлэхэд бэлэн" : p.status === "rejected" ? "Засвар хийхээр буцаасан" : "Нуугдсан"}
            </span>
          )}
          <PostCard p={p} viewer={me} following={myFollowing} />
        </div>
      ))}
    </Shell>
  );
}
