import Link from "next/link";
import { redirect } from "next/navigation";
import ThemeToggle from "./ThemeToggle";
import ProfileAction from "./ProfileAction";
import { DrawerHost, DrawerClose } from "./Drawer";
import Composer from "./Composer";
import TopNav, { NavRow } from "./TopNav";
import { logout } from "../auth/actions";
import { markAllRead } from "../posts/actions";
import NotifMenu from "./NotifMenu";
import { NotifList } from "./Notif";
import { sql } from "@/lib/db";
import { displayName, isAdmin, needsName, canReview, canEnterReview } from "@/lib/auth";
import { unreadCount, listNotifications } from "@/lib/notify";
import { levelFor } from "@/lib/levels";
import { Avatar, Stat, Person, followingSet } from "./Bits";
import { ClubPerson } from "./ClubBits";
import { hotClubs, clubFollowSet, membershipOf } from "@/lib/clubs";
import { chatUnread } from "@/lib/chat";
import { NAV } from "./navItems";

const I = (name, size = 22, alt = "") => (
  <img className={/^(flame|chev|logo)$/.test(name) ? "" : "ic"} src={`/icons/${name}.svg`} width={size} height={size} alt={alt} />
);

function Sidebar({ active }) {
  return (
    <aside className="ss-side">
      <div className="ss-dhead"><Link href="/" className="ss-dlogo"><img src="/icons/logo.svg" width={40} height={40} alt="Science Spark" /></Link><span className="ss-grow" /><ThemeToggle /><DrawerClose /></div>
      <form action="/search" method="get" className="ss-search">
        {I("search", 18)}
        <input name="q" placeholder="Хайх" aria-label="Хайх" />
      </form>
      <nav className="ss-nav">
        {NAV.map((n) =>
          n.href ? (
            <Link key={n.label} href={n.href} className={"ss-nav-item" + (active === n.href ? " on" : "")}>
              {I(n.icon, 24)}
              <span>{n.label}</span>
            </Link>
          ) : (
            <span key={n.label} className="ss-nav-item soon" title="Тун удахгүй">
              {I(n.icon, 24)}
              <span>{n.label}</span>
            </span>
          )
        )}
        <span className="ss-projects soon" title="Тун удахгүй">
          <span className="emoji">🔥💯</span>
          <span>Төслүүд</span>
        </span>
        <span className="ss-nav-item soon" title="Тун удахгүй">
          {I("help", 22)}
          <span>Тусламж</span>
        </span>
      </nav>
      <div className="ss-grow" />
      <ThemeToggle />
    </aside>
  );
}

function Header({ user, compact, compose, composeError, active }) {
  const write = (kind) => (user ? `/write${kind ? `?kind=${encodeURIComponent(kind)}` : ""}` : "/login");
  return (
    <header className={"ss-header" + (compact ? " compact" : "")}>
      <NavRow active={active} menu me={user ? <Avatar user={user} size={34} /> : <img src="/icons/flamew.svg" width={20} height={20} alt="" />} />
      {!compact && <Composer loggedIn={!!user} me={user ? <Avatar user={user} size={32} /> : null} initial={compose} error={composeError} />}
    </header>
  );
}

// «Асаж буй оч», «Гялбаж буй клубууд» бүх хэрэглэгчид ижил тул сервер дээр 1 минут хадгална
const RAIL_TTL = 60000;
let railCache = { at: 0, data: null };
async function railLists() {
  if (railCache.data && Date.now() - railCache.at < RAIL_TTL) return railCache.data;
  const [top, clubs] = await Promise.all([
    sql`
      SELECT u.id, u.initial, u.first_name, u.avatar_id AS avatar, SUM(l.delta)::int AS points,
             (SELECT COUNT(*) FROM follows f WHERE f.followee_id = u.id)::int AS followers
      FROM points_ledger l JOIN users u ON u.id = l.user_id
      GROUP BY u.id HAVING SUM(l.delta) > 0
      ORDER BY points DESC LIMIT 5`,
    hotClubs(5).catch(() => []),
  ]);
  railCache = { at: Date.now(), data: { top, clubs } };
  return railCache.data;
}

