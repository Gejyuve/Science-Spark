import Link from "next/link";
import { sql } from "@/lib/db";
import { requireSection, ago } from "@/lib/admin";
import { ROLE_LABELS } from "@/lib/auth";
import { levelFor } from "@/lib/levels";
import { adminSetRole } from "../actions";
import Head, { Stat, Chip, Flash, who } from "../_c/Head";
import { Avatar } from "../../components/Bits";

export default async function Reviewers({ searchParams }) {
  const user = await requireSection("reviewers");
  const { ok, error } = await searchParams;
  const rows = await sql`
    SELECT u.id, u.email, u.initial, u.first_name, u.role,
      COALESCE((SELECT SUM(delta) FROM points_ledger WHERE user_id = u.id), 0)::int AS points,
      COUNT(p.id) FILTER (WHERE p.status IN ('published','rejected'))::int AS total,
      COUNT(p.id) FILTER (WHERE p.status IN ('published','rejected') AND p.reviewed_at > now() - interval '30 days')::int AS month,
      COUNT(p.id) FILTER (WHERE p.status = 'rejected')::int AS rejected,
      COUNT(p.id) FILTER (WHERE p.status = 'removed')::int AS removed,
      COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM p.reviewed_at - p.created_at)) FILTER (WHERE p.status IN ('published','rejected')) / 3600), 0)::int AS avg_h,
      MAX(p.reviewed_at) AS last_at
    FROM users u LEFT JOIN posts p ON p.reviewer_id = u.id
    WHERE u.role IN ('reviewer','admin','superadmin')
    GROUP BY u.id ORDER BY month DESC, total DESC`;
  const active = rows.filter((r) => r.month > 0).length;
  const monthTotal = rows.reduce((a, r) => a + r.month, 0);
  const sup = user.role === "superadmin";

  return (
    <>
      <Head user={user} title="Хянагчид" sub="Хянагч бүрийн ажлын үзүүлэлт" />
      <Flash ok={ok} error={error} />
      <div className="adm-stats">
        <Stat label="Нийт хянагч" value={rows.length} note="хянагч, админ" />
        <Stat label="Идэвхтэй" value={active} note="30 хоногт хянасан" />
        <Stat label="30 хоногт хянасан" value={monthTotal} note="нийтлэл" />
        <Stat label="Идэвхгүй" value={rows.length - active} note="30 хоногт хянаагүй" tone={rows.length - active > 0 ? "warn" : ""} />
      </div>
      <section className="adm-card flush">
        {rows.length === 0 ? <p className="adm-empty">Хянагч алга. Хэрэглэгчид хэсгээс эрх олгоно.</p> : (
          <table className="adm-table">
            <thead><tr><th>Хянагч</th><th>Эрх</th><th>Түвшин</th><th>30 хоног</th><th>Нийт</th><th>Буцаасан</th><th>Дундаж</th><th>Сүүлд</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><span className="adm-user"><Avatar user={r} size={32} /><span><b>{who(r)}</b><small>{r.email}</small></span></span></td>
                  <td><Chip tone={r.role === "reviewer" ? "teal" : "dark"}>{ROLE_LABELS[r.role]}</Chip></td>
                  <td>{levelFor(r.points).n}</td>
                  <td className="adm-strong">{r.month}</td>
                  <td>{r.total}</td>
                  <td>{r.total ? Math.round((r.rejected / r.total) * 100) : 0}%</td>
                  <td>{r.total ? `${r.avg_h} цаг` : "—"}</td>
                  <td>{r.last_at ? ago(r.last_at) : <Chip tone="warn">Хянаагүй</Chip>}</td>
                  <td className="adm-right">
                    <span className="adm-acts">
                      {sup && r.role === "reviewer" && (
                        <form action={adminSetRole}>
                          <input type="hidden" name="user_id" value={r.id} />
                          <input type="hidden" name="role" value="user" />
                          <input type="hidden" name="from" value="/admin/reviewers" />
                          <button className="adm-btn danger">Түдгэлзүүлэх</button>
                        </form>
                      )}
                      {sup || user.perms?.includes("users") ? <Link href={`/admin/users/${r.id}`} className="adm-btn">Харах</Link> : null}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
