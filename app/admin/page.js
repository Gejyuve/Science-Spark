import Link from "next/link";
import { sql } from "@/lib/db";
import { requireSection, ago, canSee } from "@/lib/admin";
import { fmtDate } from "@/lib/format";
import { LEVELS } from "@/lib/levels";
import { poolBalance, periodSummary, fmtMnt } from "@/lib/money";
import { currentPeriod, periodLabel } from "@/lib/spark";
import Head, { Stat, Chip, who } from "./_c/Head";

// 7 хоногийн өөрчлөлт: өмнөх 7 хоногтой харьцуулна
const trend = (now, prev) => {
  if (!prev) return now ? "өмнөх 7 хоногт 0" : "өөрчлөлтгүй";
  const d = Math.round(((now - prev) / prev) * 100);
  return `${d >= 0 ? "▲" : "▼"} ${Math.abs(d)}% өмнөх 7 хоногоос`;
};
const n = (v) => Number(v || 0).toLocaleString("en-US");

// Тойм: бүх хэсгийн өгөгдлөөс ерөнхий анализ
export default async function Overview() {
  const user = await requireSection("overview");
  const money = canSee(user, "finance");
  const period = currentPeriod();
  const [[s], levelRows, topWriters, pending, finance] = await Promise.all([
    sql`SELECT
      (SELECT COUNT(*) FROM users)::int AS users,
      (SELECT COUNT(*) FROM users WHERE created_at > now() - interval '7 days')::int AS users_w,
      (SELECT COUNT(*) FROM users WHERE created_at BETWEEN now() - interval '14 days' AND now() - interval '7 days')::int AS users_pw,
      (SELECT COUNT(*) FROM users WHERE created_at > now() - interval '30 days')::int AS users_m,
      (SELECT COUNT(DISTINCT x) FROM (
         SELECT author_id AS x FROM posts WHERE created_at > now() - interval '30 days'
         UNION SELECT author_id FROM comments WHERE created_at > now() - interval '30 days'
         UNION SELECT user_id FROM sparks WHERE created_at > now() - interval '30 days') a)::int AS active,
      (SELECT COUNT(*) FROM users WHERE restricted_at IS NOT NULL)::int AS restricted,
      (SELECT COUNT(*) FROM users WHERE premium_until > now())::int AS supporters,
      (SELECT COUNT(*) FROM posts WHERE status = 'published')::int AS published,
      (SELECT COUNT(*) FROM posts WHERE status = 'published' AND created_at > now() - interval '7 days')::int AS pub_w,
      (SELECT COUNT(*) FROM posts WHERE status = 'published' AND created_at BETWEEN now() - interval '14 days' AND now() - interval '7 days')::int AS pub_pw,
      (SELECT COUNT(*) FROM comments WHERE created_at > now() - interval '7 days')::int AS com_w,
      (SELECT COUNT(*) FROM comments WHERE created_at BETWEEN now() - interval '14 days' AND now() - interval '7 days')::int AS com_pw,
      (SELECT COUNT(*) FROM post_views WHERE created_at > now() - interval '7 days')::int AS views_w,
      (SELECT COUNT(*) FROM post_views WHERE created_at BETWEEN now() - interval '14 days' AND now() - interval '7 days')::int AS views_pw,
      (SELECT COUNT(*) FROM posts WHERE status = 'pending')::int AS pending,
      (SELECT COUNT(*) FROM posts WHERE status = 'pending' AND created_at < now() - interval '3 days')::int AS stale,
      (SELECT COUNT(*) FROM posts WHERE reviewed_at > now() - interval '30 days' AND status IN ('published','approved','rejected'))::int AS reviewed,
      (SELECT COUNT(*) FROM posts WHERE reviewed_at > now() - interval '30 days' AND status = 'rejected')::int AS rejected,
      (SELECT COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM reviewed_at - created_at)) / 3600), 0)
         FROM posts WHERE reviewed_at > now() - interval '30 days' AND status IN ('published','approved','rejected'))::int AS avg_h,
      (SELECT COUNT(*) FROM logic_reports WHERE status = 'open')::int AS logic,
      (SELECT COUNT(*) FROM users WHERE role IN ('admin','superadmin'))::int AS staff,
      (SELECT COUNT(DISTINCT reviewer_id) FROM posts WHERE reviewed_at > now() - interval '30 days')::int AS staff_active,
      (SELECT COUNT(*) FROM clubs WHERE status = 'active')::int AS clubs,
      (SELECT COUNT(*) FROM club_members)::int AS members,
      (SELECT COUNT(*) FROM sparks WHERE created_at > now() - interval '7 days')::int AS sparks_w,
      (SELECT COUNT(*) FROM sparks WHERE created_at BETWEEN now() - interval '14 days' AND now() - interval '7 days')::int AS sparks_pw,
      (SELECT COALESCE(SUM(delta) FILTER (WHERE delta > 0), 0) FROM points_ledger WHERE created_at > now() - interval '30 days')::int AS points_m,
      (SELECT COALESCE(-SUM(delta) FILTER (WHERE delta < 0), 0) FROM points_ledger WHERE created_at > now() - interval '30 days')::int AS fines_m`,
    sql`SELECT COALESCE(SUM(l.delta), 0)::int AS p FROM users u LEFT JOIN points_ledger l ON l.user_id = u.id GROUP BY u.id`,
    sql`SELECT u.id, u.initial, u.first_name, u.email, COUNT(*)::int AS n
        FROM sparks s JOIN posts p ON p.id = s.post_id JOIN users u ON u.id = p.author_id
        WHERE s.created_at > now() - interval '30 days' AND s.user_id <> p.author_id
        GROUP BY u.id ORDER BY n DESC LIMIT 5`,
    sql`SELECT p.id, p.kind, p.title, p.created_at, u.initial, u.first_name, u.email
        FROM posts p JOIN users u ON u.id = p.author_id
        WHERE p.status = 'pending' ORDER BY p.created_at ASC LIMIT 6`,
    money
      ? Promise.all([poolBalance(), periodSummary(1), sql`SELECT
          (SELECT COUNT(*) FROM payment_requests WHERE status = 'pending')::int AS pay,
          (SELECT COUNT(*) FROM withdrawals WHERE status = 'pending')::int AS wd,
          (SELECT COALESCE(SUM(delta), 0) FROM money_ledger WHERE account = 'wallet')::bigint AS wallets`])
      : null,
  ]);
  const levels = LEVELS.map((l, i) => ({ ...l, users: levelRows.filter((r) => r.p >= l.min && (!LEVELS[i + 1] || r.p < LEVELS[i + 1].min)).length }));
  const maxLv = Math.max(1, ...levels.map((l) => l.users));
  const showAudit = canSee(user, "audit");
  const recent = showAudit
    ? await sql`SELECT a.action, a.target_label, a.created_at, a.ok, u.initial, u.first_name, u.email
                FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
                ORDER BY a.created_at DESC LIMIT 6`
    : [];
  const rejPct = s.reviewed ? Math.round((s.rejected / s.reviewed) * 100) : 0;
  const [pool, [cur], [mc]] = finance || [0, [], [{}]];
  const cur0 = cur && cur.period === period ? cur : null;

  return (
    <>
      <Head user={user} title="Тойм" sub="Сайтын бүх хэсгийн ерөнхий анализ" />
      {s.stale > 0 && (
        <p className="adm-banner">
          ⚠ {s.stale} контент 3 хоногоос удаан хянагдаагүй хүлээгдэж байна.{" "}
          <Link href="/admin/content?status=pending">Засах →</Link>
        </p>
      )}

      <h2 className="adm-sec">Хэрэглэгчид</h2>
      <div className="adm-stats">
        <Stat label="Нийт хэрэглэгч" value={n(s.users)} note={`30 хоногт +${n(s.users_m)}`} />
        <Stat label="7 хоногт бүртгүүлсэн" value={n(s.users_w)} note={trend(s.users_w, s.users_pw)} />
        <Stat label="Идэвхтэй" value={n(s.active)} note="30 хоногт бичсэн, сэтгэгдэл, оч өгсөн" />
        <Stat label="Дэмжигчид" value={n(s.supporters)} note="идэвхтэй" />
        <Stat label="Хязгаарласан" value={n(s.restricted)} tone={s.restricted ? "bad" : ""} note="хэрэглэгч" />
      </div>

      <h2 className="adm-sec">Контент, оролцоо</h2>
      <div className="adm-stats">
        <Stat label="Нийтлэгдсэн" value={n(s.published)} note={`7 хоногт +${n(s.pub_w)} · ${trend(s.pub_w, s.pub_pw)}`} />
        <Stat label="Үзэлт (7 хоног)" value={n(s.views_w)} note={trend(s.views_w, s.views_pw)} />
        <Stat label="Сэтгэгдэл (7 хоног)" value={n(s.com_w)} note={trend(s.com_w, s.com_pw)} />
        <Stat label="Өгсөн оч (7 хоног)" value={n(s.sparks_w)} note={trend(s.sparks_w, s.sparks_pw)} />
        <Stat label="Клуб" value={n(s.clubs)} note={`${n(s.members)} гишүүн`} />
      </div>

      <h2 className="adm-sec">Редакц</h2>
      <div className="adm-stats">
        <Stat label="Хүлээгдэж буй" value={s.pending} note={s.stale ? `${s.stale} нь 3+ хоног` : "Хугацаандаа"} tone={s.stale ? "warn" : ""} />
        <Stat label="30 хоногт хянасан" value={s.reviewed} note={`Дундаж ${s.avg_h} цаг`} />
        <Stat label="Буцаасан" value={`${rejPct}%`} note={`${s.rejected} контент`} />
        <Stat label="Идэвхтэй админ" value={`${s.staff_active} / ${s.staff}`} note="30 хоногт хянасан" />
        <Stat label="Логик алдаа" value={s.logic} note="шийдээгүй мэдэгдэл" tone={s.logic ? "warn" : ""} />
      </div>

      {money && (
        <>
          <h2 className="adm-sec">Санхүү · {periodLabel(period)}</h2>
          <div className="adm-stats">
            <Stat label="Шагналын сан" value={fmtMnt(pool)} />
            <Stat label="Дэмжигчийн цэвэр орлого" value={fmtMnt(cur0?.premium_net || 0)} note="энэ сар" />
            <Stat label="Сайтын үлдэгдэл" value={fmtMnt(cur0?.platform_net || 0)} note="орлого − зардал" tone={Number(cur0?.platform_net) < 0 ? "bad" : ""} />
            <Stat label="Бичээчдийн хэтэвч" value={fmtMnt(mc.wallets || 0)} note="нийт үлдэгдэл" />
            <Stat label="Хүлээгдэж буй" value={(mc.pay || 0) + (mc.wd || 0)} note={`${mc.pay || 0} төлбөр · ${mc.wd || 0} татах`} tone={mc.pay || mc.wd ? "warn" : ""} />
          </div>
        </>
      )}

      <div className="adm-grid2">
        <section className="adm-card">
          <div className="adm-card-head"><b>Түвшний тархалт</b><span className="ss-grow" /><small className="adm-muted">30 хоногт +{n(s.points_m)} оч, −{n(s.fines_m)}</small></div>
          <ul className="adm-bars">
            {levels.map((l) => (
              <li key={l.n}>
                <span>{l.n} · {l.name}</span>
                <i><em style={{ width: `${(l.users / maxLv) * 100}%`, background: l.color }} /></i>
                <b>{n(l.users)}</b>
              </li>
            ))}
          </ul>
        </section>
        <section className="adm-card">
          <div className="adm-card-head"><b>30 хоногийн шилдэг бичээч</b><span className="ss-grow" /><Link href="/san#board" className="adm-link">Самбар →</Link></div>
          {topWriters.length === 0 ? <p className="adm-empty">Одоохондоо оч аваагүй.</p> : (
            <table className="adm-table">
              <thead><tr><th>#</th><th>Бичээч</th><th>Авсан оч</th></tr></thead>
              <tbody>
                {topWriters.map((w, i) => (
                  <tr key={w.id}><td>{i + 1}</td><td><Link href={`/u/${w.id}`}>{who(w)}</Link></td><td className="adm-strong">{n(w.n)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className="adm-card">
        <div className="adm-card-head">
          <b>Хүлээгдэж буй контент</b>
          <span className="ss-grow" />
          <Link href="/admin/content?status=pending" className="adm-link">Бүгдийг харах →</Link>
        </div>
        {pending.length === 0 ? (
          <p className="adm-empty">Хүлээгдэж буй контент алга 🎉</p>
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
                    <td className="adm-right"><Link href={`/review/${p.id}`} className="adm-btn teal">Засах</Link></td>
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
