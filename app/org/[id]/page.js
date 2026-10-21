import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/auth";
import { sql, ensureSchema } from "@/lib/db";
import { influenceCount } from "@/lib/referral";
import { clubFollowSet } from "@/lib/clubs";
import { relTime } from "@/lib/format";
import Shell from "../../components/Shell";
import MiniMap from "../../components/MiniMap";
import { InfluenceBtn } from "../../components/Influence";
import { ClubAv } from "../../components/ClubBits";
import { Avatar, Stat, FollowBtn, followingSet, fmtK } from "../../components/Bits";
import { toggleClubFollow } from "../../clubs/actions";

export const dynamic = "force-dynamic";

async function load(id) {
  await ensureSchema();
  const [c] = await sql`
    SELECT c.*, (SELECT COUNT(*) FROM club_follows f WHERE f.club_id = c.id)::int AS followers
    FROM clubs c WHERE c.id = ${id} AND c.kind = 'org' AND c.status = 'active'`;
  return c || null;
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const c = Number.isInteger(+id) ? await load(+id).catch(() => null) : null;
  return { title: c ? `${c.name} · Science Spark` : "Байгууллага · Science Spark" };
}

const SOC = { facebook: "s_fb", instagram: "s_ig", x: "s_x", linkedin: "s_li", youtube: "s_yt" };
const fmtDate = (d) => (d ? new Date(d).toISOString().slice(0, 10).replaceAll("-", ".") : null);

// Figma 350:452 «Байгууллагын нийтийн хуудас»
export default async function OrgPage({ params }) {
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isInteger(id)) notFound();
  const user = await getUser();
  const c = await load(id);
  if (!c) notFound();
  const influence = await influenceCount("org", id);
  const [admin] = c.leader_id ? await sql`
    SELECT u.id, u.initial, u.first_name, u.avatar_id AS avatar,
      COALESCE((SELECT SUM(delta) FROM points_ledger WHERE user_id = u.id), 0)::int AS points,
      (SELECT COUNT(*) FROM follows f WHERE f.followee_id = u.id)::int AS followers
    FROM users u WHERE u.id = ${c.leader_id}` : [];
  const following = await followingSet(user);
  const followed = (await clubFollowSet(user)).has(id);
  const isAdmin = !!user && c.leader_id === user.id;
  const socials = Object.entries(c.socials || {}).filter(([k, v]) => SOC[k] && v);
  const info = [
    ["sparkle", "Бүртгүүлсэн", relTime(c.created_at).text],
    ["f_globe", "Үйл ажиллагааны чиглэл", c.field],
    ["i_mail", "И-мэйл", c.email && <a href={`mailto:${c.email}`}>{c.email}</a>],
    ["f_link", "Вэбсайт", c.website && <a href={c.website} target="_blank" rel="noopener nofollow">{c.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</a>],
    ["f_tag", "Төрөл", c.category],
    ["f_phone", "Утас", c.phone && <a href={`tel:${c.phone.replace(/\s/g, "")}`}>{c.phone}</a>],
    ["f_date", "Байгуулагдсан", fmtDate(c.founded)],
    ["f_pin", "Төв оффис", [c.city, c.country].filter(Boolean).join(", ")],
    ["i_home", "Хаяг", c.address],
  ].filter((x) => x[2]);

  return (
    <Shell user={user} header={false}>
      <div className="cp-page">
        <section className="cp-card">
          <div className="cp-cover">{c.cover_id ? <img src={`/img/${c.cover_id}`} alt="" /> : <span className="cp-cover-ph" />}</div>
          <div className="cp-top">
            <span className="cp-logo"><ClubAv c={{ id: c.id, name: c.name, logo: c.logo_id }} size={96} /></span>
            <div className="cp-title">
              <h1>{c.name}</h1>
              <span className="cp-stat"><b>{fmtK(c.followers)}</b><small>дагагч</small><InfluenceBtn href={`/org/${id}/influence`} n={influence} /></span>
            </div>
            <span className="ss-grow" />
            <div className="cp-actions">
              {socials.map(([k, v]) => (
                <a key={k} href={v} target="_blank" rel="noopener nofollow" className="cp-soc" aria-label={k}><img src={`/icons/${SOC[k]}.svg`} width={18} height={18} alt="" /></a>
              ))}
              {isAdmin ? (
                <Link href={`/org/${id}/edit`} className="cp-btn">Засах</Link>
              ) : user ? (
                <form action={toggleClubFollow}><input type="hidden" name="club_id" value={id} />
                  <button type="submit" className={"cp-btn" + (followed ? " soft" : "")}>{followed ? "✓ Дагаж байна" : "+ Дагах"}</button></form>
              ) : (
                <Link href="/login" className="cp-btn">+ Дагах</Link>
              )}
            </div>
          </div>
          <p className="cp-about">{c.about}</p>
          {info.length > 0 && (
            <div className="cp-info">
              {info.map(([ic, k, v]) => (
                <div key={k}><img className="ic" src={`/icons/${ic}.svg`} width={16} height={16} alt="" /><span><small>{k}</small><b>{v}</b></span></div>
              ))}
            </div>
          )}
          {c.lat != null && (
            <div className="cp-map">
              <MiniMap lat={c.lat} lng={c.lng} zoom={14} className="mm cp-mini" />
            </div>
          )}
          {admin && (
            <div className="cp-sec">
              <h3>Админ</h3>
              <div className="ss-person">
                <Link href={`/u/${admin.id}`} className="ss-person-av"><Avatar user={admin} size={40} /></Link>
                <div>
                  <Link href={`/u/${admin.id}`} className="ss-person-name"><b>{admin.initial}.{admin.first_name}</b></Link>
                  <span className="ss-statrow"><Stat points={admin.points} followers={admin.followers} followed={following.has(admin.id)} /><FollowBtn id={admin.id} viewer={user} following={following} /></span>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </Shell>
  );
}
