import Link from "next/link";
import { sql } from "@/lib/db";
import { requireSection, STATUS_LABELS, ago } from "@/lib/admin";
import { KINDS, QUICK_KINDS } from "@/lib/format";
import { moderatePost, checkRevision } from "../actions";
import Head, { Tabs, Chip, Flash, who, STATUS_TONE, Pick } from "../_c/Head";
import { Words, Cats } from "../_c/Queues";
import { TERM_KIND } from "@/lib/terms";

const ALL_KINDS = [...KINDS, ...QUICK_KINDS, "Даалгавар", "Тайлан"];
// Хяналтын жагсаалт энд нэгтгэгдсэн: шинэ үг, ангиллын санал тусдаа таб
const VIEWS = { edits: "Бичээчийн засвар", words: "Шинэ үг", cats: "Ангилал" };
const STATUSES = ["pending", "published", "rejected", "removed", "merged"];
// Эрэмбэ: анхдагч нь хамгийн сүүлд орсон
const SORTS = [["", "Хамгийн сүүлд орсон"], ["sparks", "Хамгийн их оч"], ["comments", "Хамгийн их сэтгэгдэл"], ["views", "Хамгийн их үзэлт"]];

export default async function Content({ searchParams }) {
  const user = await requireSection("content");
  const sp = await searchParams;
  const kind = ALL_KINDS.includes(sp.kind) ? sp.kind : "";
  const view = VIEWS[sp.v] ? sp.v : "";
  const status = STATUSES.includes(sp.status) ? sp.status : "";
  const sort = SORTS.some(([k]) => k && k === sp.sort) ? sp.sort : "";
  const q = String(sp.q || "");
  const like = `%${q.trim().toLowerCase()}%`;
  const rows = await sql`
    SELECT * FROM (
      SELECT p.id, p.author_id, p.kind, p.title, p.body, p.status, p.created_at, p.review_note, p.views,
        u.initial, u.first_name, u.email,
        (SELECT COUNT(*) FROM sparks WHERE post_id = p.id)::int AS sparks,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id)::int AS comments
      FROM posts p JOIN users u ON u.id = p.author_id
      WHERE (${kind} = '' OR p.kind = ${kind}) AND (${status} = '' OR p.status = ${status})
        AND (${like} = '%%' OR lower(p.title) LIKE ${like} OR lower(p.body) LIKE ${like})
        AND p.kind <> ${TERM_KIND}
    ) x
    ORDER BY CASE ${sort} WHEN 'sparks' THEN sparks WHEN 'comments' THEN comments WHEN 'views' THEN views ELSE 0 END DESC, created_at DESC
    LIMIT 100`;
  const counts = await sql`SELECT kind, COUNT(*)::int AS n, COUNT(*) FILTER (WHERE status = 'pending')::int AS pending
                           FROM posts WHERE kind <> ${TERM_KIND} GROUP BY kind`;
  const cnt = Object.fromEntries(counts.map((r) => [r.kind, r.n]));
  const total = counts.reduce((a, r) => a + r.n, 0);
  const pendingAll = counts.filter((r) => !kind || r.kind === kind).reduce((a, r) => a + r.pending, 0);
  const [qc] = await sql`SELECT (SELECT COUNT(*) FROM posts WHERE status = 'discussion' AND kind = ${TERM_KIND})::int AS words,
      (SELECT COUNT(*) FROM post_revisions WHERE role = 'author' AND checked_at IS NULL)::int AS edits,
      ((SELECT COUNT(*) FROM category_requests WHERE status = 'pending') + (SELECT COUNT(*) FROM category_reports WHERE status = 'open'))::int AS cats`;
  const qs = (o) => {
    const v = { kind, status, sort, q, ...o };
    return "/admin/content?" + new URLSearchParams(Object.entries(v).filter(([, x]) => x));
  };
  const from = qs({});

  return (
    <>
      <Head user={user} title="Контент" search="/admin/content" q={q} hidden={{ kind, status, sort }}
        tools={!view && (<>
          <Pick label="Төлөв" badge={status ? 0 : pendingAll}
            options={[["", "Бүх төлөв"], ...STATUSES.map((s) => [s, STATUS_LABELS[s]])].map(([s, l]) => ({ href: qs({ status: s }), label: l, on: status === s, badge: s === "pending" ? pendingAll : 0 }))} />
          <Pick label="Эрэмбэ" options={SORTS.map(([k, l]) => ({ href: qs({ sort: k }), label: l, on: sort === k }))} />
        </>)} />
      <Flash ok={sp.ok} error={sp.error} />
      <Tabs cur={view ? "v:" + view : kind}
        href={(k) => (k.startsWith("v:") ? `/admin/content?v=${k.slice(2)}` : qs({ kind: k }))}
        tabs={[["", "Бүгд", total], ...ALL_KINDS.map((k) => [k, k, cnt[k] || 0]), ["v:edits", VIEWS.edits, qc.edits], ["v:words", VIEWS.words, qc.words], ["v:cats", VIEWS.cats, qc.cats]]} />
      {view === "edits" ? <Edits /> : view === "words" ? <Words user={user} can /> : view === "cats" ? <Cats /> : (<>
      <section className="adm-card flush">
        {rows.length === 0 ? <p className="adm-empty">Контент олдсонгүй.</p> : (
          <table className="adm-table">
            <thead><tr><th>Агуулга</th><th>Төрөл</th><th>Зохиогч</th><th>Төлөв</th><th>Оч · Сэтг. · Үзэлт</th><th>Огноо</th><th></th></tr></thead>
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
                  <td>{p.sparks} · {p.comments} · {p.views || 0}</td>
                  <td>{ago(p.created_at)}</td>
                  <td className="adm-right">
                    <span className="adm-acts">
                      <Link href={`/post/${p.id}`} className="adm-btn">Харах</Link>
                      {p.status === "pending" && (p.author_id === user.id
                        ? <Chip tone="gray">Өөрийн · өөр админ</Chip>
                        : <Link href={`/review/${p.id}`} className="adm-btn teal">Засах</Link>)}
                      {p.status === "published" && <Link href={`/post/${p.id}/edit`} className="adm-btn teal">Засах</Link>}
                      {p.status === "published" && p.kind === "Нийтлэл" && <Link href={`/admin/content/merge?a=${p.id}`} className="adm-btn">Нэгтгэх</Link>}
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
                      {user.role === "superadmin" && (
                        <details className="adm-pop">
                          <summary className="adm-btn danger">Устгах</summary>
                          <form action={moderatePost}>
                            <input type="hidden" name="post_id" value={p.id} />
                            <input type="hidden" name="op" value="delete" />
                            <input type="hidden" name="from" value={from} />
                            <input name="note" maxLength={500} placeholder="Шалтгаан (заавал биш, зохиогчид очно)" />
                            <span className="adm-muted small">Нэг мөсөн устгана: сэтгэгдэл, оч, түүх нь хамт устана. Буцаах боломжгүй.</span>
                            <button className="adm-btn danger">Нэг мөсөн устгах</button>
                          </form>
                        </details>
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

// Бичээч өөрөө оруулсан засварууд: редакц шалгаад тэмдэглэнэ
async function Edits() {
  const rows = await sql`
    SELECT r.id, r.post_id, r.note, r.created_at, p.kind, p.title, u.initial, u.first_name, u.email
    FROM post_revisions r JOIN posts p ON p.id = r.post_id LEFT JOIN users u ON u.id = r.editor_id
    WHERE r.role = 'author' AND r.checked_at IS NULL ORDER BY r.created_at ASC LIMIT 100`;
  return (
    <section className="adm-card flush">
      <div className="adm-card-head pad"><b>Бичээчийн засвар ({rows.length})</b></div>
      {rows.length === 0 ? <p className="adm-empty">Шалгах засвар алга ✓</p> : (
        <table className="adm-table">
          <thead><tr><th>Контент</th><th>Төрөл</th><th>Бичээч</th><th>Тайлбар</th><th>Хэзээ</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="adm-strong adm-clip">{r.title}</td>
                <td><Chip>{r.kind}</Chip></td>
                <td>{who(r)}</td>
                <td className="adm-clip">{r.note || "—"}</td>
                <td>{ago(r.created_at)}</td>
                <td className="adm-right">
                  <span className="adm-acts">
                    <Link href={`/post/${r.post_id}/history`} className="adm-btn">Түүх харах</Link>
                    <Link href={`/post/${r.post_id}/edit`} className="adm-btn">Засах</Link>
                    <form action={checkRevision}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="adm-btn teal">Шалгасан</button>
                    </form>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="adm-banner inset">Бичээч нийтлэгдсэн контентдоо засвар оруулахад шууд хэрэгжиж, энд шалгуулахаар ирнэ. Асуудалтай бол засах эсвэл нууна уу.</p>
    </section>
  );
}
