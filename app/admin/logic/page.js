import Link from "next/link";
import { sql } from "@/lib/db";
import { requireSection, ago } from "@/lib/admin";
import { decideLogic } from "../actions";
import Head, { Tabs, Chip, Flash, who } from "../_c/Head";

const TABS = [["", "Шийдвэрлээгүй"], ["resolved", "Засагдсан"], ["dismissed", "Алдаа биш"]];

// Хэрэглэгчдийн мэдэгдсэн логик, баримтын алдаа
export default async function Logic({ searchParams }) {
  const user = await requireSection("logic");
  const sp = await searchParams;
  const st = sp.s === "resolved" || sp.s === "dismissed" ? sp.s : "open";
  const rows = await sql`
    SELECT r.id, r.body, r.status, r.note, r.created_at, r.resolved_at, p.id AS pid, p.title, p.kind,
      u.initial, u.first_name, u.email, a.initial AS ai, a.first_name AS af, a.email AS ae
    FROM logic_reports r JOIN posts p ON p.id = r.post_id JOIN users u ON u.id = r.user_id JOIN users a ON a.id = p.author_id
    WHERE r.status = ${st}
    ORDER BY CASE WHEN ${st} = 'open' THEN r.created_at END ASC, r.created_at DESC LIMIT 100`;
  const counts = await sql`SELECT status, COUNT(*)::int AS n FROM logic_reports GROUP BY status`;
  const c = Object.fromEntries(counts.map((x) => [x.status, x.n]));
  const from = `/admin/logic${st === "open" ? "" : `?s=${st}`}`;
  return (
    <>
      <Head user={user} title="Логик алдаа" sub="Уншигчдын мэдэгдсэн логик, баримтын алдаа · шийдвэрлэвэл мэдэгдсэн хүнд мэдэгдэл очно" />
      <Flash ok={sp.ok} error={sp.error} />
      <Tabs cur={st === "open" ? "" : st} href={(k) => `/admin/logic${k ? `?s=${k}` : ""}`} tabs={TABS.map(([k, l]) => [k, l, c[k || "open"] || 0])} />
      <section className="adm-card flush">
        {rows.length === 0 ? <p className="adm-empty">Мэдэгдэл алга.</p> : (
          <table className="adm-table">
            <thead><tr><th>Контент</th><th>Алдааны тайлбар</th><th>Мэдэгдсэн</th><th>Ирсэн</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="adm-clip adm-wrap">
                    <Link href={`/post/${r.pid}`} className="adm-strong">{r.title}</Link>
                    <small className="adm-note">{r.kind} · {who({ initial: r.ai, first_name: r.af, email: r.ae })}</small>
                  </td>
                  <td className="adm-wrap adm-clip">{r.body}{r.note && <small className="adm-note">Хариу: {r.note}</small>}</td>
                  <td>{who(r)}</td>
                  <td>{ago(r.created_at)}</td>
                  <td className="adm-right">
                    {r.status === "open" ? (
                      <details className="adm-pop">
                        <summary className="adm-btn teal">Шийдвэрлэх</summary>
                        <form action={decideLogic}>
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="from" value={from} />
                          <input name="note" maxLength={300} placeholder="Мэдэгдсэн хүнд очих хариу (заавал биш)" />
                          <button name="op" value="resolved" className="adm-btn teal">Засагдсан</button>
                          <button name="op" value="dismissed" className="adm-btn">Алдаа биш</button>
                        </form>
                      </details>
                    ) : (
                      <Chip tone={r.status === "resolved" ? "ok" : "gray"}>{r.status === "resolved" ? "Засагдсан" : "Алдаа биш"}</Chip>
                    )}
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
