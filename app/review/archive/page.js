import Link from "next/link";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { getUser, isStaff } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { STATUS_LABELS } from "@/lib/admin";
import Head, { Tabs, Chip, who, STATUS_TONE } from "../../admin/_c/Head";

const TABS = [["", "Бүгд"], ["published", "Зөвшөөрсөн"], ["rejected", "Буцаасан"], ["removed", "Дараа нь нуугдсан"]];

// Миний шийдвэрүүд: өөрийн хянасан контентын архив
export default async function Archive({ searchParams }) {
  const user = await getUser();
  if (!isStaff(user)) redirect("/review");
  const sp = await searchParams;
  const st = TABS.some(([k]) => k === sp.s) ? sp.s : "";
  const q = String(sp.q || "");
  const like = `%${q.trim().toLowerCase()}%`;
  const rows = await sql`
    SELECT p.id, p.kind, p.title, p.status, p.review_note, p.reviewed_at, p.original IS NOT NULL AS edited,
      u.initial, u.first_name, u.email
    FROM posts p JOIN users u ON u.id = p.author_id
    WHERE p.reviewer_id = ${user.id} AND p.status <> 'pending'
      AND (${st} = '' OR p.status = ${st} OR (${st} = 'published' AND p.status = 'approved'))
      AND (${like} = '%%' OR lower(p.title) LIKE ${like})
    ORDER BY p.reviewed_at DESC NULLS LAST LIMIT 200`;
  const counts = await sql`SELECT status, COUNT(*)::int AS n FROM posts WHERE reviewer_id = ${user.id} AND status <> 'pending' GROUP BY status`;
  const c = Object.fromEntries(counts.map((r) => [r.status, r.n]));
  c.published = (c.published || 0) + (c.approved || 0);
  const all = counts.reduce((a, r) => a + r.n, 0);
  return (
    <>
      <Head user={user} title="Миний шийдвэрүүд" sub="Таны хянасан бүх контентын архив" search="/review/archive" q={q} hidden={{ s: st }} />
      <Tabs cur={st} href={(k) => `/review/archive${k ? `?s=${k}` : ""}`} tabs={TABS.map(([k, l]) => [k, l, k ? c[k] || 0 : all])} />
      <section className="adm-card flush">
        {rows.length === 0 ? <p className="adm-empty">Одоохондоо шийдвэр алга.</p> : (
          <table className="adm-table">
            <thead><tr><th>Гарчиг</th><th>Төрөл</th><th>Бичээч</th><th>Шийдвэр</th><th>Тайлбар</th><th>Огноо</th><th></th></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="adm-strong adm-clip">{p.title}{p.edited && <small className="adm-note">✎ Засвартай нийтлэгдсэн</small>}</td>
                  <td><Chip>{p.kind}</Chip></td>
                  <td>{who(p)}</td>
                  <td><Chip tone={STATUS_TONE[p.status]}>{p.status === "removed" ? "Нуугдсан" : p.status === "approved" ? "Зөвшөөрсөн · бичээч нийтлээгүй" : STATUS_LABELS[p.status]}</Chip></td>
                  <td className="adm-wrap adm-clip">{p.review_note || "—"}</td>
                  <td>{p.reviewed_at ? fmtDate(p.reviewed_at) : "—"}</td>
                  <td className="adm-right"><Link href={`/post/${p.id}`} className="adm-btn">Харах</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