async function RightRail({ user }) {
  const none = (v) => () => v;
  // Бие биеэсээ хамааралгүй асуулгуудыг зэрэг явуулна
  const [lists, following, clubFollows, followers, unread, notifs, chat] = await Promise.all([
    railLists().catch(none({ top: [], clubs: [] })),
    followingSet(user),
    clubFollowSet(user),
    user ? sql`SELECT COUNT(*)::int AS n FROM follows WHERE followee_id = ${user.id}`.then((r) => r[0].n).catch(none(0)) : 0,
    user ? unreadCount(user.id) : 0,
    user ? listNotifications(user.id, { limit: 8 }).catch(none([])) : [],
    user
      ? membershipOf(user.id)
          .then(async (myClub) => ({ myClub, chatNew: myClub ? await chatUnread(user.id, myClub.club_id) : 0 }))
          .catch(none({ myClub: null, chatNew: 0 }))
      : { myClub: null, chatNew: 0 },
  ]);
  const { top, clubs } = lists;
  const { myClub, chatNew } = chat;

  return (
    <aside className="ss-right">
      <div className="ss-dhead right"><span className="ss-grow" /><DrawerClose /></div>
      {user ? (
        <div className="ss-panel">
          <Link href={`/u/${user.id}`} className="ss-person big">
            <Avatar user={user} size={40} />
            <div>
              <b>{displayName(user)}</b>
              <Stat points={user.points} followers={followers} link={false} />
            </div>
          </Link>
          <div className="ss-actions">
            <ProfileAction id={user.id} />
            <NotifMenu trigger={<>{I("bell", 18)}<span>Мэдэгдэл</span>{unread > 0 && <em className="ss-badge red">{unread}</em>}{I("arrow", 14)}</>}>
              <div className="nf-head">
                <b>Мэдэгдэл</b>{unread > 0 && <em className="ss-badge red">{unread}</em>}
                <span className="ss-grow" />
                {unread > 0 && (
                  <form action={markAllRead}><button type="submit" className="nf-readall">✓ Бүгдийг уншсан</button></form>
                )}
              </div>
              <NotifList items={notifs} empty="Одоохондоо мэдэгдэл алга." />
              <Link href="/notifications" className="nf-all">Бүх мэдэгдлийг харах</Link>
            </NotifMenu>
            {myClub && (
              <Link href={`/club/${myClub.club_id}/chat`} className="ss-action" title={`${myClub.name} · Клубын чат`}>
                {I("comment18", 18)}<span>Клубын чат</span>{chatNew > 0 && <em className="ss-badge teal">{chatNew > 99 ? "99+" : chatNew}</em>}{I("arrow", 14)}
              </Link>
            )}
            <Link href={`/u/${user.id}`} className="ss-action">
              {I("wallet", 18)}<span>Данс</span>
              {I("arrow", 14)}
            </Link>
            {canEnterReview(user) && (
              <Link href={canReview(user) ? "/review" : "/review?t=events"} className="ss-action">
                {I("shield", 18)}<span>Хянах</span>
                {I("arrow", 14)}
              </Link>
            )}
            {isAdmin(user) && (
              <Link href="/admin" className="ss-action">{I("crown", 18)}<span>Админ</span>{I("arrow", 14)}</Link>
            )}
            <form action={logout}>
              <button type="submit" className="ss-action ss-logout">
                <img src="/icons/logout.svg" width={18} height={18} alt="" /><span>Гарах</span>
              </button>
            </form>
          </div>
        </div>
      ) : (
        <Link href="/register" className="ss-cta">
          {I("flame", 32)}
          <span>Асаах</span>
          {I("chev", 14)}
        </Link>
      )}

      <div className="ss-panel">
        <Link href="/och" className="ss-panel-title orange ss-panel-link">🔥 Асаж буй оч</Link>
        {top.length === 0 && <p className="muted">Одоохондоо оч цуглуулсан хүн алга.</p>}
        {top.map((t) => (
          <Person key={t.id} id={t.id} initial={t.initial} first_name={t.first_name} avatar={t.avatar} points={t.points} followers={t.followers} viewer={user} following={following} />
        ))}
      </div>

      <div className="ss-panel">
        <Link href="/clubs" className="ss-panel-title red cl-rail-title"><img src="/icons/clubstar.svg" width={20} height={20} alt="" />Гялбаж буй клубууд</Link>
        {clubs.length === 0 && <p className="muted">Одоохондоо бүртгэлтэй клуб алга.</p>}
        {clubs.map((t) => (
          <ClubPerson key={t.id} c={t} viewer={user} follows={clubFollows} />
        ))}
      </div>
    </aside>
  );
}

export default async function Shell({ user, active, children, header = true, compose, composeError }) {
  if (needsName(user)) redirect("/profile/edit");
  return (
    <div className="ss-shell">
      <Sidebar active={active} />
      <main className="ss-main">
        {header === true ? (
          <Header user={user} compose={compose} composeError={composeError} active={active} />
        ) : (
          <header className="ss-header compact static"><NavRow active={active} menu me={user ? <Avatar user={user} size={34} /> : <img src="/icons/flamew.svg" width={20} height={20} alt="" />} /></header>
        )}
        {children}
      </main>
      <RightRail user={user} />
      <DrawerHost />
    </div>
  );
}
