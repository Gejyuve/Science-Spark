import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { sql, ensureSchema } from "@/lib/db";
import { influenceCount } from "@/lib/referral";
import { membershipOf, clubFollowSet, BOARD_MAX, ymd } from "@/lib/clubs";
import Shell from "../../components/Shell";
import MiniMap from "../../components/MiniMap";
import { InfluenceBtn } from "../../components/Influence";
import { ClubAv, ClubFollow } from "../../components/ClubBits";
import { Avatar, Stat, FollowBtn, followingSet, fmtK } from "../../components/Bits";
import { chatUnread } from "@/lib/chat";
import { listTasks, listReports } from "@/lib/tasks";
import TaskCard, { ReportCard } from "../../components/TaskCard";
import ScrollActive from "../../components/ScrollActive";
import { leaveClub, declineInvite, acceptInvite, toggleClubFollow, decideRequests, removeMember, cancelRequest, offerLead, cancelLeadOffer, acceptLead, declineLead } from "../../clubs/actions";

export const dynamic = "force-dynamic";

async function load(id) {
  await ensureSchema();
  const [c] = await sql`
    SELECT c.*,
      (COALESCE((SELECT SUM(l.delta) FROM points_ledger l JOIN club_members m ON m.user_id = l.user_id WHERE m.club_id = c.id), 0)
       + COALESCE((SELECT SUM(k.delta) FROM club_points k WHERE k.club_id = c.id), 0))::int AS points,
      (SELECT COUNT(*) FROM club_follows f WHERE f.club_id = c.id)::int AS followers
    FROM clubs c WHERE c.id = ${id} AND c.kind = 'club' AND c.status = 'active'`;
  return c || null;
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const c = Number.isInteger(+id) ? await load(+id).catch(() => null) : null;
  return { title: c ? `${c.name} · Клуб · Science Spark` : "Клуб · Science Spark" };
}

const SOC = { facebook: "s_fb", instagram: "s_ig", x: "s_x", linkedin: "s_li", youtube: "s_yt" };
const fmtDate = (d) => (d ? new Date(d).toISOString().slice(0, 10).replaceAll("-", ".") : null);

function Member({ m, viewer, following, clubId, canRemove }) {
  return (
    <div className="ss-person cp-member">
      <Link href={`/u/${m.id}`} className="ss-person-av"><Avatar user={m} size={40} /></Link>
      <div>
        <Link href={`/u/${m.id}`} className="ss-person-name"><b>{m.initial}.{m.first_name}</b></Link>
        <span className="ss-statrow"><Stat points={m.points} followers={m.followers} followed={following.has(m.id)} /><FollowBtn id={m.id} viewer={viewer} following={following} /></span>
      </div>
      {canRemove && (
        <form action={removeMember} className="cp-rm"><input type="hidden" name="club_id" value={clubId} /><input type="hidden" name="user_id" value={m.id} />
          <button type="submit" title="Клубээс хасах">Хасах</button></form>
      )}
    </div>
  );
}

