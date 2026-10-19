import { sql } from "@/lib/db";
import { requireSection, AUDIT_TABS, maskIp } from "@/lib/admin";
import Head, { Tabs, Chip, who } from "../_c/Head";

const CAT = Object.fromEntries(AUDIT_TABS.filter(([k]) => k));
const fmt = (d) => new Date(d).toLocaleString("sv-SE", { timeZone: "Asia/Ulaanbaatar" }).slice(0, 16);

export default async function Audit({ searchParams }) {
  const user = await requireSection("audit");
  const sp = await searchParams;
  const cat = CAT[sp.cat] ? sp.cat : "";
  const q = String(sp.q || "");
  const like = `%${q.trim().toLowerCase()}%`;
  const pg = Math.max(1, Number(sp.page) || 1);
  const rows = await sql`
    SELECT a.*, u.initial, u.first_name, u.email
    FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
    WHERE a.category <> 'money' AND (${cat} = '' OR a.category = ${cat})
      AND (${like} = '%%' OR lower(a.action) LIKE ${like} OR lower(COALESCE(a.target_label,'')) LIKE ${like}
           OR lower(COALESCE(u.email,'')) LIKE ${like} OR lower(COALESCE(u.first_name,'')) LIKE ${like})
    ORDER BY a.created_at DESC LIMIT 101 OFFSET ${(pg - 1) * 100}`;
  const counts = await sql`SELECT category, COUNT(*)::int AS n FROM audit_log WHERE category <> 'money' GROUP BY category`;
  const cnt = Object.fromEntries(counts.map((r) => [r.category, r.n]));
  const total = counts.reduce((a, r) => a + r.n, 0);
  const href = (o) => "/admin/audit?" + new URLSearchParams(Object.entries({ cat, q, ...o }).filter(([, x]) => x && x !== 1));
  const more = rows.length > 100;

  return (
    <>
      <Head user={user} title="Аудит лог" sub="Эрх, оч, контент, нэвтрэлтийн үйлдэл. Санхүүгийнх Санхүү хэсэгт. Засах, устгах боломжгүй." search="/admin/audit" q={q} hidden={{ cat }} />
      <Tabs cur={cat} href={(k) => href({ cat: k, page: null })} tabs={AUDIT_TABS.map(([k, l]) => [k, l, k ? cnt[k] || 0 : total])} />
      <section className="adm-card flush">
        {rows.length === 0 ? <p className="adm-empty">Бичлэг алга.</p> : (
          <table className="adm-table">
            <thead><tr><th>Хугацаа</th><th>Хэн</th><th>Ангилал</th><th>Үйлдэл</th><th>Хэнд / юунд</th><th>IP</th><th>Төлөв</th></tr></thead>
            <tbody>
              {rows.slice(0, 100).map((a) => (
                <tr key={a.id}>
                  <td className="adm-mono">{fmt(a.created_at)}</td>
                  <td>{a.actor_id ? who(a) : "Систем"}</td>
                  <td><Chip>{CAT[a.category] || a.category}</Chip></td>
                  <td className="adm-wrap">{a.action}</td>
                  <td>
                    {a.target_type === "user" && a.target_id ? <a href={`/admin/users/${a.target_id}`}>{a.target_label}</a>
                      : a.target_type === "post" && a.target_id ? <a href={`/post/${a.target_id}`}>{a.target_label}</a>
                      : a.target_label || "—"}
                  </td>
                  <td className="adm-mono">{maskIp(a.ip)}</td>
                  <td>{a.ok ? <Chip tone="ok">Амжилттай</Chip> : <Chip tone="bad">Амжилтгүй</Chip>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {(pg > 1 || more) && (
        <div className="adm-pager">
          {pg > 1 && <a href={href({ page: pg - 1 })} className="adm-btn">← Өмнөх</a>}
          <span>{pg}-р хуудас</span>
          {more && <a href={href({ page: pg + 1 })} className="adm-btn">Дараах →</a>}
        </div>
      )}
    </>
  );
}
