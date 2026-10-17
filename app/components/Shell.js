import Link from "next/link";
import { redirect } from "next/navigation";
import ThemeToggle from "./ThemeToggle";
import Composer from "./Composer";
import { sql } from "@/lib/db";
import { displayName, isStaff, needsName } from "@/lib/auth";
import { unreadCount } from "@/lib/notify";
import { levelFor } from "@/lib/levels";
import { Avatar, Stat } from "./Bits";

const I = (name, size = 22, alt = "") => (
  <img className={/^(flame|chev|logo)$/.test(name) ? "" : "ic"} src={`/icons/${name}.svg`} width={size} height={size} alt={alt} />
);

const NAV = [
  { icon: "feed", label: "Урсгал", href: "/" },
  { icon: "tree", label: "Мод" },
  { icon: "dict", label: "Толь" },
  { icon: "game", label: "Тоглоом" },
];

function Sidebar({ active }) {
  return (
    <aside className="ss-side">
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

function Header({ user, compact, compose, composeError }) {
  const write = (kind) => (user ? `/write${kind ? `?kind=${encodeURIComponent(kind)}` : ""}` : "/login");
  return (
    <header className={"ss-header" + (compact ? " compact" : "")}>
      <div className="ss-topnav">
        <span className="ss-round soon" title="Тун удахгүй">{I("hspark")}</span>
        <span className="ss-round soon" title="Тун удахгүй">{I("dice")}</span>
        <Link className="ss-round" href={user ? "/?compose=Асуулт" : "/login"} title="Асуух">{I("ask", 24)}</Link>
        <Link href="/" className="ss-logo" aria-label="Нүүр">
          <img src="/icons/logo.svg" width={74} height={74} alt="Science Spark" />
        </Link>
        <span className="ss-round soon" title="Тун удахгүй">{I("event", 24)}</span>
        <span className="ss-round soon" title="Тун удахгүй">{I("market")}</span>
        <span className="ss-round soon" title="Тун удахгүй">{I("club", 24)}</span>
      </div>
      {!compact && <Composer loggedIn={!!user} initial={compose} error={composeError} />}
    </header>
  );
}

async function RightRail({ user }) {
  let top = [];
  let followers = 0;
  let unread = 0;
  try {
    top = await sql`
      SELECT u.id, u.initial, u.first_name, SUM(l.delta)::int AS points,
             (SELECT COUNT(*) FROM follows f WHERE f.followee_id = u.id)::int AS followers
      FROM points_ledger l JOIN users u ON u.id = l.user_id
      GROUP BY u.id HAVING SUM(l.delta) > 0
      ORDER BY points DESC LIMIT 5`;
    if (user) {
      followers = (await sql`SELECT COUNT(*)::int AS n FROM follows WHERE followee_id = ${user.id}`)[0].n;
      unread = await unreadCount(user.id);
    }
  } catch (e) {}

  return (
    <aside className="ss-right">
      {user ? (
        <div className="ss-panel">
          <Link href={`/u/${user.id}`} className="ss-person big">
            <Avatar user={user} size={40} />
            <div>
              <b>{displayName(user)}</b>
              <Stat points={user.points} followers={followers} />
            </div>
          </Link>
          <div className="ss-actions">
            <Link href="/profile/edit" className="ss-action">{I("gear", 18)}<span>Тохиргоо</span>{I("arrow", 14)}</Link>
            <Link href="/notifications" className="ss-action">
              {I("bell", 18)}<span>Мэдэгдэл</span>
              {unread > 0 && <em className="ss-badge red">{unread}</em>}
              {I("arrow", 14)}
            </Link>
            <Link href={`/u/${user.id}`} className="ss-action">
              {I("wallet", 18)}<span>Данс</span>
              <em className="ss-badge teal">{user.points.toLocaleString("en-US")} оч</em>
              {I("arrow", 14)}
            </Link>
            {isStaff(user) && (
              <Link href="/review" className="ss-action">
                {I("shield", 18)}<span>Хянах</span>
                <em className="ss-badge gray">Түвшин {levelFor(user.points).n}</em>
                {I("arrow", 14)}
              </Link>
            )}
            {user.role === "superadmin" && (
              <Link href="/admin" className="ss-action">{I("shield", 18)}<span>Супер админ</span>{I("arrow", 14)}</Link>
            )}
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
        <p className="ss-panel-title orange">🔥 Асаж буй оч</p>
        {top.length === 0 && <p className="muted">Одоохондоо оч цуглуулсан хүн алга.</p>}
        {top.map((t) => (
          <Link key={t.id} href={`/u/${t.id}`} className="ss-person">
            <Avatar user={t} size={40} />
            <div>
              <b>{t.initial}.{t.first_name}</b>
              <Stat points={t.points} followers={t.followers} />
            </div>
          </Link>
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
        {header && <Header user={user} compact={header === "nav"} compose={compose} composeError={composeError} />}
        {children}
      </main>
      <RightRail user={user} />
    </div>
  );
}
