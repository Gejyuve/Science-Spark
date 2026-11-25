import Link from "next/link";
import { sql } from "@/lib/db";
import { requireSection } from "@/lib/admin";
import { listForReview } from "@/lib/market";
import { PRODUCT_STATUS, fmtMnt } from "@/lib/market-shared";
import Head, { Chip, Flash } from "../_c/Head";

const when = (d) => (d ? new Date(d).toLocaleString("sv-SE", { timeZone: "Asia/Ulaanbaatar" }).slice(0, 16).replaceAll("-", ".") : "—");
const TABS = [["pending_review", "Шалгах"], ["published", "Нийтлэгдсэн"], ["revision_required", "Засвар хүссэн"], ["hidden", "Нуусан"], ["rejected", "Татгалзсан"]];

// Админ > Маркет: мерчантын илгээсэн бүтээгдэхүүнийг шалгаж нийтлэх
export default async function AdminProducts({ searchParams }) {
  const user = await requireSection("products");
  const { st = "pending_review", ok, error } = await searchParams;
  const tab = TABS.some(([k]) => k === st) ? st : "pending_review";
  const [counts, rows] = await Promise.all([
    sql`SELECT status, COUNT(*)::int AS n FROM products GROUP BY status`,
    listForReview(tab),
  ]);
  const c = Object.fromEntries(counts.map((r) => [r.status, r.n]));
  return (
    <>
      <Head user={user} title="Маркет" sub="Мерчантын илгээсэн бүтээгдэхүүнийг шалгаж нийтлэх." tools={<Link href="/market" className="adm-btn">Маркет үзэх</Link>} />
      <Flash ok={ok} error={error} />
      <nav className="vd-tabs" aria-label="Төлөв">
        {TABS.map(([k, l]) => <Link key={k} href={`/admin/products?st=${k}`} className={tab === k ? "on" : ""}>{l}{c[k] ? <em className="mz-badge">{c[k]}</em> : null}</Link>)}
      </nav>
      <section className="adm-card flush">
        {rows.length === 0 ? <p className="adm-empty">Энд одоогоор бүтээгдэхүүн алга.</p> : (
          <table className="adm-table">
            <thead><tr><th></th><th>Бүтээгдэхүүн</th><th>Үнэ</th><th>Борлуулагч</th><th>Мерчант</th><th>Илгээсэн</th><th></th></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>{p.image_ids?.[0] ? <img className="mka-th" src={`/img/${p.image_ids[0]}`} alt="" /> : null}</td>
                  <td><b>{p.title}</b><br /><small className="adm-muted">{p.type}</small></td>
                  <td>{p.price ? fmtMnt(p.price) : "—"}</td>
                  <td>{p.seller || `${p.u_initial || ""}.${p.u_first || ""}`}</td>
                  <td>{p.m_status ? <Chip tone={p.m_status === "approved" ? "ok" : "warn"}>{p.m_status === "approved" ? "Баталгаажсан" : "Шалгаж байна"}</Chip> : "—"}</td>
                  <td>{when(p.submitted_at)}</td>
                  <td><Link href={`/admin/products/${p.id}`} className="adm-btn">Шалгах</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
