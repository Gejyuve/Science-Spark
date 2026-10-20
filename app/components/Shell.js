import Link from "next/link";
import { redirect } from "next/navigation";
import ThemeToggle from "./ThemeToggle";
import ProfileAction from "./ProfileAction";
import { DrawerHost, DrawerClose } from "./Drawer";
import Composer from "./Composer";
import { actingAs } from "@/lib/acting";
import { switchAs } from "../clubs/actions";
import TopNav, { NavRow } from "./TopNav";
import { logout } from "../auth/actions";
import { markAllRead } from "../posts/actions";
import NotifMenu from "./NotifMenu";
import { NotifList } from "./Notif";
import { sql } from "@/lib/db";
import { displayName, needsName, isStaff, isAdmin, isSuperAdmin, isPremium } from "@/lib/auth";
import { unreadCount, listNotifications } from "@/lib/notify";
import { levelFor } from "@/lib/levels";
import { walletBalance } from "@/lib/money";
import { Avatar, Stat, Person, NameBadges, followingSet } from "./Bits";
import { ClubPerson, ClubAv } from "./ClubBits";
import { hotClubs, clubFollowSet, membershipOf } from "@/lib/clubs";
import { chatUnread } from "@/lib/chat";
import { NAV } from "./navItems";
import { loadSettings } from "@/lib/settings";

const I = (name, size = 22, alt = "") => (
  <img className={/^(flame|chev|logo)$/.test(name) ? "" : "ic"} src={`/icons/${name}.svg`} width={size} height={size} alt={alt} />
);

// Редакцийн товч зүүн цэсний доод хэсэгт: редакцийн админд «Хянах», супер админд «Админ» (бүх эрх)
async function StaffNav({ user, active }) {
  if (!isStaff(user)) return null;
  const pending = await sql`SELECT COUNT(*)::int AS n FROM posts WHERE status = 'pending' AND author_id <> ${user.id}`
    .then((r) => r[0].n)
    .catch(() => 0);
  const badge = pending > 0 && <em className="ss-badge red">{pending > 99 ? "99+" : pending}</em>;
  return (
    <nav className="ss-nav ss-staff" aria-label="Редакц">
      <span className="ss-staff-t">Редакц</span>
      {isSuperAdmin(user) ? (
        <Link href="/admin" className={"ss-nav-item" + (active === "/admin" ? " on" : "")}>{I("crown", 24)}<span>Админ</span>{badge}</Link>
      ) : (
        <Link href="/admin/content" className={"ss-nav-item" + (active === "/admin" ? " on" : "")}>{I("shield", 24)}<span>Хянах</span>{badge}</Link>
      )}
    </nav>
  );
}

function Sidebar({ user, active }) {
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
      <StaffNav user={user} active={active} />
      <div className="ss-grow" />
      <ThemeToggle />
    </aside>
  );
}

async function Header({ user, compact, compose, composeError, active, acting }) {
  // Асуултад шагнал тавихад хэтэвчний үлдэгдлийг харуулна
  const wallet = user && !compact ? await walletBalance(user.id).catch(() => 0) : 0;
  // Баруун цэсээр клуб, байгууллагын хаяг руу шилжсэн бол бичих самбар тэдний нэрээр нийтэлнэ
  const ent = acting?.entity;
  const write = (kind) => (user ? `/write${kind ? `?kind=${encodeURIComponent(kind)}` : ""}` : "/login");
  return (
    <header className={"ss-header" + (compact ? " compact" : "")}>
      <NavRow active={active} menu me={user ? <Avatar user={user} size={34} /> : <img src="/icons/flamew.svg" width={20} height={20} alt="" />} />
      {!compact && <Composer loggedIn={!!user} me={user ? <Avatar user={user} size={32} /> : null} initial={compose} error={composeError} wallet={wallet}
        as={acting?.as || null} club={ent ? { name: ent.name } : null} clubAv={ent ? <ClubAv c={ent} size={32} /> : null} />}
    </header>
  );
}

// «Асаж буй оч», «Гялбаж буй клубүүд» бүх хэрэглэгчид ижил тул сервер дээр 1 минут хадгална
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

