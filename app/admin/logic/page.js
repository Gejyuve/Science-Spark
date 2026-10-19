import Link from "next/link";
import { sql } from "@/lib/db";
import { requireSection, ago } from "@/lib/admin";
import { decideLogic } from "../actions";
import Head, { Tabs, Chip, Flash, who } from "../_c/Head";

const TABS = [["", "Шийдвэрлээгүй"], ["resolved", "Шийдвэрлэсэн"], ["dismissed", "Татгалзсан"]];
const TYPES = [["", "Бүгд"], ["error", "Логик алдаа"], ["complaint", "Гомдол"], ["defense", "Сануулгын хариу"]];
const TYPE_TONE = { error: "teal", complaint: "warn", defense: "bad" };
const TYPE_LABEL = { error: "Логик алдаа", complaint: "Гомдол", defense: "Сануулгын хариу" };

// Уншигчдын мэдэгдсэн логик алдаа, бичээчийн гомдол (редакцын засвар, нуусан контентод), сануулгад бичсэн хариу
export default async function Logic({ searchParams }) {
  const user = await requireSection("logic");
  const sp = await searchParams;
  const st = sp.s === "resolved" || sp.s === "dismissed" ? sp.s : "open";
  const type = TYPE_LABEL[sp.t] ? sp.t : "";
  const rows = await sql`
    SELECT r.id, r.type, r.body, r.status, r.note, r.created_at, r.resolved_at, r.revision_id, p.id AS pid, p.title, p.kind,
      w.note AS warning, w.created_at AS warned_at,
      u.id AS uid, u.initial, u.first_name, u.email, a.initial AS ai, a.first_name AS af, a.email AS ae
    FROM logic_reports r
    JOIN users u ON u.id = r.user_id
    LEFT JOIN posts p ON p.id = r.post_id
    LEFT JOIN users a ON a.id = p.author_id
    LEFT JOIN user_warnings w ON w.id = r.warning_id
    WHERE r.status = ${st} AND (${type} = '' OR r.type = ${type})
    ORDER BY CASE WHEN ${st} = 'open' THEN r.created_at END ASC, r.created_at DESC LIMIT 100`;
  const counts = await sql`SELECT status, COUNT(*)::int AS n FROM logic_reports WHERE (${type} = '' OR type = ${type}) GROUP BY status`;
  const c = Object.fromEntries(counts.map((x) => [x.status, x.n]));
  const typeCounts = await sql`SELECT type, COUNT(*)::int AS n FROM logic_reports WHERE status = ${st} GROUP BY type`;
  const tc = Object.fromEntries(typeCounts.map((x) => [x.type, x.n]));
  const q = (s, t) => {
    const p = new URLSearchParams();
    if (s && s !== "open") p.set("s", s);
    if (t) p.set("t", t);
    const x = p.toString();
    return `/admin/logic${x ? `?${x}` : ""}`;
  };
  const from = q(st, type);
  return (
    <>
      <Head user={user} title="Логик алдаа" sub="Уншигчдын мэдэгдсэн алдаа, бичээчийн гомдол, сануулгад бичсэн хариу · шийдвэрлэвэл бичсэн хүнд мэдэгдэл очно" />
      <Flash ok={sp.ok} error={sp.error} />
      <Tabs cur={st === "open" ? "" : st} href={(k) => q(k, type)} tabs={TABS.map(([k, l]) => [k, l, c[k || "open"] || 0])} />
      <Tabs cur={type} href={(k) => q(st, k)} tabs={TYPES.map(([k, l]) => [k, l, k ? tc[k] || 0 : Object.values(tc).reduce((x, y) => x + y, 0)])} />
      <section className="adm-card flush">
        {rows.length === 0 ? <p className="adm-empty">Мэдэгдэл алга.</p> : (
          <table className="adm-table">
            <thead><tr><th>Төрөл</th><th>Юуны тухай</th><th>Тайлбар</th><th>Бичсэн</th><th>Ирсэн</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const err = r.type === "error";
                return (
                  <tr key={r.id}>
                    <td><Chip tone={TYPE_TONE[r.type]}>{TYPE_LABEL[r.type] || r.type}</Chip></td>
                    <td className="adm-clip adm-wrap">
                      {r.pid ? (
                        <>
                          <Link href={`/post/${r.pid}`} className="adm-strong">{r.title}</Link>
                          <small className="adm-note">
                            {r.kind} · {who({ initial: r.ai, first_name: r.af, email: r.ae })}
                            {r.revision_id && <> · <Link href={`/post/${r.pid}/history`}>редакцын засвар</Link></>}
                          </small>
                        </>
                      ) : r.warning ? (
                        <>
                          <b className="adm-strong">Сануулга</b>
                          <small className="adm-note">“{r.warning}” · {ago(r.warned_at)}</small>
                        </>
                      ) : "—"}
                    </td>
                    <td className="adm-wrap adm-clip">{r.body}{r.note && <small className="adm-note">Хариу: {r.note}</small>}</td>
                    <td><Link href={`/admin/users/${r.uid}`}>{who(r)}</Link></td>
                    <td>{ago(r.created_at)}</td>
                    <td className="adm-right">
                      {r.status === "open" ? (
                        <details className="adm-pop">
                          <summary className="adm-btn teal">Шийдвэрлэх</summary>
                          <form action={decideLogic}>
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="from" value={from} />
                            <input name="note" maxLength={300} placeholder={err ? "Мэдэгдсэн хүнд очих хариу (заавал биш)" : "Бичээчид очих хариу (заавал биш)"} />
                            <button name="op" value="resolved" className="adm-btn teal">{err ? "Засагдсан" : "Хүлээн авах"}</button>
                            <button name="op" value="dismissed" className="adm-btn">{err ? "Алдаа биш" : "Үндэслэлгүй"}</button>
                          </form>
                        </details>
                      ) : (
                        <Chip tone={r.status === "resolved" ? "ok" : "gray"}>
                          {r.status === "resolved" ? (err ? "Засагдсан" : "Хүлээн авсан") : (err ? "Алдаа биш" : "Үндэслэлгүй")}
                        </Chip>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
