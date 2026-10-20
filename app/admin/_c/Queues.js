import Link from "next/link";
import { sql } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { Chip, who } from "./Head";
import { TERM_KIND, daysLeft, SUPPORT_NEEDED } from "@/lib/terms";
import { crumbs } from "@/lib/tree";
import { decideCategory, resolveCategoryReport } from "../../tree/actions";

// Шинэ үг: хэлэлцүүлэгт байгаа нэр томьёо (Figma 628:1294, 692:746). Түвшин 5+ зөвшөөрнө.
export async function Words({ user, can }) {
  const rows = await sql`
    SELECT p.id, p.title, p.meta, p.created_at, p.author_id, u.initial, u.first_name, u.email, u.account_type,
           (SELECT COUNT(*) FROM term_votes WHERE post_id = p.id AND vote = 1)::int AS up,
           (SELECT COUNT(*) FROM term_votes WHERE post_id = p.id AND vote = -1)::int AS down,
           (SELECT COUNT(*) FROM comments WHERE post_id = p.id)::int AS comments
    FROM posts p JOIN users u ON u.id = p.author_id
    WHERE p.status = 'discussion' AND p.kind = ${TERM_KIND}
    ORDER BY p.created_at ASC`;
  return (
    <section className="adm-card flush">
      <div className="adm-card-head pad"><b>Шинэ үг ({rows.length})</b></div>
      {rows.length === 0 ? (
        <p className="adm-empty">Хэлэлцэж буй үг алга ✓</p>
      ) : (
        <table className="adm-table">
          <thead><tr><th>Нэр томьёо</th><th>Дэвшүүлсэн</th><th>Дэмжлэг</th><th>Хэлэлцүүлэг</th><th></th></tr></thead>
          <tbody>
            {rows.map((p) => {
              const total = p.up + p.down;
              const pct = total ? Math.round((100 * p.up) / total) : 0;
              const left = daysLeft(p.meta, p.created_at);
              const own = p.author_id === user.id;
              return (
                <tr key={p.id}>
                  <td className="adm-strong adm-clip">{p.title} <span className="adm-muted small">· {p.meta?.en}</span></td>
                  <td>{who(p)}</td>
                  <td><Chip tone={total && pct >= SUPPORT_NEEDED * 100 ? "ok" : total ? "bad" : "gray"}>{total ? `${pct}% · ${p.up}/${total}` : "Санал алга"}</Chip></td>
                  <td>{left ? `${left} хоног үлдсэн` : <Chip tone="teal">Дууссан</Chip>} · {p.comments} сэтгэгдэл</td>
                  <td className="adm-right">
                    {own ? <Chip tone="gray">Өөрийн</Chip> : can ? <Link href={`/review/word/${p.id}`} className="adm-btn teal">Хянах</Link> : <Chip tone="gray">Түвшин 5+</Chip>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <p className="adm-banner inset">
        Шинэ үгийг Түвшин 5+ хэрэглэгч ба редакц зөвшөөрнө. Хэлэлцүүлэгт {Math.round(SUPPORT_NEEDED * 100)}%-иас дээш дэмжлэг авсан, орчуулга, эх сурвалж нь зөв үгийг батлаарай. Батлагдвал нэмсэн хүнд +30 оч.
      </p>
    </section>
  );
}

// Мод: ангиллын санал ба алдааны мэдэгдэл (редакц)
export async function Cats() {
  const reqs = await sql`SELECT r.*, u.initial, u.first_name, u.email, u.account_type FROM category_requests r JOIN users u ON u.id = r.user_id
                         WHERE r.status = 'pending' ORDER BY r.created_at ASC`;
  const reps = await sql`SELECT r.*, u.initial, u.first_name, u.email, u.account_type FROM category_reports r JOIN users u ON u.id = r.user_id
                         WHERE r.status = 'open' ORDER BY r.created_at ASC`;
  const where = (p) => crumbs(p).map((c) => c.name).join(" › ") || "Шинжлэх ухаан";
  return (
    <>
      <section className="adm-card flush">
        <div className="adm-card-head pad"><b>Шинэ ангиллын санал ({reqs.length})</b></div>
        {reqs.length === 0 ? <p className="adm-empty">Хүлээгдэж буй санал алга ✓</p> : reqs.map((r) => (
          <form key={r.id} action={decideCategory} className="cq-item">
            <input type="hidden" name="rid" value={r.id} />
            <input type="hidden" name="parent" value={r.parent} />
            <p className="adm-muted small">{who(r)} · {fmtDate(r.created_at)} · Байрлал: <b>{where(r.parent)}</b></p>
            <div className="cq-grid">
              <label><span>Нэр</span><input name="name" defaultValue={r.name} maxLength={60} /></label>
              <label><span>Англи нэр</span><input name="en" defaultValue={r.en} maxLength={80} /></label>
            </div>
            <p className="cq-note">{r.note}</p>
            {r.examples && <p className="adm-muted small">Жишээ сэдэв: {r.examples}</p>}
            {r.source && <p className="adm-muted small"><a href={r.source} target="_blank" rel="noopener noreferrer nofollow">{r.source}</a></p>}
            <div className="cq-acts">
              <input name="note" placeholder="Тайлбар (татгалзвал заавал)" maxLength={500} />
              <button name="decision" value="decline" className="adm-btn danger">Татгалзах</button>
              <button name="decision" value="approve" className="adm-btn teal">Батлаад нэмэх</button>
            </div>
          </form>
        ))}
      </section>
      <section className="adm-card flush">
        <div className="adm-card-head pad"><b>Ангиллын логик алдааны мэдэгдэл ({reps.length})</b></div>
        {reps.length === 0 ? <p className="adm-empty">Нээлттэй мэдэгдэл алга ✓</p> : (
          <table className="adm-table">
            <thead><tr><th>Ангилал</th><th>Төрөл</th><th>Тайлбар</th><th>Илгээгч</th><th></th></tr></thead>
            <tbody>
              {reps.map((r) => (
                <tr key={r.id}>
                  <td className="adm-strong">{r.path ? where(r.path) : "—"}</td>
                  <td><Chip tone="warn">{r.issue}</Chip></td>
                  <td className="adm-clip">{r.body}</td>
                  <td>{who(r)}</td>
                  <td className="adm-right">
                    <form action={resolveCategoryReport} className="adm-acts">
                      <input type="hidden" name="rid" value={r.id} />
                      <button name="op" value="dismissed" className="adm-btn">Хаах</button>
                      <button name="op" value="resolved" className="adm-btn teal">Зассан</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="adm-banner inset">Ангиллыг засах, зөөх, устгах шаардлагатай бол хөгжүүлэгчид мэдэгдэнэ. Шинэ ангиллыг энд батлахад Мод-нд шууд нэмэгдэнэ.</p>
      </section>
    </>
  );
}