// Figma 350:1053 «Клубийн нийтийн хуудас»
export default async function ClubPage({ params, searchParams }) {
  const { id: raw } = await params;
  const sp = await searchParams;
  const id = Number(raw);
  if (!Number.isInteger(id)) notFound();
  if (sp.tab === "chat") redirect(`/club/${id}/chat`);
  const user = await getUser();
  const c = await load(id);
  if (!c) notFound();
  const influence = await influenceCount("club", id);
  const members = await sql`
    SELECT u.id, u.initial, u.first_name, u.avatar_id AS avatar, m.role,
      COALESCE((SELECT SUM(delta) FROM points_ledger WHERE user_id = u.id), 0)::int AS points,
      (SELECT COUNT(*) FROM follows f WHERE f.followee_id = u.id)::int AS followers
    FROM club_members m JOIN users u ON u.id = m.user_id WHERE m.club_id = ${id}
    ORDER BY CASE m.role WHEN 'leader' THEN 0 WHEN 'board' THEN 1 ELSE 2 END, points DESC, m.joined_at`;
  const leader = members.find((m) => m.role === "leader");
  const board = members.filter((m) => m.role === "board");
  const rest = members.filter((m) => m.role === "member");
  const offerTo = c.lead_offer_to ? members.find((m) => m.id === c.lead_offer_to) : null;
  const mine = user ? await membershipOf(user.id) : null;
  const isMember = mine?.club_id === id;
  const invited = user && !isMember ? (await sql`SELECT role FROM club_invites WHERE club_id = ${id} AND user_id = ${user.id}`)[0] : null;
  const isLeader = !!user && c.leader_id === user.id;
  const myReq = user ? (await sql`SELECT club_id FROM club_requests WHERE user_id = ${user.id}`)[0] : null;
  const requests = isLeader ? await sql`
    SELECT u.id, u.initial, u.first_name, u.avatar_id AS avatar, r.reason, r.created_at,
      COALESCE((SELECT SUM(delta) FROM points_ledger WHERE user_id = u.id), 0)::int AS points,
      (SELECT COUNT(*) FROM follows f WHERE f.followee_id = u.id)::int AS followers,
      (SELECT c2.name FROM club_members m2 JOIN clubs c2 ON c2.id = m2.club_id WHERE m2.user_id = u.id) AS other,
      (SELECT MAX(at) FROM club_moves mv WHERE mv.user_id = u.id) AS moved_at
    FROM club_requests r JOIN users u ON u.id = r.user_id WHERE r.club_id = ${id} ORDER BY r.created_at` : [];
  const tab = isLeader && sp.tab === "requests" ? "requests" : sp.tab === "tasks" ? "tasks" : sp.tab === "reports" ? "reports" : "members";
  const [tasks, reports] = await Promise.all([listTasks({ clubId: id, limit: 60 }), listReports({ clubId: id, limit: 60 })]);
  const unreadChat = isMember ? await chatUnread(user.id, id) : 0;
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
    ["f_tag", "Төрөл", c.club_type],
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
                <InfluenceBtn href={`/club/${id}/influence`} n={influence} />
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
              {isLeader ? (
                <Link href={`/club/${id}/edit`} className="cp-btn"><img src="/icons/pen16.svg" width={14} height={14} alt="" style={{ filter: "brightness(10)" }} />Засах</Link>
              ) : isMember ? (
                <form action={leaveClub}><input type="hidden" name="club_id" value={id} />
                  <button type="submit" className="cp-btn soft" title="Клубээс гарах">✓ Гишүүн · Гарах</button></form>
              ) : myReq?.club_id === id ? (
                <Link href={`/club/${id}/join`} className="cp-btn soft">⏳ Хүсэлт илгээсэн</Link>
              ) : (
                <Link href={user ? `/club/${id}/join` : "/login"} className="cp-btn">+ Нэгдэх</Link>
              )}
            </div>
          </div>

          {user && c.lead_offer_to === user.id && isMember && (
            <div className="cp-note ok">
              <span>Клубийн удирдагч таныг <b>шинэ удирдагч</b> болгох санал илгээлээ. Зөвшөөрвөл клубийн нэрээр нийтлэх, гишүүн элсүүлэх, тайлан илгээх эрх танд шилжинэ.</span>
              <form action={acceptLead}><input type="hidden" name="club_id" value={id} /><button type="submit" className="cp-btn sm">Зөвшөөрөх</button></form>
              <form action={declineLead}><input type="hidden" name="club_id" value={id} /><button type="submit" className="cp-btn sm ghost">Татгалзах</button></form>
            </div>
          )}
          {sp.lead === "ok" && isLeader && <p className="cp-note ok"><span>🎉 Та «{c.name}» клубийн шинэ удирдагч боллоо. <Link href="/clubs/code#lead">Клубүүдийн код</Link>-оо дахин нэг харчихаарай.</span></p>}
          {invited && (
            <div className="cp-note ok">
              <span>Таныг энэ клубийн <b>удирдах зөвлөлд</b> урьсан байна.</span>
              <form action={acceptInvite}><input type="hidden" name="club_id" value={id} /><button type="submit" className="cp-btn sm">Зөвшөөрөх</button></form>
              <form action={declineInvite}><input type="hidden" name="club_id" value={id} /><button type="submit" className="cp-btn sm ghost">Татгалзах</button></form>
            </div>
          )}
          {join === "inviteswitch" && mine && (
            <div className="cp-note warn">
              <span>Та одоо «<b>{mine.name}</b>» клубийн гишүүн. Урилгыг хүлээн авбал тэр клубээсээ гарч, анхны клубийн урамшууллын оч хасагдана. Дараа нь 1 сар шилжих боломжгүй.</span>
              <form action={acceptInvite}><input type="hidden" name="club_id" value={id} /><input type="hidden" name="switch" value="1" /><button type="submit" className="cp-btn sm">Шилжих</button></form>
              <Link href={`/club/${id}`} className="cp-btn sm ghost">Болих</Link>
            </div>
          )}
          {join === "ok" && isMember && <p className="cp-note ok">🎉 «{c.name}» клубт тавтай морил!</p>}
          {join === "sent" && <p className="cp-note ok">Нэгдэх хүсэлт тань илгээгдлээ. Клубийн удирдагч зөвшөөрмөгц мэдэгдэл очно.</p>}
          {join === "leave" && isMember && (
            <div className="cp-note warn">
              <span>Клубээс гарвал 1 сарын дотор өөр клубт нэгдэх боломжгүй. Гарах уу?</span>
              <form action={leaveClub}><input type="hidden" name="club_id" value={id} /><input type="hidden" name="confirm" value="1" /><button type="submit" className="cp-btn sm danger">Гарах</button></form>
              <Link href={`/club/${id}`} className="cp-btn sm ghost">Болих</Link>
            </div>
          )}
          {join === "leaderleave" && <p className="cp-note bad">Удирдагч клубээсээ гарах боломжгүй.</p>}
          {sp.err && <p className="cp-note bad">{String(sp.err).slice(0, 300)}</p>}
          <p className="cp-about">{c.about}</p>
          {info.length > 0 && (
            <div className="cp-info">
              {info.map(([ic, k, v]) => (
                <div key={k}><img className="ic" src={`/icons/${ic}.svg`} width={16} height={16} alt="" /><span><small>{k}</small><b>{v}</b></span></div>
              ))}
            </div>
          )}
          {c.rules && (
            <details className="cp-rules"><summary>Клубийн дүрэм</summary><p>{c.rules}</p></details>
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
              {isLeader && (offerTo ? (
                <div className="cp-lead">
                  <span>«<b>{offerTo.initial}.{offerTo.first_name}</b>»-д удирдагчийн эрх шилжүүлэх санал илгээсэн. Зөвшөөрмөгц эрх шилжиж, та удирдах зөвлөлийн гишүүн болно.</span>
                  <form action={cancelLeadOffer}><input type="hidden" name="club_id" value={id} /><button type="submit" className="cp-btn sm ghost">Цуцлах</button></form>
                </div>
              ) : [...board, ...rest].length > 0 && (
                <form action={offerLead} className="cp-lead">
                  <input type="hidden" name="club_id" value={id} />
                  <span>Шинэ удирдагч сонгогдсон уу?</span>
                  <div className="pf-select"><select name="user_id" required defaultValue="">
                    <option value="" disabled>Гишүүн сонгох</option>
                    {board.map((m) => <option key={m.id} value={m.id}>{m.initial}.{m.first_name} · зөвлөл</option>)}
                    {rest.map((m) => <option key={m.id} value={m.id}>{m.initial}.{m.first_name}</option>)}
                  </select><img src="/icons/chev16.svg" width={16} height={16} alt="" /></div>
                  <button type="submit" className="cp-btn sm">Удирдагчийн эрх шилжүүлэх</button>
                </form>
              ))}
            </div>
          )}
          <div className="cp-sec">
            <h3>Удирдах зөвлөл <small>{board.length} / {BOARD_MAX}</small></h3>
            {board.length ? <div className="cp-grid">{board.map((m) => <Member key={m.id} m={m} viewer={user} following={following} />)}</div> : <p className="muted">Одоохондоо зөвлөлийн гишүүн алга.</p>}
          </div>
        </section>

        {isLeader && (
          <p className="cp-admin"><img className="ic" src="/icons/f_shield.svg" width={18} height={18} alt="" /><span><b>Админ харагдац</b>Энэ хэсгийг зөвхөн клубийн удирдагч харна. Та гишүүдийн хүсэлтийг шийдвэрлэж, удирдах зөвлөлөө өөрчилнө.</span></p>
        )}
        <nav className="cp-tabs" aria-label="Клубийн хэсгүүд">
          <Link href={`/club/${id}`} className={tab === "members" ? "on" : ""} scroll={false}>Гишүүд <em>{members.length}</em></Link>
          <Link href={`/club/${id}/chat`}>
            <img className="ic" src="/icons/comment18.svg" width={14} height={14} alt="" />Чат{unreadChat > 0 && <em className="hot">{unreadChat > 99 ? "99+" : unreadChat}</em>}
          </Link>
          <Link href={`/club/${id}?tab=tasks`} className={tab === "tasks" ? "on" : ""} scroll={false}>Даалгавар <em>{tasks.length}</em></Link>
          <Link href={`/club/${id}?tab=reports`} className={tab === "reports" ? "on" : ""} scroll={false}>Тайлан <em>{reports.length}</em></Link>
          {isLeader && <Link href={`/club/${id}?tab=requests`} className={tab === "requests" ? "on" : ""} scroll={false}>Хүсэлт <em className={requests.length ? "hot" : ""}>{requests.length}</em></Link>}
        </nav>
        <ScrollActive selector=".cp-tabs a.on" dep={tab} />

        {tab === "tasks" ? (
          <section className="cp-card cp-list">
            {isLeader && <div className="cp-req-head"><h2>Клубийн даалгаврууд</h2><Link href="/tasks/new" className="cp-btn sm">+ Даалгавар нэмэх</Link></div>}
            {tasks.length ? <div className="tk-grid">{tasks.map((t) => <TaskCard key={t.id} t={t} />)}</div>
              : <p className="muted">{isLeader ? "Клубийнхаа хийж үзсэн туршилт, эвент, воркшопыг даалгавар болгон хуваалцаарай." : "Энэ клуб одоохондоо даалгавар нэмээгүй байна."}</p>}
          </section>
        ) : tab === "reports" ? (
          <section className="cp-card cp-list">
            {isLeader && <div className="cp-req-head"><h2>Клубийн тайлангууд</h2><Link href="/reports/new" className="cp-btn sm">+ Тайлан нэмэх</Link></div>}
            {reports.length ? <div className="tk-grid">{reports.map((r) => <ReportCard key={r.id} r={r} />)}</div>
              : <p className="muted">{isLeader ? "Даалгавраас нэгийг клубтэйгээ хийгээд тайлангаа бичээрэй. Батлагдмагц клуб тань оч авна." : "Энэ клуб одоохондоо тайлан бичээгүй байна."}</p>}
          </section>
        ) : tab === "members" ? (
          <section className="cp-card cp-list">
            {rest.length ? <div className="cp-grid">{rest.map((m) => <Member key={m.id} m={m} viewer={user} following={following} clubId={id} canRemove={isLeader} />)}</div>
              : <p className="muted">Энгийн гишүүн одоохондоо алга. Анхны гишүүн нь болоорой!</p>}
          </section>
        ) : (
          <section className="cp-card cp-list">
            <div className="cp-req-head">
              <h2>Нэгдэх хүсэлтүүд {requests.length > 0 && <em>{requests.length} хүлээгдэж буй</em>}</h2>
              {requests.length > 1 && (
                <form action={decideRequests}><input type="hidden" name="club_id" value={id} /><input type="hidden" name="decision" value="all" />
                  <button type="submit" className="cp-btn sm ghost">Бүгдийг зөвшөөрөх</button></form>
              )}
            </div>
            {sp.skipped && <p className="cp-note warn" style={{ margin: "0 0 12px" }}>{sp.skipped} хүсэлтийг одоогоор зөвшөөрөх боломжгүй байсан (1 сарын хориг эсвэл өөр клубийн удирдагч).</p>}
            {requests.length === 0 && <p className="muted">Шинэ хүсэлт алга.</p>}
            {requests.map((r) => {
              const until = r.moved_at ? new Date(new Date(r.moved_at).setMonth(new Date(r.moved_at).getMonth() + 1)) : null;
              const banned = until && until > new Date();
              return (
                <div key={r.id} className="cp-reqrow">
                  <Member m={r} viewer={user} following={following} />
                  <div className="cp-req-why">
                    <small>Нэгдэх шалтгаан</small>
                    <p>{r.reason || "—"}</p>
                    {banned ? <em className="bad">1 сарын дотор шилжсэн · {ymd(until)} хүртэл хориотой</em>
                      : r.other ? <em className="warn">{r.other} клубийн гишүүн · зөвшөөрвөл {r.other}-аас хасагдаж, анхны клубийн оч нь хасагдана</em> : null}
                  </div>
                  <small className="cp-req-date">{ymd(r.created_at)}</small>
                  <form action={decideRequests}><input type="hidden" name="club_id" value={id} /><input type="hidden" name="user_id" value={r.id} /><input type="hidden" name="decision" value="no" />
                    <button type="submit" className="cp-btn sm ghost danger">Татгалзах</button></form>
                  <form action={decideRequests}><input type="hidden" name="club_id" value={id} /><input type="hidden" name="user_id" value={r.id} /><input type="hidden" name="decision" value="ok" />
                    <button type="submit" className="cp-btn sm" disabled={banned}>Зөвшөөрөх</button></form>
                </div>
              );
            })}
          </section>
        )}
      </div>
    </Shell>
  );
}
