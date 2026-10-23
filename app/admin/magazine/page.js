import Link from "next/link";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { requireSection } from "@/lib/admin";
import { loadSettings } from "@/lib/settings";
import { courierOn } from "@/lib/magazine";
import { ISSUE_STATUS, ORDER_STATUS, REQUEST_STATUS, REQUEST_KIND } from "@/lib/magazine-shared";
import { fmtMnt } from "@/lib/money";
import Head, { Chip, Flash, Stat, who } from "../_c/Head";
import { phoneFmt } from "../../magazine/Bits";
import { setMagazinePublic, orderAction, requestAction } from "./actions";
import NewIssue from "./NewIssue";

const n = (x) => Number(x || 0).toLocaleString("en-US");
const when = (d) => new Date(d).toLocaleString("sv-SE", { timeZone: "Asia/Ulaanbaatar" }).slice(0, 16).replaceAll("-", ".");

// Админ > Сэтгүүл: дугаарууд, биет хувийн захиалга, байршуулах хүсэлт, нийтэд нээх. Зөвхөн супер админ.
export default async function AdminMagazine({ searchParams }) {
  const user = await requireSection("magazine");
  if (user.role !== "superadmin") redirect("/admin");
  const { tab = "", ok, error, st = "" } = await searchParams;
  const settings = await loadSettings();
  const [c] = await sql`SELECT (SELECT COUNT(*) FROM magazine_orders WHERE status = 'paid')::int AS orders,
                               (SELECT COUNT(*) FROM magazine_requests WHERE status = 'new')::int AS requests`;
  const tabs = [["", "Дугаарууд"], ["orders", "Захиалга", c.orders || null], ["requests", "Хүсэлт", c.requests || null]];

  return (
    <>
      <Head user={user} title="Сэтгүүл" sub="Дугаар нэмэх, PDF оруулах, онлайн унших үнэ, биет хувийн захиалга, нийтлэл, баннер байршуулах хүсэлт." />
      <Flash ok={ok} error={error} />

      <section className={"adm-card vd-pub" + (settings.magazinePublic ? " on" : "")}>
        <span className="vd-pub-dot" aria-hidden="true" />
        <div>
          <b>{settings.magazinePublic ? "Сэтгүүл хэсэг бүх хэрэглэгчид нээлттэй" : "Сэтгүүл хэсэг одоогоор зөвхөн танд харагдаж байна"}</b>
          <p className="adm-muted">{settings.magazinePublic ? "Зүүн цэсэнд «Сэтгүүл» харагдана. Шинэ дугаар нийтлэхэд бүх хэрэглэгчид мэдэгдэл очно." : "Бэлэн болмогц нээгээрэй. Нээхэд зүүн цэсэнд «Сэтгүүл» гарч, хэрэглэгчид уншиж, захиалж эхэлнэ."}</p>
        </div>
        <span className="ss-grow" />
        <Link href="/magazine" className="adm-btn">Сайт дээр харах</Link>
        <form action={setMagazinePublic}>
          <input type="hidden" name="on" value={settings.magazinePublic ? "0" : "1"} />
          <button className={"adm-btn " + (settings.magazinePublic ? "danger" : "teal")}>{settings.magazinePublic ? "Нийтээс хаах" : "Нийтэд нээх"}</button>
        </form>
      </section>

      <nav className="vd-tabs" aria-label="Сэтгүүл">
        {tabs.map(([k, label, badge]) => <Link key={k} href={k ? `/admin/magazine?tab=${k}` : "/admin/magazine"} className={tab === k ? "on" : ""}>{label}{badge && <em className="mz-badge">{badge}</em>}</Link>)}
      </nav>

      {tab === "orders" ? <Orders st={st} /> : tab === "requests" ? <Requests st={st} /> : <Issues />}
    </>
  );
}

