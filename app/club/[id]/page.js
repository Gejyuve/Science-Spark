import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/auth";
import { sql, ensureSchema } from "@/lib/db";
import { membershipOf, clubFollowSet, BOARD_MAX, JOIN_REWARD } from "@/lib/clubs";
import Shell from "../../components/Shell";
import MiniMap from "../../components/MiniMap";
import { ClubAv, ClubFollow } from "../../components/ClubBits";
import { Avatar, Stat, FollowBtn, followingSet, fmtK } from "../../components/Bits";
import { joinClub, leaveClub, declineInvite, toggleClubFollow } from "../../clubs/actions";

export const dynamic = "force-dynamic";

async function load(id) {
  await ensureSchema();
  const [c] = await sql`
    SELECT c.*,
      COALESCE((SELECT SUM(l.delta) FROM points_ledger l JOIN club_members m ON m.user_id = l.user_id WHERE m.club_id = c.id), 0)::int AS points,
      (SELECT COUNT(*) FROM club_follows f WHERE f.club_id = c.id)::int AS followers
    FROM clubs c WHERE c.id = ${id} AND c.status = 'active'`;
  return c || null;
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const c = Number.isInteger(+id) ? await load(+id).catch(() => null) : null;
  return { title: c ? `${c.name} · Клуб · Science Spark` : "Клуб · Science Spark" };
}

const SOC = { facebook: "s_fb", instagram: "s_ig", x: "s_x", linkedin: "s_li", youtube: "s_yt" };
const fmtDate = (d) => (d ? new Date(d).toISOString().slice(0, 10).replaceAll("-", ".") : null);

function Member({ m, viewer, following }) {
  return (
    <div className="ss-person">
      <Link href={`/u/${m.id}`} className="ss-person-av"><Avatar user={m} size={40} /></Link>
      <div>
        <Link href={`/u/${m.id}`} className="ss-person-name"><b>{m.initial}.{m.first_name}</b></Link>
        <span className="ss-statrow"><Stat points={m.points} followers={m.followers} followed={following.has(m.id)} /><FollowBtn id={m.id} viewer={viewer} following={following} /></span>
      </div>
    </div>
  );
}

