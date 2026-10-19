import Link from "next/link";
import { sql } from "@/lib/db";
import { requireSection, ago } from "@/lib/admin";
import { mergePosts } from "../../actions";
import Head, { Chip, Flash, who } from "../../_c/Head";

const one = async (id) => (Number.isInteger(id) && id > 0
  ? (await sql`SELECT p.*, u.initial, u.first_name, u.email, (SELECT COUNT(*) FROM comments WHERE post_id = p.id)::int AS comments
               FROM posts p JOIN users u ON u.id = p.author_id WHERE p.id = ${id} AND p.status = 'published'`)[0]
  : null);

// Төстэй агуулгатай хоёр контентыг нэгтгэх (редакц)
export default async function Merge({ searchParams }) {
  const user = await requireSection("content");
  const sp = await searchParams;
  const A = await one(Number(sp.a));
  const B = A ? await one(Number(sp.b)) : null;
  const q = String(sp.q || "");
  const like = `%${q.trim().toLowerCase()}%`;
  const cands = A && !B
    ? await sql`SELECT p.id, p.title, p.body, p.kind, p.created_at, u.initial, u.first_name, u.email FROM posts p JOIN users u ON u.id = p.author_id
                WHERE p.status = 'published' AND p.kind = ${A.kind} AND p.id <> ${A.id}
                  AND (${like} = '%%' OR lower(p.title) LIKE ${like} OR lower(p.body) LIKE ${like})
                ORDER BY p.created_at DESC LIMIT 30`
    : [];
  const label = (p) => (["Асуулт", "Бодрол"].includes(p.kind) ? p.body.slice(0, 90) : p.title);
  const card = (p, t) => (
    <section className="adm-card">
      <div className="adm-card-head"><b>{t}</b><span className="ss-grow" /><Link href={`/post/${p.id}`} className="adm-link">Харах →</Link></div>
      <p className="adm-strong">{label(p)}</p>
      <p className="adm-muted small">{p.kind} · {who(p)} · {ago(p.created_at)} · {p.comments} сэтгэгдэл</p>
    </section>
  );

  return (
    <>
      <Head user={user} title="Контент нэгтгэх" sub={<Link href="/admin/content">← Контент</Link>} />
      <Flash ok={sp.ok} error={sp.error} />
      <p className="adm-banner">Төстэй агуулгатай хоёр контентыг нэгтгэнэ. Хоёр дахь контентын сэтгэгдэл үндсэн контент руу шилжиж, түүний бичээч, хянагчдын нэр бичсэн, хянасан дарааллаараа үндсэн контентод нэмэгдэнэ. Хоёр дахь контентын холбоос үндсэн контент руу чиглэнэ.</p>
      {!A ? (
        <section className="adm-card">
          <form method="get" className="adm-inline">
            <input name="a" inputMode="numeric" placeholder="Үндсэн контентын ID" required />
            <button className="adm-btn dark">Сонгох</button>
          </form>
          <p className="adm-muted small">Эсвэл Контент хуудасны мөрөн дээрх «Нэгтгэх» товчийг дарна уу.</p>
        </section>
      ) : !B ? (
        <>
          {card(A, "Үндсэн контент")}
          <section className="adm-card flush">
            <div className="adm-card-head pad"><b>Нэгтгэх контентоо сонгоно уу ({A.kind})</b><span className="ss-grow" />
              <form method="get" className="adm-inline"><input type="hidden" name="a" value={A.id} /><input name="q" defaultValue={q} placeholder="Хайх…" /><button className="adm-btn">Хайх</button></form>
            </div>
            {cands.length === 0 ? <p className="adm-empty">Ижил төрлийн нийтлэгдсэн контент олдсонгүй.</p> : (
              <table className="adm-table">
                <tbody>
                  {cands.map((p) => (
                    <tr key={p.id}>
                      <td className="adm-strong adm-clip">{label(p)}</td>
                      <td>{who(p)}</td>
                      <td>{ago(p.created_at)}</td>
                      <td className="adm-right"><Link href={`/admin/content/merge?a=${A.id}&b=${p.id}`} className="adm-btn teal">Сонгох</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      ) : (
        <>
          <div className="adm-grid2">{card(A, "Үндсэн контент")}{card(B, "Нэгтгэх контент")}</div>
          <section className="adm-card">
            <div className="adm-card-head"><b>Нэгтгэсэн хувилбар</b><span className="ss-grow" /><Link href={`/admin/content/merge?a=${A.id}`} className="adm-link">Өөр контент сонгох</Link></div>
            <form action={mergePosts} className="adm-form">
              <input type="hidden" name="a" value={A.id} />
              <input type="hidden" name="b" value={B.id} />
              <label>Гарчиг<input name="title" defaultValue={A.title} maxLength={200} required /></label>
              {A.subtitle != null && <label>Дэд гарчиг<input name="subtitle" defaultValue={A.subtitle || ""} maxLength={250} /></label>}
              <label>Агуулга (хоёр контентын агуулгыг нэгтгэж засна уу)
                <textarea name="body" rows={18} required maxLength={40000} defaultValue={`${A.body}\n\n${B.body}`} />
              </label>
              <label>Тайлбар (засварын түүхэнд харагдана)<input name="note" maxLength={300} placeholder="Жишээ нь: давхардсан хоёр мэдээг нэгтгэв" /></label>
              <button className="adm-btn dark">Нэгтгэх</button>
            </form>
          </section>
        </>
      )}
    </>
  );
}