async function Issues() {
  const [rows, [s]] = await Promise.all([
    sql`SELECT i.*,
          (SELECT COUNT(*) FROM magazine_unlocks u WHERE u.issue_id = i.id)::int AS buyers,
          (SELECT COALESCE(SUM(paid_mnt), 0) FROM magazine_unlocks u WHERE u.issue_id = i.id)::int AS online,
          (SELECT COALESCE(SUM(qty), 0) FROM magazine_orders o WHERE o.issue_id = i.id AND o.status <> 'cancelled')::int AS copies
        FROM magazine_issues i ORDER BY i.number DESC, i.id DESC`,
    sql`SELECT (SELECT COUNT(*) FROM magazine_unlocks)::int AS buyers,
               (SELECT COALESCE(SUM(paid_mnt), 0) FROM magazine_unlocks)::int AS online,
               (SELECT COALESCE(SUM(qty), 0) FROM magazine_orders WHERE status <> 'cancelled')::int AS copies,
               (SELECT COALESCE(SUM(total), 0) FROM magazine_orders WHERE status <> 'cancelled')::int AS print,
               (SELECT COUNT(*) FROM magazine_requests)::int AS requests`,
  ]);
  const next = (rows[0]?.number || 0) + 1;
  return (
    <>
      <div className="adm-stats">
        <Stat label="Дугаар" value={n(rows.length)} note={`${n(rows.filter((r) => r.status === "published").length)} нийтлэгдсэн`} />
        <Stat label="Онлайн уншигч" value={n(s.buyers)} note={`${fmtMnt(s.online)} орлого`} />
        <Stat label="Биет хувь" value={`${n(s.copies)} ширхэг`} note={`${fmtMnt(s.print)} (хүргэлттэй)`} />
        <Stat label="Байршуулах хүсэлт" value={n(s.requests)} />
      </div>
      <details className="adm-card mz-new" open={rows.length === 0}>
        <summary className="adm-card-head"><b>+ Шинэ дугаар нэмэх (PDF оруулах)</b></summary>
        <NewIssue next={next} />
      </details>
      <section className="adm-card flush">
        {rows.length === 0 ? (
          <p className="adm-empty">Одоогоор дугаар алга. Дээрээс анхны дугаараа PDF-тэй нь нэмээрэй.</p>
        ) : (
          <table className="adm-table">
            <thead><tr><th>Дугаар</th><th>Хуудас</th><th>Онлайн үнэ</th><th>Уншигч</th><th>Биет хувь</th><th>Төлөв</th><th></th></tr></thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id}>
                  <td><b>№{i.number}</b> · {i.title}</td>
                  <td>{i.pages || "—"}</td>
                  <td>{i.price_mnt ? fmtMnt(i.price_mnt) : "Үнэгүй"}</td>
                  <td>{n(i.buyers)} · {fmtMnt(i.online)}</td>
                  <td>{i.print_price ? `${n(i.copies)} ш · ${fmtMnt(i.print_price)}` : "Зарахгүй"}</td>
                  <td><Chip tone={ISSUE_STATUS[i.status]?.[1]}>{ISSUE_STATUS[i.status]?.[0] || i.status}</Chip></td>
                  <td className="adm-right"><Link href={`/admin/magazine/${i.id}`} className="adm-btn teal">{i.pages ? "Засах" : "📄 PDF оруулах"}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

const ORDER_TABS = [["", "Хүргэх"], ["sent", "Хүргэлтэд"], ["delivered", "Хүргэгдсэн"], ["cancelled", "Цуцалсан"]];

async function Orders({ st }) {
  const status = ORDER_STATUS[st] ? st : "paid";
  const rows = await sql`
    SELECT o.*, i.number, u.initial, u.first_name, u.email
    FROM magazine_orders o JOIN magazine_issues i ON i.id = o.issue_id LEFT JOIN users u ON u.id = o.user_id
    WHERE o.status = ${status} ORDER BY CASE WHEN ${status} = 'paid' THEN o.id END ASC, o.id DESC LIMIT 200`;
  return (
    <>
      <p className={"adm-flash " + (courierOn() ? "ok" : "warn")}>
        {courierOn()
          ? "Хүргэлтийн систем холбогдсон: захиалга бүр төлөгдмөгц шууд хүргэлтийн систем рүү илгээгдэнэ."
          : <>Хүргэлтийн систем холбогдоогүй тул захиалга энд л ирнэ, танд мэдэгдэл очно. Хүргэлтийн компанитай гэрээ хийсэн бол Vercel-д <code>DELIVERY_WEBHOOK_URL</code> (болон шаардлагатай бол <code>DELIVERY_WEBHOOK_TOKEN</code>) нэмж холбоно.</>}
      </p>
      <nav className="vd-tabs" aria-label="Захиалгын төлөв">
        {ORDER_TABS.map(([k, l]) => <Link key={k} href={`/admin/magazine?tab=orders${k ? `&st=${k}` : ""}`} className={(st || "") === k ? "on" : ""}>{l}</Link>)}
      </nav>
      {rows.length === 0 ? <section className="adm-card"><p className="adm-empty">Захиалга алга.</p></section> : (
        <div className="mz-list">
          {rows.map((o) => (
            <form key={o.id} action={orderAction} className="adm-card mz-order">
              <input type="hidden" name="oid" value={o.id} />
              <div className="mz-order-top">
                <b>№{o.id} · Сэтгүүл №{o.number} · {o.qty} хувь · {fmtMnt(o.total)}</b>
                <Chip tone={ORDER_STATUS[o.status]?.[1]}>{ORDER_STATUS[o.status]?.[0]}</Chip>
                <small>{when(o.created_at)} · захиалсан: {who(o)}</small>
              </div>
              <div className="mz-addr">
                <span><small>Хүлээн авагч</small><b>{o.name}</b><a href={`tel:${o.phone}`}>{phoneFmt(o.phone)}</a></span>
                <span><small>Хаяг</small><b>{[o.city, o.district].filter(Boolean).join(", ")}</b>{o.address}</span>
                {o.note && <span><small>Тайлбар</small>{o.note}</span>}
                {(o.courier_status || o.courier_ref) && <span><small>Хүргэлтийн систем</small>{o.courier_status === "sent" ? "Илгээсэн" : o.courier_status}{o.courier_ref ? ` · ${o.courier_ref}` : ""}</span>}
              </div>
              <div className="mz-order-acts">
                <input name="staff_note" defaultValue={o.staff_note || ""} maxLength={300} placeholder="Хэрэглэгчид харагдах тэмдэглэл (хүргэгчийн утас г.м.)" />
                {o.status === "paid" && <button className="adm-btn teal" name="act" value="sent">Хүргэлтэд өгсөн</button>}
                {(o.status === "paid" || o.status === "sent") && <button className="adm-btn teal" name="act" value="delivered">Хүргэгдсэн</button>}
                {courierOn() && o.status !== "cancelled" && o.status !== "delivered" && <button className="adm-btn" name="act" value="courier">Хүргэлтийн систем рүү илгээх</button>}
                <button className="adm-btn" name="act" value="note">Тэмдэглэл хадгалах</button>
                {(o.status === "paid" || o.status === "sent") && <button className="adm-btn danger" name="act" value="cancel">Цуцалж мөнгө буцаах</button>}
              </div>
            </form>
          ))}
        </div>
      )}
    </>
  );
}

const REQ_TABS = [["", "Шинэ"], ["accepted", "Хүлээн авсан"], ["done", "Нийтлэгдсэн"], ["declined", "Татгалзсан"]];

async function Requests({ st }) {
  const status = REQUEST_STATUS[st] ? st : "new";
  const rows = await sql`
    SELECT r.*, i.number, u.initial, u.first_name
    FROM magazine_requests r LEFT JOIN magazine_issues i ON i.id = r.issue_id LEFT JOIN users u ON u.id = r.user_id
    WHERE r.status = ${status} ORDER BY r.id DESC LIMIT 200`;
  return (
    <>
      <nav className="vd-tabs" aria-label="Хүсэлтийн төлөв">
        {REQ_TABS.map(([k, l]) => <Link key={k} href={`/admin/magazine?tab=requests${k ? `&st=${k}` : ""}`} className={(st || "") === k ? "on" : ""}>{l}</Link>)}
      </nav>
      {rows.length === 0 ? <section className="adm-card"><p className="adm-empty">Хүсэлт алга.</p></section> : (
        <div className="mz-list">
          {rows.map((r) => (
            <form key={r.id} action={requestAction} className="adm-card mz-order">
              <input type="hidden" name="rid" value={r.id} />
              <div className="mz-order-top">
                <b>{REQUEST_KIND[r.kind]}{r.size ? ` · ${r.size}` : ""} · {r.number ? `№${r.number} дугаарт` : "дараагийн дугаарт"}</b>
                <Chip tone={REQUEST_STATUS[r.status]?.[1]}>{REQUEST_STATUS[r.status]?.[0]}</Chip>
                <small>{when(r.created_at)} · {r.user_id ? <Link href={`/u/${r.user_id}`}>{who(r)}</Link> : "—"}</small>
              </div>
              <div className="mz-addr">
                <span><small>Холбогдох</small><b>{r.name}{r.org ? ` · ${r.org}` : ""}</b><a href={`tel:${r.phone}`}>{phoneFmt(r.phone)}</a>{r.email && <a href={`mailto:${r.email}`}>{r.email}</a>}</span>
              </div>
              <p className="mz-msg">{r.message}</p>
              <div className="mz-order-acts">
                <input name="reply" defaultValue={r.reply || ""} maxLength={1000} placeholder="Хариу (хэрэглэгчид харагдана): үнэ, хугацаа, нөхцөл" />
                {r.status !== "accepted" && r.status !== "done" && <button className="adm-btn teal" name="act" value="accept">Хүлээн авах</button>}
                {r.status !== "done" && <button className="adm-btn teal" name="act" value="done">Нийтлэгдсэн</button>}
                {r.status !== "declined" && r.status !== "done" && <button className="adm-btn danger" name="act" value="decline">Татгалзах</button>}
              </div>
            </form>
          ))}
        </div>
      )}
    </>
  );
}
