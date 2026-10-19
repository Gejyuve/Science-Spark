import Link from "next/link";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { requireSection, ago } from "@/lib/admin";
import Head, { Flash, who } from "../../_c/Head";

// Төстэй агуулгатай хоёр нийтлэлийг нэгтгэх: эхлээд нэгтгэх нийтлэлээ сонгоно, дараа нь бичих самбар нээгдэнэ
export default async function Merge({ searchParams }) {
  const user = await requireSection("content");
  const sp = await searchParams;
  const a = Number(sp.a);
  if (Number.isInteger(a) && Number(sp.b) > 0) redirect(`/post/${a}/merge?b=${Number(sp.b)}`);
  const [A] = Number.isInteger(a) && a > 0
    ? await sql`SELECT p.*, u.initial, u.first_name, u.email FROM posts p JOIN users u ON u.id = p.author_id
                WHERE p.id = ${a} AND p.status = 'published' AND p.kind = 'Нийтлэл'`
    : [];
  const q = String(sp.q || "");
  const like = `%${q.trim().toLowerCase()}%`;
  const cands = A
    ? await sql`SELECT p.id, p.title, p.created_at, u.initial, u.first_name, u.email FROM posts p JOIN users u ON u.id = p.author_id
                WHERE p.status = 'published' AND p.kind = 'Нийтлэл' AND p.id <> ${A.id}
                  AND (${like} = '%%' OR lower(p.title) LIKE ${like} OR lower(p.body) LIKE ${like})
                ORDER BY p.created_at DESC LIMIT 30`
    : [];

  return (
    <>
      <Head user={user} title="Нийтлэл нэгтгэх" sub={<Link href="/admin/content">← Контент</Link>} />
      <Flash ok={sp.ok} error={sp.error} />
      <p className="adm-banner">Төстэй агуулгатай хоёр нийтлэлийг нэгтгэнэ. Нэгтгэх нийтлэлээ сонгоход бичих самбар нээгдэж, сонгосон нийтлэл үндсэн нийтлэлийн төгсгөлөөс үргэлжилнэ. Бичээчдийн дарааллыг тэнд сонгоно.</p>
      {!A ? (
        <section className="adm-card">
          <form method="get" className="adm-inline">
            <input name="a" inputMode="numeric" placeholder="Үндсэн нийтлэлийн ID" required />
            <button className="adm-btn dark">Сонгох</button>
          </form>
          <p className="adm-muted small">Зөвхөн нийтлэгдсэн «Нийтлэл»-ийг нэгтгэнэ. Контент хуудасны мөрөн дээрх «Нэгтгэх» товчийг дарж болно.</p>
        </section>
      ) : (
        <>
          <section className="adm-card">
            <div className="adm-card-head"><b>Үндсэн нийтлэл</b><span className="ss-grow" /><Link href={`/post/${A.id}`} className="adm-link">Харах →</Link></div>
            <p className="adm-strong">{A.title}</p>
            <p className="adm-muted small">{who(A)} · {ago(A.created_at)}</p>
          </section>
          <section className="adm-card flush">
            <div className="adm-card-head pad"><b>Нэгтгэх нийтлэлээ сонгоно уу</b><span className="ss-grow" />
              <form method="get" className="adm-inline"><input type="hidden" name="a" value={A.id} /><input name="q" defaultValue={q} placeholder="Хайх…" /><button className="adm-btn">Хайх</button></form>
            </div>
            {cands.length === 0 ? <p className="adm-empty">Нийтлэгдсэн өөр нийтлэл олдсонгүй.</p> : (
              <table className="adm-table">
                <tbody>
                  {cands.map((p) => (
                    <tr key={p.id}>
                      <td className="adm-strong adm-clip">{p.title}</td>
                      <td>{who(p)}</td>
                      <td>{ago(p.created_at)}</td>
                      <td className="adm-right"><Link href={`/post/${A.id}/merge?b=${p.id}`} className="adm-btn teal">Сонгох</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </>
  );
}
