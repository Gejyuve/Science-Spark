import Link from "next/link";
import { sql } from "@/lib/db";
import { requireSection, ago } from "@/lib/admin";
import { ROLE_LABELS } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { levelFor } from "@/lib/levels";
import Head, { Tabs, Chip, Flash, who } from "../_c/Head";
import { Avatar } from "../../components/Bits";

const TABS = [["", "Бүгд"], ["admin", "Редакц"], ["restricted", "Хязгаарласан"], ["new", "Шинэ"]];
const ROLE_TONE = { superadmin: "dark", admin: "ok", user: "" };

export default async function Users({ searchParams }) {
  const user = await requireSection("users");
  const { tab = "", q = "", page = "1", ok, error } = await searchParams;
  const t = TABS.some(([k]) => k === tab) ? tab : "";
  const pg = Math.max(1, Number(page) || 1);
  const like = `%${String(q).trim().toLowerCase()}%`;
  const rows = await sql`
    SELECT u.id, u.email, u.initial, u.first_name, u.surname, u.role, u.account_type, u.restricted_at, u.created_at,
      COALESCE((SELECT SUM(delta) FROM points_ledger WHERE user_id = u.id), 0)::int AS points,
      (SELECT COUNT(*) FROM posts WHERE author_id = u.id)::int AS posts
    FROM users u
    WHERE (${t} = '' OR (${t} = 'admin' AND u.role IN ('admin','superadmin'))
           OR (${t} = 'restricted' AND u.restricted_at IS NOT NULL) OR (${t} = 'new' AND u.created_at > now() - interval '7 days'))
      AND (${like} = '%%' OR lower(u.email) LIKE ${like} OR lower(u.first_name) LIKE ${like} OR lower(COALESCE(u.surname,'')) LIKE ${like})
    ORDER BY u.created_at DESC LIMIT 51 OFFSET ${(pg - 1) * 50}`;
  const [c] = await sql`SELECT COUNT(*)::int AS all,
      COUNT(*) FILTER (WHERE role IN ('admin','superadmin'))::int AS admin,
      COUNT(*) FILTER (WHERE restricted_at IS NOT NULL)::int AS restricted,
      COUNT(*) FILTER (WHERE created_at > now() - interval '7 days')::int AS new
    FROM users`;
  const more = rows.length > 50;
  // Редакц таб: админ бүрийн хяналтын ажлын үзүүлэлт
  const work = t === "admin" ? Object.fromEntries((await sql`
    SELECT p.reviewer_id AS id,
      COUNT(*) FILTER (WHERE p.status IN ('published','approved','rejected'))::int AS total,
      COUNT(*) FILTER (WHERE p.status IN ('published','approved','rejected') AND p.reviewed_at > now() - interval '30 days')::int AS month,
      COUNT(*) FILTER (WHERE p.status = 'rejected')::int AS rejected,
      COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM p.reviewed_at - p.created_at)) FILTER (WHERE p.status IN ('published','approved','rejected')) / 3600), 0)::int AS avg_h,
      MAX(p.reviewed_at) AS last_at
    FROM posts p WHERE p.reviewer_id = ANY(${rows.map((r) => r.id)}) GROUP BY p.reviewer_id`).map((r) => [r.id, r])) : null;
  const none = { total: 0, month: 0, rejected: 0, avg_h: 0, last_at: null };
  const href = (k, p) => `/admin/users?${new URLSearchParams({ ...(k ? { tab: k } : {}), ...(q ? { q } : {}), ...(p > 1 ? { page: p } : {}) })}`;

  return (
    <>
      <Head user={user} title="Хэрэглэгчид" sub={`Нийт ${c.all} хэрэглэгч`} search="/admin/users" q={q} hidden={{ tab: t }} />
      <Flash ok={ok} error={error} />
      <div className="adm-bar">
        <Tabs cur={t} href={(k) => href(k)} tabs={TABS.map(([k, l]) => [k, l, c[k || "all"]])} />
        <span className="ss-grow" />
        <a href={`/admin/users/csv?${new URLSearchParams({ tab: t, q })}`} className="adm-btn">CSV татах</a>
      </div>
      <section className="adm-card flush">
        {rows.length === 0 ? (
          <p className="adm-empty">Хэрэглэгч олдсонгүй.</p>
        ) : (
          <table className="adm-table">
            <thead><tr><th>Хэрэглэгч</th><th>Эрх</th><th>Түвшин</th>{work ? <><th>30 хоногт хянасан</th><th>Нийт</th><th>Буцаасан</th><th>Дундаж</th><th>Сүүлд</th></> : <><th>Оч</th><th>Нийтлэл</th><th>Бүртгүүлсэн</th></>}<th></th></tr></thead>
            <tbody>
              {rows.slice(0, 50).map((u) => (
                <tr key={u.id}>
                  <td>
                    <span className="adm-user">
                      <Avatar user={u} size={32} />
                      <span><b>{who(u)}</b><small>{u.email}</small></span>
                    </span>
                  </td>
                  <td>
                    <Chip tone={ROLE_TONE[u.role]}>{ROLE_LABELS[u.role]}</Chip>
                    {u.restricted_at && <Chip tone="bad">Хязгаарласан</Chip>}
                  </td>
                  <td>{levelFor(u.points).n} · {levelFor(u.points).name}</td>
                  {work ? (() => {
                    const w = work[u.id] || none;
                    return (<>
                      <td className="adm-strong">{w.month}</td>
                      <td>{w.total}</td>
                      <td>{w.total ? Math.round((w.rejected / w.total) * 100) : 0}%</td>
                      <td>{w.total ? `${w.avg_h} цаг` : "—"}</td>
                      <td>{w.last_at ? ago(w.last_at) : <Chip tone="warn">Хянаагүй</Chip>}</td>
                    </>);
                  })() : (<>
                    <td>{u.points.toLocaleString("en-US")}</td>
                    <td>{u.posts}</td>
                    <td>{fmtDate(u.created_at)}</td>
                  </>)}
                  <td className="adm-right"><Link href={`/admin/users/${u.id}`} className="adm-btn">Харах</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {(pg > 1 || more) && (
        <div className="adm-pager">
          {pg > 1 && <a href={href(t, pg - 1)} className="adm-btn">← Өмнөх</a>}
          <span>{pg}-р хуудас</span>
          {more && <a href={href(t, pg + 1)} className="adm-btn">Дараах →</a>}
        </div>
      )}
    </>
  );
}
