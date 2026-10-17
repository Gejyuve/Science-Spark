import Link from "next/link";
import { redirect } from "next/navigation";
import { sql, ensureSchema } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { NOTIFY_TEXT } from "@/lib/notify";
import { markAllRead } from "../posts/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Мэдэгдэл · Science Spark" };

export default async function NotificationsPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  await ensureSchema();
  const items = await sql`
    SELECT n.id, n.kind, n.note, n.read_at, n.created_at, n.post_id, n.actor_id,
           a.initial, a.first_name, p.title
    FROM notifications n
    LEFT JOIN users a ON a.id = n.actor_id
    LEFT JOIN posts p ON p.id = n.post_id
    WHERE n.user_id = ${user.id}
    ORDER BY n.created_at DESC LIMIT 100`;
  const unread = items.filter((n) => !n.read_at).length;

  return (
    <div className="auth-wrap top">
      <div className="auth-card wide">
        <p className="muted"><Link href="/">← Нүүр</Link></p>
        <h1>Мэдэгдэл</h1>
        {unread > 0 && (
          <form action={markAllRead}>
            <button className="btn ghost" type="submit">Бүгдийг уншсан болгох ({unread})</button>
          </form>
        )}
        {items.length === 0 && <p className="muted">Мэдэгдэл алга.</p>}
        {items.map((n) => (
          <div key={n.id} className={"notif" + (n.read_at ? "" : " unread")}>
            {n.actor_id ? (
              <Link href={`/u/${n.actor_id}`}>{n.initial}.{n.first_name}</Link>
            ) : (
              <span>Хэн нэгэн</span>
            )}{" "}
            {NOTIFY_TEXT[n.kind] || n.kind}
            {n.post_id && n.title && (
              <>: <Link href={`/post/${n.post_id}`}>{n.title}</Link></>
            )}
            {n.note && <div className="muted">“{n.note}”</div>}
            <div className="muted">{fmtDate(n.created_at)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
