import Link from "next/link";
import { sql } from "@/lib/db";
import { requireSection, STATUS_LABELS, ago } from "@/lib/admin";
import { KINDS, QUICK_KINDS } from "@/lib/format";
import { moderatePost } from "../actions";
import Head, { Tabs, Chip, Flash, who, STATUS_TONE } from "../_c/Head";
import { Words, Cats } from "../_c/Queues";
import { TERM_KIND } from "@/lib/terms";

const ALL_KINDS = [...KINDS, ...QUICK_KINDS, "Даалгавар", "Тайлан"];
// Хяналтын жагсаалт энд нэгтгэгдсэн: шинэ үг, ангиллын санал тусдаа таб
const VIEWS = { words: "Шинэ үг", cats: "Ангилал" };
const STATUSES = ["pending", "approved", "published", "rejected", "removed"];

export default async function Content({ searchParams }) {
  const user = await requireSection("content");
  const sp = await searchParams;
  const kind = ALL_KINDS.includes(sp.kind) ? sp.kind : "";
  const view = VIEWS[sp.v] ? sp.v : "";
  const status = STATUSES.includes(sp.status) ? sp.status : "";
  const q = String(sp.q || "");
  const like = `%${q.trim().toLowerCase()}%`;
  const rows = await sql`
    SELECT p.id, p.author_id, p.kind, p.title, p.body, p.status, p.created_at, p.review_note,
      u.initial, u.first_name, u.email,
      (SELECT COUNT(*) FROM sparks WHERE post_id = p.id)::int AS sparks,
      (SELECT COUNT(*) FROM comments WHERE post_id = p.id)::int AS comments
    FROM posts p JOIN users u ON u.id = p.author_id
    WHERE (${kind} = '' OR p.kind = ${kind}) AND (${status} = '' OR p.status = ${status})
      AND (${like} = '%%' OR lower(p.title) LIKE ${like} OR lower(p.body) LIKE ${like})
      AND p.kind <> ${TERM_KIND}
    ORDER BY CASE WHEN ${status} = 'pending' THEN extract(epoch from p.created_at) ELSE -extract(epoch from p.created_at) END
    LIMIT 100`;
  const counts = await sql`SELECT kind, COUNT(*)::int AS n, COUNT(*) FILTER (WHERE status = 'pending')::int AS pending
                           FROM posts WHERE kind <> ${TERM_KIND} GROUP BY kind`;
  const cnt = Object.fromEntries(counts.map((r) => [r.kind, r.n]));
  const total = counts.reduce((a, r) => a + r.n, 0);
  const pendingAll = counts.filter((r) => !kind || r.kind === kind).reduce((a, r) => a + r.pending, 0);
  const [qc] = await sql`SELECT (SELECT COUNT(*) FROM posts WHERE status = 'discussion' AND kind = ${TERM_KIND})::int AS words,
      ((SELECT COUNT(*) FROM category_requests WHERE status = 'pending') + (SELECT COUNT(*) FROM category_reports WHERE status = 'open'))::int AS cats`;
  const qs = (o) => {
    const v = { kind, status, q, ...o };
    return "/admin/content?" + new URLSearchParams(Object.entries(v).filter(([, x]) => x));
  };
  const from = qs({});

  return (
    <>
      <Head user={user} title="Контент" sub="Бүх нийтлэл, асуулт, бодрол, эвент, зарлал" search="/admin/content" q={q} hidden={{ kind, status }} />
      <Flash ok={sp.ok} error={sp.error} />
      <Tabs cur={view ? "v:" + view : kind}
        href={(k) => (k.startsWith("v:") ? `/admin/content?v=${k.slice(2)}` : qs({ kind: k }))}
        tabs={[["", "Бүгд", total], ...ALL_KINDS.map((k) => [k, k, cnt[k] || 0]), ["v:words", VIEWS.words, qc.words], ["v:cats", VIEWS.cats, qc.cats]]} />
      {view === "words" ? <Words user={user} can /> : view === "cats" ? <Cats /> : (<>
      <div className="adm-filters">
        {[["", "Бүх төлөв"], ...STATUSES.map((s) => [s, STATUS_LABELS[s]])].map(([s, l]) => (
          <a key={s || "all"} href={qs({ status: s })} className={status === s ? "on" : ""}>{l}{s === "pending" && pendingAll > 0 && <em>{pendingAll}</em>}</a>
        ))}
      </div>
      <section className="adm-card flush">
        {rows.length === 0 ? <p className="adm-empty">Контент олдсонгүй.</p> : (
          <table className="adm-table">
            <thead><tr><th>Агуулга</th><th>Төрөл</th><th>Зохиогч</th><th>Төлөв</th><th>Оч · Сэтг.</th><th>Огноо</th><th></th></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="adm-strong adm-clip">
                    {["Асуулт", "Бодрол"].includes(p.kind) ? p.body.slice(0, 90) : p.title}
                    {p.review_note && p.status !== "published" && <small className="adm-note">{p.review_note}</small>}
                  </td>
                  <td><Chip>{p.kind}</Chip></td>
                  <td>{who(p)}</td>
                  <td><Chip tone={STATUS_TONE[p.status]}>{STATUS_LABELS[p.status]}</Chip></td>
                  <td>{p.sparks} · {p.comments}</td>
                  <td>{ago(p.created_at)}</td>
                  <td className="adm-right">
                    <span className="adm-acts">
                      <Link href={`/post/${p.id}`} className="adm-btn">Харах</Link>
                      {p.status === "pending" && (p.author_id === user.id
                        ? <Chip tone="gray">Өөрийн · өөр админ</Chip>
                        : <Link href={`/review/${p.id}`} className="adm-btn teal">Засах</Link>)}
                      {p.status === "published" && (
                        <details className="adm-pop">
                          <summary className="adm-btn danger">Нуух</summary>
                          <form action={moderatePost}>
                            <input type="hidden" name="post_id" value={p.id} />
                            <input type="hidden" name="op" value="hide" />
                            <input type="hidden" name="from" value={from} />
                            <input name="note" required maxLength={500} placeholder="Шалтгаан (зохиогчид очно)" />
                            <button className="adm-btn danger">Нуух</button>
                          </form>
                        </details>
                      )}
                      {p.status === "removed" && (
                        <form action={moderatePost}>
                          <input type="hidden" name="post_id" value={p.id} />
                          <input type="hidden" name="op" value="restore" />
                          <input type="hidden" name="from" value={from} />
                          <button className="adm-btn">Сэргээх</button>
                        </form>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {status === "pending" && (
          <p className="adm-banner inset">
            «Засах» дээр дарж засварлаад зөвшөөрөх эсвэл бичээч рүү буцаана. Өөрийн контентыг өөр админ хянана. <Link href="/review/rules">Редакцийн дүрэм →</Link>
          </p>
        )}
      </section>
      </>)}
    </>
  );
}