// Удирддаг клуб, байгууллагын хаяг руу шилжих товч (баруун цэс)
function AsSwitch({ user, acting }) {
  const { club, org, as, entity } = acting;
  if (!club && !org) return null;
  const go = (to, body, cls = "") => (
    <form action={switchAs} key={to}>
      <input type="hidden" name="to" value={to} />
      <button type="submit" className={"ss-action ss-as-btn" + cls}>{body}</button>
    </form>
  );
  return (
    <div className="ss-as-box">
      {entity && (
        <p className="ss-as-now">
          <ClubAv c={entity} size={22} />
          <span><b>{entity.name}</b><small>{as === "org" ? "Байгууллагын" : "Клубийн"} нэрээр бичиж байна</small></span>
        </p>
      )}
      {entity && go("me", <><Avatar user={user} size={22} /><span><b>{displayName(user)}</b><small>Өөрийн хаяг руу буцах</small></span>{I("arrow", 14)}</>)}
      {[["club", club], ["org", org]].filter(([k, c]) => c && k !== as).map(([k, c]) =>
        go(k, <><ClubAv c={c} size={22} /><span><b>{c.name}</b><small>{k === "org" ? "Байгууллагын" : "Клубийн"} хаяг руу шилжих</small></span>{I("arrow", 14)}</>)
      )}
    </div>
  );
}

async function RightRail({ user, acting }) {
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
              <span className="ss-person-line"><b>{displayName(user)}</b><NameBadges points={user.points} supporter={isPremium(user)} seed={user.id} /></span>
              <Stat points={user.points} followers={followers} link={false} />
            </div>
          </Link>
          <div className="ss-actions">
            <AsSwitch user={user} acting={acting} />
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
              <Link href={`/club/${myClub.club_id}/chat`} className="ss-action" title={`${myClub.name} · Клубийн чат`}>
                {I("comment18", 18)}<span>Клубийн чат</span>{chatNew > 0 && <em className="ss-badge teal">{chatNew > 99 ? "99+" : chatNew}</em>}{I("arrow", 14)}
              </Link>
            )}
            <Link href="/wallet" className="ss-action">
              {I("wallet", 18)}<span>Хэтэвч</span>
              {I("arrow", 14)}
            </Link>
            <form action={logout}>
              <button type="submit" className="ss-action ss-logout">
                <img src="/icons/logout.svg" width={18} height={18} alt="" /><span>Гарах</span>
              </button>
            </form>
          </div>
        </div>
      ) : (
        <Link href="/login" className="ss-cta">
          {I("flame", 32)}
          <span>Асаах</span>
          {I("chev", 14)}
        </Link>
      )}

      <div className="ss-panel">
        <Link href="/san#board" className="ss-panel-title orange ss-panel-link">🔥 Асаж буй оч</Link>
        {top.length === 0 && <p className="muted">Одоохондоо оч цуглуулсан хүн алга.</p>}
        {top.map((t) => (
          <Person key={t.id} id={t.id} initial={t.initial} first_name={t.first_name} avatar={t.avatar} points={t.points} followers={t.followers} viewer={user} following={following} />
        ))}
      </div>

      <div className="ss-panel">
        <Link href="/clubs" className="ss-panel-title red cl-rail-title"><img src="/icons/clubstar.svg" width={20} height={20} alt="" />Гялбаж буй клубүүд</Link>
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
  const site = await loadSettings();
  // Засвар үйлчилгээний горим: редакцаас бусдад мэдэгдэл л харагдана
  if (site.maintenance && !isStaff(user)) {
    children = (
      <section className="ss-maint">
        <img src="/icons/logo.svg" width={64} height={64} alt="" />
        <h1>Сайт түр засвартай байна</h1>
        <p>Бид сайтыг илүү сайжруулж байна. Удахгүй эргэн уулзъя ✦</p>
        {!user && <a href="/login" className="ss-maint-login">Редакц нэвтрэх</a>}
      </section>
    );
  }
  const acting = await actingAs(user);
  return (
    <div className="ss-shell">
      <Sidebar user={user} active={active} />
      <main className="ss-main">
        {header === true ? (
          <Header user={user} compose={compose} composeError={composeError} active={active} acting={acting} />
        ) : (
          <header className="ss-header compact static"><NavRow active={active} menu me={user ? <Avatar user={user} size={34} /> : <img src="/icons/flamew.svg" width={20} height={20} alt="" />} /></header>
        )}
        {site.announcement && <p className="ss-announce">{site.announcement}</p>}
        {site.maintenance && isStaff(user) && <p className="ss-announce warn">Засвар үйлчилгээний горим асаалттай: зөвхөн редакц сайтыг харж байна.</p>}
        {children}
      </main>
      <RightRail user={user} acting={acting} />
      <DrawerHost />
    </div>
  );
}
