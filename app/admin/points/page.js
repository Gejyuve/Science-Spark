import Link from "next/link";
import { sql } from "@/lib/db";
import { requireSection, ago } from "@/lib/admin";
import { LEVELS } from "@/lib/levels";
import { adjustPoints } from "../actions";
import Head, { Stat, Flash, who } from "../_c/Head";

export default async function Points({ searchParams }) {
  const user = await requireSection("points");
  const { ok, error } = await searchParams;
  const totals = await sql`SELECT COALESCE(SUM(delta), 0)::int AS p FROM points_ledger GROUP BY user_id`;
  const all = (await sql`SELECT COUNT(*)::int AS n FROM users`)[0].n;
  const sums = totals.map((r) => r.p).concat(Array(Math.max(0, all - totals.length)).fill(0));
  const [s] = await sql`SELECT
      COALESCE(SUM(delta) FILTER (WHERE delta > 0), 0)::int AS given,
      COALESCE(-SUM(delta) FILTER (WHERE delta < 0), 0)::int AS taken,
      COALESCE(SUM(delta) FILTER (WHERE created_at > now() - interval '7 days'), 0)::int AS week,
      COUNT(*) FILTER (WHERE reason LIKE 'admin:%')::int AS manual
    FROM points_ledger`;
  const ledger = await sql`
    SELECT l.delta, l.reason, l.created_at, u.id, u.initial, u.first_name, u.email
    FROM points_ledger l JOIN users u ON u.id = l.user_id
    ORDER BY l.created_at DESC LIMIT 40`;
  const open = LEVELS.filter((l) => !l.locked);
  const countFor = (l, i) => {
    const next = open[i + 1];
    return sums.filter((p) => p >= l.min && (!next || p < next.min)).length;
  };

  return (
    <>
      <Head user={user} title="Оч ба Түвшин" sub="Очны урсгал, түвшний босго, гар тохируулга" />
      <Flash ok={ok} error={error} />
      <div className="adm-stats">
        <Stat label="Нийт олгосон" value={s.given.toLocaleString("en-US")} note="оч" />
        <Stat label="Хассан / торгууль" value={s.taken.toLocaleString("en-US")} note="оч" tone={s.taken ? "bad" : ""} />
        <Stat label="7 хоногт" value={(s.week > 0 ? "+" : "") + s.week.toLocaleString("en-US")} note="цэвэр өөрчлөлт" />
        <Stat label="Гар тохируулга" value={s.manual} note="админы бичлэг" />
      </div>
      <div className="adm-grid2">
        <section className="adm-card">
          <div className="adm-card-head"><b>Түвшин</b></div>
          <table className="adm-table">
            <thead><tr><th>#</th><th>Нэр</th><th>Босго</th><th>Хэрэглэгч</th></tr></thead>
            <tbody>
              {LEVELS.map((l) => {
                const i = open.indexOf(l);
                return (
                  <tr key={l.n} className={l.locked ? "adm-dim" : ""}>
                    <td>{l.n}</td>
                    <td className="adm-strong">{l.name}{l.locked && " 🔒"}</td>
                    <td>{l.min.toLocaleString("en-US")}+</td>
                    <td>{l.locked ? "—" : countFor(l, i)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="adm-muted small">Хянагч болох босго: 4-р түвшин. Түгжээтэй түвшнүүд одоохондоо нээгдээгүй.</p>
        </section>
        <section className="adm-card">
          <div className="adm-card-head"><b>Оч нэмэх / хасах</b></div>
          <form action={adjustPoints} className="adm-form">
            <input type="hidden" name="from" value="/admin/points" />
            <label>Хэрэглэгч<input name="who" required placeholder="ID эсвэл мэйл" /></label>
            <label>Оч (хасах бол хасах тэмдэгтэй)<input name="delta" type="number" required min={-10000} max={10000} placeholder="жишээ: 50 эсвэл -20" /></label>
            <label>Шалтгаан<input name="note" required maxLength={300} placeholder="Аудит логт бичигдэнэ" /></label>
            <button className="adm-btn dark">Бичих</button>
          </form>
          <p className="adm-muted small">Бүх өөрчлөлт данс, аудит логт үлдэнэ. Өөртөө оч өгөх боломжгүй.</p>
        </section>
      </div>
      <section className="adm-card flush">
        <div className="adm-card-head pad"><b>Сүүлийн очны бичлэгүүд</b></div>
        {ledger.length === 0 ? <p className="adm-empty">Бичлэг алга.</p> : (
          <table className="adm-table">
            <thead><tr><th>Хэрэглэгч</th><th>Оч</th><th>Шалтгаан</th><th>Хэзээ</th></tr></thead>
            <tbody>
              {ledger.map((l, i) => (
                <tr key={i}>
                  <td><Link href={`/u/${l.id}`}>{who(l)}</Link></td>
                  <td className={l.delta < 0 ? "adm-neg" : "adm-pos"}>{l.delta > 0 ? "+" : ""}{l.delta}</td>
                  <td>{l.reason.startsWith("admin:") ? <>🛡 {l.reason.slice(6)}</> : l.reason}</td>
                  <td>{ago(l.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
