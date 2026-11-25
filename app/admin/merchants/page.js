import Link from "next/link";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { requireSection } from "@/lib/admin";
import { loadSettings } from "@/lib/settings";
import { MERCHANT_TYPES, MERCHANT_STATUS, merchantName } from "@/lib/merchant-shared";
import Head, { Chip, Flash, Stat } from "../_c/Head";
import { setMerchantOpen } from "./actions";

const when = (d) => (d ? new Date(d).toLocaleString("sv-SE", { timeZone: "Asia/Ulaanbaatar" }).slice(0, 16).replaceAll("-", ".") : "—");
// Шийдвэр хүлээж буйг эхэнд
const TABS = [["", "Шалгах"], ["bank", "Данс шалгах"], ["approved", "Баталгаажсан"], ["revision_required", "Засвар хүссэн"], ["draft", "Бөглөж байна"], ["suspended", "Түдгэлзүүлсэн"], ["rejected", "Татгалзсан"], ["terminated", "Дуусгавар болсон"]];

// Админ > Мерчант: бараа, тасалбар борлуулах хүсэлт шалгах, батлах, данс баталгаажуулах. Зөвхөн супер админ.
export default async function AdminMerchants({ searchParams }) {
  const user = await requireSection("merchants");
  if (user.role !== "superadmin") redirect("/admin");
  const { st = "", ok, error, q = "" } = await searchParams;
  const settings = await loadSettings();
  const like = `%${String(q).trim().toLowerCase()}%`;
  const [counts, [bankN], rows] = await Promise.all([
    sql`SELECT status, COUNT(*)::int AS n FROM merchants GROUP BY status`,
    sql`SELECT COUNT(DISTINCT b.merchant_id)::int AS n FROM merchant_bank_accounts b JOIN merchants m ON m.id = b.merchant_id
        WHERE b.status = 'pending' AND m.status IN ('approved', 'suspended')`,
    sql`SELECT m.*, i.parent_name, i.first_name AS ind_first, b.legal_name, u.initial, u.first_name, u.email,
          EXISTS (SELECT 1 FROM merchant_bank_accounts x WHERE x.merchant_id = m.id AND x.status = 'pending') AS bank_pending
        FROM merchants m
        LEFT JOIN merchant_individual_profiles i ON i.merchant_id = m.id
        LEFT JOIN merchant_business_profiles b ON b.merchant_id = m.id
        LEFT JOIN users u ON u.id = m.user_id
        WHERE (${st} = 'bank' AND m.status IN ('approved', 'suspended') AND EXISTS (SELECT 1 FROM merchant_bank_accounts x WHERE x.merchant_id = m.id AND x.status = 'pending'))
           OR (${st} = '' AND m.status = 'pending_review')
           OR (${st} NOT IN ('', 'bank') AND m.status = ${st})
        ORDER BY m.submitted_at ASC NULLS LAST, m.id DESC LIMIT 300`,
  ]);
  const c = Object.fromEntries(counts.map((r) => [r.status, r.n]));
  const ql = String(q).trim().toLowerCase();
  const list = rows
    .map((r) => ({ ...r, first_name_ind: r.ind_first, name: merchantName({ ...r, first_name: r.ind_first }) }))
    .filter((r) => !ql || [r.name, r.shop_name, r.email].some((v) => String(v || "").toLowerCase().includes(ql)));
  const badge = { "": c.pending_review, bank: bankN.n };

  return (
    <>
      <Head user={user} title="Мерчант" sub="Бараа, тасалбар борлуулах хүсэлтийг шалгаж батлах, банкны дансыг баталгаажуулах." search="/admin/merchants" q={q} hidden={{ st }} />
      <Flash ok={ok} error={error} />

      <section className={"adm-card vd-pub" + (settings.merchantOpen ? " on" : "")}>
        <span className="vd-pub-dot" aria-hidden="true" />
        <div>
          <b>{settings.merchantOpen ? "Маркет, мерчантын бүртгэл бүх хэрэглэгчид нээлттэй" : "Маркет, мерчантын бүртгэл одоогоор зөвхөн танд харагдаж байна"}</b>
          <p className="adm-muted">{settings.merchantOpen ? "Хүн бүр маркетыг үзэж, нэвтэрсэн хэрэглэгч бүтээгдэхүүн байршуулна." : "Нээхэд цэсэнд «Маркет», нүүр хуудсанд «Бүтээгдэхүүн байршуулах» товч гарна."}</p>
        </div>
        <span className="ss-grow" />
        <Link href="/merchant" className="adm-btn">Мерчантын хуудас</Link>
        <form action={setMerchantOpen}>
          <input type="hidden" name="on" value={settings.merchantOpen ? "0" : "1"} />
          <button className={"adm-btn " + (settings.merchantOpen ? "danger" : "teal")}>{settings.merchantOpen ? "Маркетыг хаах" : "Маркетыг нийтэд нээх"}</button>
        </form>
      </section>

      <div className="adm-stats">
        <Stat label="Шалгах" value={c.pending_review || 0} tone={c.pending_review ? "warn" : ""} />
        <Stat label="Данс шалгах" value={bankN.n} tone={bankN.n ? "warn" : ""} />
        <Stat label="Баталгаажсан" value={c.approved || 0} />
        <Stat label="Бөглөж байна" value={(c.draft || 0) + (c.revision_required || 0)} />
      </div>

      <nav className="vd-tabs" aria-label="Мерчантын төлөв">
        {TABS.map(([k, l]) => (
          <Link key={k} href={k ? `/admin/merchants?st=${k}` : "/admin/merchants"} className={st === k ? "on" : ""}>
            {l}{(badge[k] ?? (k ? c[k] : 0)) ? <em className="mz-badge">{badge[k] ?? c[k]}</em> : null}
          </Link>
        ))}
      </nav>

      <section className="adm-card flush">
        {list.length === 0 ? <p className="adm-empty">Энд одоогоор мерчант алга.</p> : (
          <table className="adm-table">
            <thead><tr><th>ID</th><th>Мерчант</th><th>Төрөл</th><th>Дэлгүүр</th><th>Хэрэглэгч</th><th>Төлөв</th><th>Илгээсэн</th><th></th></tr></thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  <td>№{r.id}</td>
                  <td><b>{r.name}</b></td>
                  <td>{r.type === "business" ? "Байгууллага" : "Хувь хүн"}</td>
                  <td>{r.shop_name || "—"}</td>
                  <td>{r.user_id ? <Link href={`/u/${r.user_id}`}>{r.first_name ? `${r.initial}.${r.first_name}` : r.email}</Link> : "—"}</td>
                  <td><Chip tone={MERCHANT_STATUS[r.status]?.[1]}>{MERCHANT_STATUS[r.status]?.[0]}</Chip>{r.bank_pending && r.status !== "pending_review" && <> <Chip tone="warn">Шинэ данс</Chip></>}</td>
                  <td>{when(r.submitted_at)}</td>
                  <td><Link className="adm-btn" href={`/admin/merchants/${r.id}`}>Нээх</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
