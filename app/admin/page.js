import Link from "next/link";
import { sql } from "@/lib/db";
import { requireSection, ago, canSee } from "@/lib/admin";
import { fmtDate } from "@/lib/format";
import Head, { Stat, Chip, who } from "./_c/Head";

export default async function Overview() {
  const user = await requireSection("overview");
  const [s] = await sql`SELECT
      (SELECT COUNT(*) FROM users)::int AS users,
      (SELECT COUNT(*) FROM users WHERE created_at > now() - interval '7 days')::int AS users_new,
      (SELECT COUNT(*) FROM posts WHERE status = 'pending')::int AS pending,
      (SELECT COUNT(*) FROM posts WHERE status = 'pending' AND created_at < now() - interval '3 days')::int AS stale,
      (SELECT COUNT(*) FROM users WHERE role IN ('reviewer','admin','superadmin'))::int AS reviewers,
      (SELECT COUNT(DISTINCT reviewer_id) FROM posts WHERE reviewed_at > now() - interval '30 days')::int AS active_reviewers,
      (SELECT COUNT(*) FROM posts WHERE reviewed_at > now() - interval '30 days' AND status IN ('published','rejected'))::int AS reviewed,
      (SELECT COUNT(*) FROM posts WHERE reviewed_at > now() - interval '30 days' AND status = 'rejected')::int AS rejected,
      (SELECT COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM reviewed_at - created_at)) / 3600), 0)
         FROM posts WHERE reviewed_at > now() - interval '30 days' AND status IN ('published','rejected'))::int AS avg_h,
      (SELECT COUNT(*) FROM users WHERE restricted_at IS NOT NULL)::int AS restricted,
      (SELECT COUNT(*) FROM reviewer_requests WHERE status = 'pending')::int AS requests`;
  const pending = await sql`
    SELECT p.id, p.kind, p.title, p.created_at, u.initial, u.first_name, u.email
    FROM posts p JOIN users u ON u.id = p.author_id
    WHERE p.status = 'pending' ORDER BY p.created_at ASC LIMIT 8`;
  const showAudit = canSee(user, "audit");
  const recent = showAudit
    ? await sql`SELECT a.action, a.target_label, a.created_at, a.ok, u.initial, u.first_name, u.email
                FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
                ORDER BY a.created_at DESC LIMIT 6`
    : [];
  const rejPct = s.reviewed ? Math.round((s.rejected / s.reviewed) * 100) : 0;

  return (
    <>
      <Head user={user} title="Тойм" sub="Редакцын өнөөдрийн байдал" />
      {s.stale > 0 && (
        <p className="adm-banner">
          ⚠ {s.stale} нийтлэл 3 хоногоос удаан хянагдаагүй хүлээгдэж байна.{" "}
          <Link href="/review">Хянах →</Link>
        </p>
      )}
      {s.requests > 0 && canSee(user, "requests") && (
        <p className="adm-banner">
          🛡 {s.requests} хэрэглэгч хянагчийн шалгалтад тэнцээд эрх хүлээж байна.{" "}
          <Link href="/admin/requests">Хүсэлтүүд →</Link>
        </p>
      )}
      <div className="adm-stats">
        <Stat label="Нийт хэрэглэгч" value={s.users} note={`7 хоногт +${s.users_new}`} />
        <Stat label="Хүлээгдэж буй" value={s.pending} note={s.stale ? `${s.stale} нь 3+ хоног` : "Хугацаандаа"} tone={s.stale ? "warn" : ""} />
        <Stat label="Идэвхтэй хянагч" value={`${s.active_reviewers} / ${s.reviewers}`} note="30 хоногт хянасан" />
        <Stat label="30 хоногт хянасан" value={s.reviewed} note={`Дундаж ${s.avg_h} цаг`} />
        <Stat label="Буцаасан" value={`${rejPct}%`} note={`${s.rejected} нийтлэл`} />
        <Stat label="Хязгаарласан" value={s.restricted} note="хэрэглэгч" tone={s.restricted ? "bad" : ""} />
      </div>

      <section className="adm-card">
        <div className="adm-card-head">
          <b>Хүлээгдэж буй нийтлэл</b>
          <span className="ss-grow" />
          <Link href="/review" className="adm-link">Бүгдийг хянах →</Link>
        </div>
        {pending.length === 0 ? (
          <p className="adm-empty">Хүлээгдэж буй нийтлэл алга 🎉</p>
        ) : (
          <table className="adm-table">
            <thead><tr><th>Гарчиг</th><th>Төрөл</th><th>Зохиогч</th><th>Ирсэн</th><th></th></tr></thead>
            <tbody>
              {pending.map((p) => {
                const old = Date.now() - new Date(p.created_at).getTime() > 3 * 86400000;
                return (
                  <tr key={p.id}>
                    <td className="adm-strong">{p.title}</td>
                    <td><Chip>{p.kind}</Chip></td>
                    <td>{who(p)}</td>
                    <td>{old ? <Chip tone="bad">{ago(p.created_at)}</Chip> : ago(p.created_at)}</td>
                    <td className="adm-right"><Link href={`/post/${p.id}`} className="adm-btn">Нээх</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {showAudit && (
        <section className="adm-card">
          <div className="adm-card-head">
            <b>Сүүлийн үйлдлүүд</b>
            <span className="ss-grow" />
            <Link href="/admin/audit" className="adm-link">Аудит лог →</Link>
          </div>
          {recent.length === 0 ? (
            <p className="adm-empty">Одоохондоо бичлэг алга.</p>
          ) : (
            <ul className="adm-feed">
              {recent.map((a, i) => (
                <li key={i}>
                  <span className={"adm-dot" + (a.ok ? "" : " bad")} />
                  <span><b>{a.first_name || a.email ? who(a) : "Систем"}</b> · {a.action}{a.target_label ? ` — ${a.target_label}` : ""}</span>
                  <small title={fmtDate(a.created_at)}>{ago(a.created_at)}</small>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
