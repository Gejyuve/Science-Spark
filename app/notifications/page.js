import Link from "next/link";
import { redirect } from "next/navigation";
import { ensureSchema } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { listNotifications, unreadCount, NOTIF_TABS } from "@/lib/notify";
import { markAllRead } from "../posts/actions";
import Shell from "../components/Shell";
import { NotifList } from "../components/Notif";

export const dynamic = "force-dynamic";
export const metadata = { title: "Мэдэгдэл · Science Spark" };

const PAGE = 30;

// Figma 789:693 · Мэдэгдэл · Бүх мэдэгдэл
export default async function NotificationsPage({ searchParams }) {
  const user = await getUser();
  if (!user) redirect("/login");
  await ensureSchema();
  const sp = await searchParams;
  const tab = NOTIF_TABS.some(([k]) => k === sp.t) ? sp.t : "";
  const before = Number(sp.before) || null;
  const items = await listNotifications(user.id, { tab, before, limit: PAGE + 1 });
  const more = items.length > PAGE;
  const list = items.slice(0, PAGE);
  const unread = await unreadCount(user.id);
  const q = (o) => "/notifications?" + new URLSearchParams(Object.entries({ t: tab, ...o }).filter(([, v]) => v));
  return (
    <Shell user={user} header="nav">
      <div className="ss-card nf-page">
        <div className="nf-head">
          <b>Мэдэгдэл</b>{unread > 0 && <em className="ss-badge red">{unread}</em>}
          <span className="ss-grow" />
          {unread > 0 && <form action={markAllRead}><button type="submit" className="nf-readall">✓ Бүгдийг уншсан</button></form>}
          <Link href="/" className="nf-x" aria-label="Хаах">×</Link>
        </div>
        <div className="nf-tabs">
          {NOTIF_TABS.map(([k, l]) => (
            <Link key={k || "all"} href={q({ t: k })} className={tab === k ? "on" : ""}>
              {l}{k === "unread" && unread > 0 && <em>{unread}</em>}
            </Link>
          ))}
        </div>
        <NotifList items={list} empty={tab === "unread" ? "Уншаагүй мэдэгдэл алга ✓" : "Мэдэгдэл алга."} />
        {before && !more && list.length > 0 && <p className="nf-end">Бүх мэдэгдлийг үзлээ.</p>}
        {more && <Link href={q({ before: list[list.length - 1].id })} className="nf-all">Өмнөх мэдэгдлүүдийг үзэх</Link>}
      </div>
    </Shell>
  );
}
