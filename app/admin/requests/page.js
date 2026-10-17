import Link from "next/link";
import { sql } from "@/lib/db";
import { requireSection, ago } from "@/lib/admin";
import { levelFor } from "@/lib/levels";
import Head, { Tabs, Chip, Flash, who } from "../_c/Head";
import { Avatar } from "../../components/Bits";

const TABS = [["", "Хүлээгдэж буй"], ["approved", "Эрх нээсэн"], ["declined", "Татгалзсан"]];

export default async function Requests({ searchParams }) {
  const user = await requireSection("requests");
  const sp = await searchParams;
  const st = sp.s === "approved" || sp.s === "declined" ? sp.s : "pending";
  const rows = await sql`
    SELECT r.id, r.status, r.created_at, r.decided_at, u.id AS uid, u.initial, u.first_name, u.email,
      a.score, (SELECT COUNT(*) FROM exam_attempts WHERE user_id = u.id)::int AS attempts,
      COALESCE((SELECT SUM(delta) FROM points_ledger WHERE user_id = u.id), 0)::int AS points,
      (SELECT COUNT(*) FROM posts WHERE author_id = u.id AND status = 'published')::int AS published
    FROM reviewer_requests r JOIN users u ON u.id = r.user_id LEFT JOIN exam_attempts a ON a.id = r.attempt_id
    WHERE r.status = ${st} ORDER BY CASE WHEN ${st} = 'pending' THEN r.created_at END ASC, r.created_at DESC LIMIT 100`;
  const counts = await sql`SELECT status, COUNT(*)::int AS n FROM reviewer_requests GROUP BY status`;
  const c = Object.fromEntries(counts.map((r) => [r.status, r.n]));
  return (
    <>
      <Head user={user} title="Хянагчийн хүсэлт" sub="Шалгалтад тэнцсэн хэрэглэгчид · нийтлэл, шалгалтыг нь хараад эрх олгоно" />
      <Flash ok={sp.ok} error={sp.error} />
      <Tabs cur={st === "pending" ? "" : st} href={(k) => `/admin/requests${k ? `?s=${k}` : ""}`} tabs={TABS.map(([k, l]) => [k, l, c[k || "pending"] || 0])} />
      <section className="adm-card flush">
        {rows.length === 0 ? <p className="adm-empty">Хүсэлт алга.</p> : (
          <table className="adm-table">
            <thead><tr><th>Хэрэглэгч</th><th>Түвшин</th><th>Шалгалт</th><th>Оролдлого</th><th>Нийтлэгдсэн</th><th>Ирсэн</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><span className="adm-user"><Avatar user={{ id: r.uid, first_name: r.first_name }} size={32} /><span><b>{who(r)}</b><small>{r.email}</small></span></span></td>
                  <td>{levelFor(r.points).n} · {levelFor(r.points).name}</td>
                  <td><Chip tone="ok">{r.score ?? "—"} оноо</Chip></td>
                  <td>{r.attempts}</td>
                  <td>{r.published}</td>
                  <td>{ago(r.created_at)}</td>
                  <td className="adm-right"><Link href={`/admin/requests/${r.id}`} className="adm-btn">Нээх</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
