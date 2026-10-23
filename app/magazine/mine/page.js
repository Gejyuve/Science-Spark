import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { sql, ensureSchema } from "@/lib/db";
import { canSeeMagazine } from "@/lib/magazine";
import { ORDER_STATUS, REQUEST_STATUS, REQUEST_KIND } from "@/lib/magazine-shared";
import { fmtMnt } from "@/lib/money";
import Shell from "../../components/Shell";
import PageHero from "../../components/PageHero";
import { IssueCover, phoneFmt } from "../Bits";

export const dynamic = "force-dynamic";
export const metadata = { title: "Миний сэтгүүл · Science Spark" };

const when = (d) => new Date(d).toLocaleString("sv-SE", { timeZone: "Asia/Ulaanbaatar" }).slice(0, 16).replaceAll("-", ".");

// Миний сэтгүүл: худалдаж авсан дугаарууд, биет хувийн захиалга, байршуулах хүсэлтүүд
export default async function MyMagazine({ searchParams }) {
  const sp = await searchParams;
  const user = await getUser();
  if (!user) redirect("/login");
  if (!canSeeMagazine(user)) notFound();
  await ensureSchema();
  const [issues, orders, requests] = await Promise.all([
    sql`SELECT i.*, u.last_page FROM magazine_unlocks u JOIN magazine_issues i ON i.id = u.issue_id
        WHERE u.user_id = ${user.id} AND i.status = 'published' ORDER BY u.created_at DESC`,
    sql`SELECT o.*, i.number, i.title FROM magazine_orders o JOIN magazine_issues i ON i.id = o.issue_id
        WHERE o.user_id = ${user.id} ORDER BY o.id DESC LIMIT 50`,
    sql`SELECT r.*, i.number FROM magazine_requests r LEFT JOIN magazine_issues i ON i.id = r.issue_id
        WHERE r.user_id = ${user.id} ORDER BY r.id DESC LIMIT 50`,
  ]);
  return (
    <Shell user={user} active="/magazine" header={false}>
      <div className="mz-page">
        <PageHero tone="magazine" title="Миний сэтгүүл" text="Таны уншдаг дугаарууд, биет хувийн захиалга, сэтгүүлд байршуулах хүсэлтүүд.">
          <Link href="/magazine" className="ph-btn">Бүх дугаар</Link>
        </PageHero>
        {sp.ok && <p className="adm-flash ok">{sp.ok}</p>}

        <section className="vd-sec">
          <h2 className="vd-h">Уншдаг дугаарууд</h2>
          {issues.length === 0 ? (
            <p className="ss-card vd-empty">Та одоогоор дугаар худалдаж аваагүй байна. <Link href="/magazine">Дугаарууд</Link></p>
          ) : (
            <div className="mz-grid">
              {issues.map((i) => (
                <Link key={i.id} href={`/magazine/${i.id}#read`} className="mz-tile">
                  <IssueCover issue={i} />
                  <b>№{i.number} · {i.title}</b>
                  <small>{i.last_page > 1 ? `${i.last_page}/${i.pages} хуудас уншсан` : "Уншиж эхлээгүй"}</small>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="vd-sec" id="orders">
          <h2 className="vd-h">Биет хувийн захиалга</h2>
          {orders.length === 0 ? (
            <p className="ss-card vd-empty">Захиалга алга.</p>
          ) : (
            <div className="mz-list">
              {orders.map((o) => (
                <div key={o.id} className="ss-card mz-row">
                  <span className={"adm-pill " + (ORDER_STATUS[o.status]?.[1] || "")}>{ORDER_STATUS[o.status]?.[0] || o.status}</span>
                  <b>Захиалга №{o.id} · №{o.number} дугаар · {o.qty} хувь · {fmtMnt(o.total)}</b>
                  <small>{when(o.created_at)} · {o.name}, {phoneFmt(o.phone)} · {[o.city, o.district, o.address].filter(Boolean).join(", ")}</small>
                  {o.courier_ref && <small>Хүргэлтийн дугаар: {o.courier_ref}</small>}
                  {o.staff_note && <small className="mz-reply">Редакц: {o.staff_note}</small>}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="vd-sec" id="requests">
          <h2 className="vd-h">Байршуулах хүсэлтүүд</h2>
          {requests.length === 0 ? (
            <p className="ss-card vd-empty">Хүсэлт алга. <Link href="/magazine/request">Нийтлэл, зар байршуулах</Link></p>
          ) : (
            <div className="mz-list">
              {requests.map((r) => (
                <div key={r.id} className="ss-card mz-row">
                  <span className={"adm-pill " + (REQUEST_STATUS[r.status]?.[1] || "")}>{REQUEST_STATUS[r.status]?.[0] || r.status}</span>
                  <b>{REQUEST_KIND[r.kind]}{r.size ? ` · ${r.size}` : ""}{r.number ? ` · №${r.number} дугаар` : ""}</b>
                  <small>{when(r.created_at)}</small>
                  <p>{r.message}</p>
                  {r.reply && <small className="mz-reply">Редакц: {r.reply}</small>}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </Shell>
  );
}
