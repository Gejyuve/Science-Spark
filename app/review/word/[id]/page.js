import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { levelFor } from "@/lib/levels";
import { TERM_KIND, DEF_MAX, SUPPORT_NEEDED, canApproveWords, daysLeft, synonyms, similarity } from "@/lib/terms";
import { decideTerm } from "../../../dict/actions";
import { Flash, Chip } from "../../../admin/_c/Head";
import { Avatar } from "../../../components/Bits";
import { TermCard } from "../../../components/DictAdd";

const CHECK = ["Орчуулга, эх хэл зөв", "Тайлбар шинжлэх ухаанаар үнэн, ойлгомжтой", "Эх сурвалж найдвартай", "Кирилл бичгийн алдаагүй", "Давхардал, өөр нэршил зөв"];

// Figma 692:746 · Хяналт · Шинэ үг хянах цонх (засварлаж болно)
export default async function ReviewWord({ params, searchParams }) {
  const user = await getUser();
  if (!canApproveWords(user)) redirect("/review");
  const { id } = await params;
  const { error, ok } = await searchParams;
  const n = Number(id);
  if (!Number.isInteger(n)) notFound();
  const [p] = await sql`
    SELECT p.*, u.initial, u.first_name, u.email, u.avatar_id AS avatar,
      COALESCE((SELECT SUM(delta) FROM points_ledger WHERE user_id = u.id), 0)::int AS points,
      (SELECT COUNT(*) FROM posts WHERE author_id = u.id AND kind = ${TERM_KIND} AND status = 'published')::int AS ok_words,
      (SELECT COUNT(*) FROM posts WHERE author_id = u.id AND kind = ${TERM_KIND} AND status = 'rejected')::int AS no_words,
      (SELECT COUNT(*) FROM term_votes WHERE post_id = p.id AND vote = 1)::int AS up,
      (SELECT COUNT(*) FROM term_votes WHERE post_id = p.id AND vote = -1)::int AS down
    FROM posts p JOIN users u ON u.id = p.author_id WHERE p.id = ${n} AND p.kind = ${TERM_KIND}`;
  if (!p) notFound();
  if (!["discussion", "pending"].includes(p.status)) redirect(`/post/${p.id}`);
  if (p.author_id === user.id) redirect("/review?t=words&error=" + encodeURIComponent("Өөрийн нэмсэн үгийг өөр хүн зөвшөөрнө"));
  const m = p.meta || {};
  const queue = await sql`SELECT id FROM posts WHERE kind = ${TERM_KIND} AND status = 'discussion' ORDER BY created_at ASC`;
  const pos = queue.findIndex((x) => x.id === p.id) + 1;
  // Төстэй үг хайх (батлагдсан үгс дотроос)
  const others = await sql`SELECT id, title, meta FROM posts WHERE kind = ${TERM_KIND} AND status = 'published' AND id <> ${p.id}`;
  let best = null;
  for (const o of others) {
    const sc = Math.max(similarity(o.title, p.title), m.en && o.meta?.en ? similarity(o.meta.en, m.en) * 0.95 : 0);
    if (!best || sc > best.sc) best = { ...o, sc };
  }
  if (best && best.sc < 0.6) best = null;
  const total = p.up + p.down;
  const pct = total ? Math.round((100 * p.up) / total) : 0;
  const left = daysLeft(m, p.created_at);
  const lv = levelFor(p.points);
  const preview = { title: p.title, en: m.en, ru: m.ru, la: m.la, body: p.body, synonyms: synonyms(m).join(", "), source: m.source };

  return (
    <form action={decideTerm} className="rv-editor wd">
      <input type="hidden" name="post_id" value={p.id} />
      <Link href="/review?t=words" className="rv-backlink">← Шинэ үгийн жагсаалт</Link>
      <Flash ok={ok} error={error} />
      <div className="rv-cols">
        <div className="rv-mainc">
          <section className="adm-card wd-card">
            <div className="wd-head">
              <b>Шинэ үг хянах · засварлах</b>
              <small>Илгээгчийн оруулсан тайлбарыг шалгаж, шаардлагатай бол засварлаад зөвшөөрнө.</small>
            </div>
            <div className="tm-grid">
              <label><span>Нэр томьёо <i>*</i></span><input name="title" required maxLength={80} defaultValue={p.title} /></label>
              <label><span>Англи орчуулга <i>*</i></span><input name="en" required maxLength={120} defaultValue={m.en || ""} /></label>
              <label><span>Орос орчуулга <em>заавал биш</em></span><input name="ru" maxLength={120} defaultValue={m.ru || ""} /></label>
              <label><span>Латин нэршил <em>заавал биш</em></span><input name="la" maxLength={120} defaultValue={m.la || ""} /></label>
              <label className="wide"><span>Тайлбар <i>*</i></span>
                <span className="tm-area"><textarea name="body" required maxLength={DEF_MAX} rows={4} defaultValue={p.body} /><small>{p.body.length} / {DEF_MAX}</small></span></label>
              <label><span>Ижил утгатай өөр монгол үг <em>заавал биш</em></span><input name="synonyms" maxLength={300} defaultValue={synonyms(m).join(", ")} /></label>
              <label><span>Эх сурвалжийн линк <em>заавал биш</em></span>
                <span className="tm-link"><img className="ic" src="/icons/f_link.svg" width={16} height={16} alt="" /><input name="source" type="url" maxLength={300} defaultValue={m.source || ""} /></span></label>
              <label className="wide"><span>Ном, бусад эх сурвалж <em>заавал биш</em></span><input name="refs" maxLength={300} defaultValue={m.refs || ""} placeholder="Жишээ: Б. Ганхуяг. Математикийн үндэс. 2019" /></label>
            </div>
            <div className="tm-preview">
              <b>Нийтлэлд ингэж харагдана</b>
              <TermCard v={preview} />
            </div>
            <div className="tm-foot">
              <small>Засвар хийсэн бол илгээгчид мэдэгдэнэ.</small>
              <span className="ss-grow" />
              <Link href={`/post/${p.id}`} className="tm-btn ghost">Хэлэлцүүлэг харах</Link>
              <button name="action" value="save" className="tm-btn" formNoValidate>Засвар хадгалах</button>
            </div>
          </section>
        </div>
        <aside className="rv-side">
          <section className="adm-card">
            <span className="adm-chips"><Chip tone="teal">Шинэ үг</Chip><Chip tone="gray">Түвшин 5+ зөвшөөрнө</Chip></span>
            <h2 className="wd-title">Редакцийн самбар</h2>
            <p className="adm-muted small">Дараалал {pos || 1} / {Math.max(queue.length, 1)} · Илгээсэн {fmtDate(p.created_at)}</p>
            <div className="wd-who">
              <Avatar user={{ id: p.author_id, first_name: p.first_name, avatar: p.avatar }} size={36} />
              <span>
                <Link href={`/u/${p.author_id}`}><b>{p.first_name ? `${p.initial}.${p.first_name}` : p.email}</b></Link>
                <small>Түвшин {lv.n} · {p.ok_words} үг зөвшөөрөгдсөн, {p.no_words} татгалзсан</small>
              </span>
            </div>
          </section>
          <section className="adm-card">
            <div className="adm-card-head"><b>Хэлэлцүүлэг</b></div>
            <p className="wd-support">
              <b className={total && pct >= SUPPORT_NEEDED * 100 ? "ok" : "bad"}>{total ? `${pct}%` : "—"}</b>
              <span>Дэмжсэн {p.up} · Эсрэг {p.down}<br />{left ? `${left} хоног үлдсэн` : "Хугацаа дууссан"}</span>
            </p>
            <span className="tl-bar"><i style={{ width: `${pct}%` }} /></span>
            {total > 0 && pct < SUPPORT_NEEDED * 100 && <p className="adm-muted small">Батлагдахад {Math.round(SUPPORT_NEEDED * 100)}% дэмжлэг хэрэгтэй.</p>}
          </section>
          {best && (
            <p className="wd-warn">
              <b>⚠ Төстэй үг олдлоо ({Math.round(best.sc * 100)}%)</b>
              <span>«<Link href={`/post/${best.id}`}>{best.title}</Link>» Толь-д бүртгэлтэй. Давхардал бол нэрийг засаад, «Ижил утгатай» болгон нэгтгэнэ үү.</span>
            </p>
          )}
          <section className="adm-card">
            <div className="adm-card-head"><b>Шалгах хуудас</b></div>
            {CHECK.map((c) => (
              <label key={c} className="adm-check rv-chk"><input type="checkbox" name="check" value={c} required /><span>{c}</span></label>
            ))}
          </section>
          <section className="adm-card">
            <div className="adm-card-head"><b>Буцаах тайлбар</b></div>
            <textarea name="note" rows={3} maxLength={500} className="rv-notebox" placeholder="Буцаах шалтгаанаа бичнэ үү (илгээгчид харагдана)…" />
            <p className="adm-muted small">Буцаахад заавал бичнэ</p>
          </section>
          <div className="rv-decide">
            <button name="action" value="reject" className="adm-btn danger-solid big" formNoValidate>↶ Буцаах</button>
            <button name="action" value="approve" className="adm-btn teal big">✓ Зөвшөөрөх</button>
          </div>
        </aside>
      </div>
    </form>
  );
}