// Figma 350:1053 «Клубын нийтийн хуудас»
export default async function ClubPage({ params, searchParams }) {
  const { id: raw } = await params;
  const sp = await searchParams;
  const id = Number(raw);
  if (!Number.isInteger(id)) notFound();
  const user = await getUser();
  const c = await load(id);
  if (!c) notFound();
  const members = await sql`
    SELECT u.id, u.initial, u.first_name, u.avatar_id AS avatar, m.role,
      COALESCE((SELECT SUM(delta) FROM points_ledger WHERE user_id = u.id), 0)::int AS points,
      (SELECT COUNT(*) FROM follows f WHERE f.followee_id = u.id)::int AS followers
    FROM club_members m JOIN users u ON u.id = m.user_id WHERE m.club_id = ${id}
    ORDER BY CASE m.role WHEN 'leader' THEN 0 WHEN 'board' THEN 1 ELSE 2 END, points DESC, m.joined_at`;
  const leader = members.find((m) => m.role === "leader");
  const board = members.filter((m) => m.role === "board");
  const rest = members.filter((m) => m.role === "member");
  const mine = user ? await membershipOf(user.id) : null;
  const isMember = mine?.club_id === id;
  const invited = user && !isMember ? (await sql`SELECT role FROM club_invites WHERE club_id = ${id} AND user_id = ${user.id}`)[0] : null;
  const following = await followingSet(user);
  const follows = await clubFollowSet(user);
  const followed = follows.has(id);
  const socials = Object.entries(c.socials || {}).filter(([k, v]) => SOC[k] && v);
  const join = sp.join;

  const info = [
    ["f_date", "Байгуулагдсан", fmtDate(c.founded)],
    ["i_home", "Хот", [c.city, c.country].filter(Boolean).join(", ")],
    ["i_mail", "И-мэйл", c.email && <a href={`mailto:${c.email}`}>{c.email}</a>],
    ["f_phone", "Утас", c.phone && <a href={`tel:${c.phone.replace(/\s/g, "")}`}>{c.phone}</a>],
    ["f_tag", "Ангилал", c.category],
    ["f_globe", "Вэбсайт", c.website && <a href={c.website} target="_blank" rel="noopener nofollow">{c.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</a>],
  ].filter((x) => x[2]);

  return (
    <Shell user={user} active="/clubs" header={false}>
      <div className="cp-page">
        <section className="cp-card">
          <div className="cp-cover">{c.cover_id ? <img src={`/img/${c.cover_id}`} alt="" /> : <span className="cp-cover-ph" />}</div>
          <div className="cp-top">
            <span className="cp-logo"><ClubAv c={{ id: c.id, name: c.name, logo: c.logo_id }} size={96} /></span>
            <div className="cp-title">
              <h1>{c.name}</h1>
              <span className="cp-stat">
                <b><img src="/icons/spark.svg" width={16} height={16} alt="" />{fmtK(c.points)}</b><small>оч</small>
                <b><img className="ic" src="/icons/followers.svg" width={14} height={14} alt="" />{members.length}</b><small>гишүүн</small>
                <b>{fmtK(c.followers)}</b><small>дагагч</small>
              </span>
            </div>
            <span className="ss-grow" />
            <div className="cp-actions">
              {socials.map(([k, v]) => (
                <a key={k} href={v} target="_blank" rel="noopener nofollow" className="cp-soc" aria-label={k}><img src={`/icons/${SOC[k]}.svg`} width={18} height={18} alt="" /></a>
              ))}
              {user && (
                <form action={toggleClubFollow}><input type="hidden" name="club_id" value={id} />
                  <button type="submit" className={"cp-btn ghost" + (followed ? " on" : "")}>{followed ? "✓ Дагаж байна" : "Дагах"}</button></form>
              )}
              {isMember ? (
                mine.role === "leader" ? <span className="cp-btn soft">Та удирдагч</span> : (
                  <form action={leaveClub}><input type="hidden" name="club_id" value={id} />
                    <button type="submit" className="cp-btn soft" title="Клубээс гарах">✓ Гишүүн · Гарах</button></form>
                )
              ) : (
                <form action={joinClub}><input type="hidden" name="club_id" value={id} />
                  <button type="submit" className="cp-btn">+ Нэгдэх</button></form>
              )}
            </div>
          </div>

          {invited && (
            <div className="cp-note ok">
              <span>Таныг энэ клубын <b>удирдах зөвлөлд</b> урьсан байна.</span>
              <form action={joinClub}><input type="hidden" name="club_id" value={id} /><input type="hidden" name="switch" value="1" /><button type="submit" className="cp-btn sm">Зөвшөөрөх</button></form>
              <form action={declineInvite}><input type="hidden" name="club_id" value={id} /><button type="submit" className="cp-btn sm ghost">Татгалзах</button></form>
            </div>
          )}
          {join === "ok" && isMember && <p className="cp-note ok">🎉 «{c.name}» клубт тавтай морил! Анх удаа клубт нэгдсэн бол танд +{JOIN_REWARD} оч нэмэгдлээ.</p>}
          {join === "switch" && mine && !isMember && (
            <div className="cp-note warn">
              <span>Та одоо «<b>{mine.name}</b>» клубын гишүүн байна. Нэг хүн нэг л клубт байх тул «{c.name}» руу шилжвэл өмнөх клубээсээ гарна.</span>
              <form action={joinClub}><input type="hidden" name="club_id" value={id} /><input type="hidden" name="switch" value="1" /><button type="submit" className="cp-btn sm">Шилжих</button></form>
              <Link href={`/club/${id}`} className="cp-btn sm ghost">Болих</Link>
            </div>
          )}
          {join === "leader" && <p className="cp-note bad">Та «{mine?.name}» клубын удирдагч тул өөр клубт шилжих боломжгүй.</p>}
          {join === "leaderleave" && <p className="cp-note bad">Удирдагч клубээсээ гарах боломжгүй.</p>}
          {join === "blocked" && <p className="cp-note bad">Таны эрх хязгаарлагдсан тул клубт нэгдэх боломжгүй байна.</p>}

          <p className="cp-about">{c.about}</p>
          {info.length > 0 && (
            <div className="cp-info">
              {info.map(([ic, k, v]) => (
                <div key={k}><img className="ic" src={`/icons/${ic}.svg`} width={16} height={16} alt="" /><span><small>{k}</small><b>{v}</b></span></div>
              ))}
            </div>
          )}
          {c.rules && (
            <details className="cp-rules"><summary>Клубын дүрэм</summary><p>{c.rules}</p></details>
          )}

          {c.lat != null && (
            <div className="cp-map">
              <MiniMap lat={c.lat} lng={c.lng} zoom={14} className="mm cp-mini" />
              <span><img className="ic" src="/icons/f_pin.svg" width={16} height={16} alt="" />{c.address || [c.city, c.country].filter(Boolean).join(", ")}
                <a href={`https://www.openstreetmap.org/?mlat=${c.lat}&mlon=${c.lng}#map=16/${c.lat}/${c.lng}`} target="_blank" rel="noopener">Томоор харах ↗</a></span>
            </div>
          )}

          {leader && (
            <div className="cp-sec">
              <h3>Удирдагч <small>(Админ эрхтэй)</small></h3>
              <Member m={leader} viewer={user} following={following} />
            </div>
          )}
          <div className="cp-sec">
            <h3>Удирдах зөвлөл <small>{board.length} / {BOARD_MAX}</small></h3>
            {board.length ? <div className="cp-grid">{board.map((m) => <Member key={m.id} m={m} viewer={user} following={following} />)}</div> : <p className="muted">Одоохондоо зөвлөлийн гишүүн алга.</p>}
          </div>
          <div className="cp-sec">
            <h3>Гишүүд <small>{rest.length}</small></h3>
            {rest.length ? <div className="cp-grid">{rest.map((m) => <Member key={m.id} m={m} viewer={user} following={following} />)}</div> : <p className="muted">Анхны гишүүн нь болоорой!</p>}
          </div>
        </section>
      </div>
    </Shell>
  );
}
