import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { getUser, isStaff, displayName } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { levelFor } from "@/lib/levels";
import { fmtEventRange } from "@/lib/events";
import { decidePost } from "../actions";
import { Flash, Chip } from "../../admin/_c/Head";

const CHECK_POST = ["Баримт, эх сурвалж шалгасан", "Зөв бичгийн дүрэм", "Зохиогчийн эрх, хуулбар", "Ангилал, гарчиг тохирсон", "Хэв маяг, ойлгомжтой байдал"];
const CHECK_EVENT = ["Гарчиг, тайлбар ойлгомжтой, алдаагүй", "Огноо, цаг, байршил бүрэн, бодитой", "Хөтөлбөр, бүртгэлийн заавар байгаа", "Дүрэм зөрчөөгүй, спам, реклам биш", "Холбоос, холбоо барих мэдээлэл зөв", "Ижил контент давхардаагүй"];

// Figma: Хяналт · Засварлах самбар (631:502), Эвент/Зарлал хянах цонх (692:496, 700:496)
export default async function ReviewPost({ params, searchParams }) {
  const user = await getUser();
  if (!isStaff(user)) redirect("/review");
  const { id } = await params;
  const { error } = await searchParams;
  const n = Number(id);
  if (!Number.isInteger(n)) notFound();
  const [p] = await sql`
    SELECT p.*, u.initial, u.first_name, u.email, u.account_type,
      COALESCE((SELECT SUM(delta) FROM points_ledger WHERE user_id = u.id), 0)::int AS points,
      (SELECT COUNT(*) FROM posts WHERE author_id = u.id AND status = 'published')::int AS published,
      (SELECT COUNT(*) FROM posts WHERE author_id = u.id AND status = 'rejected')::int AS rejected
    FROM posts p JOIN users u ON u.id = p.author_id WHERE p.id = ${n}`;
  if (!p) notFound();
  if (p.status !== "pending") redirect(`/post/${p.id}`);
  if (p.author_id === user.id) redirect("/review?error=" + encodeURIComponent("Өөрийн контентыг өөр хянагч хянана"));
  const editable = p.kind === "Нийтлэл" || p.kind === "Мэдээ";
  const author = p.first_name ? `${p.initial}.${p.first_name}` : p.email;
  const m = p.meta || {};
  const facts = p.kind === "Эвент"
    ? [["Огноо, цаг", m.starts_at && fmtEventRange(m)], ["Төрөл", m.type], ["Хэлбэр", m.format], ["Байршил", m.location], ["Үргэлжлэх хугацаа", m.duration], ["Тасалбар", m.price], ["Багтаамж", m.capacity], ["Холбоос", m.link]]
    : [["Хүчинтэй хугацаа", m.valid_until], ["Холбоо барих", m.contact], ["Эх сурвалж", m.source]];

  return (
    <form action={decidePost} className="rv-editor">
      <input type="hidden" name="post_id" value={p.id} />
      <header className="rv-top">
        <Link href="/review" className="rv-x" aria-label="Буцах">‹</Link>
        <div>
          <b>{p.title}</b>
          <small>{p.kind} · Бичээч: {author} · Хянагч: {displayName(user)} · {editable ? "Хуулбар засвар (оригинал хадгалагдана)" : "Зөвхөн унших"}</small>
        </div>
        <span className="ss-grow" />
        <button name="decision" value="reject" className="adm-btn danger-solid" formNoValidate>Бичээч рүү буцаах</button>
        <button name="decision" value="approve" className="adm-btn teal">{editable ? "Зөвшөөрч бичээч рүү илгээх" : "Зөвшөөрч нийтлэх"}</button>
      </header>
      <Flash error={error} />
      <div className="rv-cols">
        <div className="rv-mainc">
          {editable ? (
            <>
              <section className="adm-card rv-sec">
                <b className="rv-h">Гарчиг</b>
                <p className="adm-muted">Уншигчийн анхаарлыг татах товч, тод гарчиг байх ёстой.</p>
                <label className="rv-field"><span>Үндсэн гарчиг <i>Заавал</i></span>
                  <input name="title" defaultValue={p.title} required maxLength={200} className="rv-title" />
                </label>
                <label className="rv-field"><span>Дэд гарчиг</span>
                  <textarea name="subtitle" defaultValue={p.subtitle || ""} maxLength={250} rows={2} />
                </label>
              </section>
              <section className="adm-card rv-sec">
                <b className="rv-h">Агуулга</b>
                <p className="adm-muted">Алдааг шууд засаж болно. Бичээчийн анхны хувилбар хадгалагдана.</p>
                <textarea name="body" defaultValue={p.body} required maxLength={20000} rows={22} className="rv-body" />
              </section>
            </>
          ) : (
            <section className="adm-card rv-sec">
              <span className="adm-chips"><Chip tone={p.kind === "Эвент" ? "ok" : "teal"}>{p.kind}</Chip><Chip tone="gray">Илгээсэн {fmtDate(p.created_at)}</Chip></span>
              <h2 className="rv-etitle">{p.title}</h2>
              <div className="rv-facts">
                {facts.filter(([, v]) => v).map(([k, v]) => (
                  <div key={k}><small>{k}</small><b>{String(v)}</b></div>
                ))}
              </div>
              <b className="rv-h">Тайлбар</b>
              <p className="rv-text">{p.body}</p>
              {m.register && (<><b className="rv-h">Бүртгэлийн заавар</b><p className="rv-text">{m.register}</p></>)}
            </section>
          )}
        </div>
        <aside className="rv-side">
          <section className="adm-card">
            <div className="adm-card-head"><b>Бичээч</b></div>
            <p className="rv-who"><Link href={`/u/${p.author_id}`}>{author}</Link></p>
            <p className="adm-muted small">Түвшин {levelFor(p.points).n} · Нийтлэгдсэн {p.published} · Буцаагдсан {p.rejected}</p>
          </section>
          <section className="adm-card">
            <div className="adm-card-head"><b>Хяналтын жагсаалт</b></div>
            {(editable ? CHECK_POST : CHECK_EVENT).map((c) => (
              <label key={c} className="adm-check rv-chk"><input type="checkbox" name="check" value={c} /><span>{c}</span></label>
            ))}
            <p className="adm-muted small">Зөвшөөрөхийн өмнө бүгдийг тэмдэглэнэ.</p>
          </section>
          <section className="adm-card">
            <div className="adm-card-head"><b>Бичээчид үлдээх тайлбар</b></div>
            <textarea name="note" rows={4} maxLength={1000} className="rv-notebox" placeholder="Юуг зассан, эсвэл яагаад буцааж байгаа вэ (буцаахад заавал)…" />
          </section>
          <section className="adm-card">
            <div className="adm-card-head"><b>Хоёр сонголт</b></div>
            <p className="adm-muted small">
              <b>Бичээч рүү буцаах:</b> бичээч засвар хийгээд дахин илгээнэ.<br />
              <b>Зөвшөөрөх:</b> {editable ? "таны засвартай хувилбар бичээч рүү очиж, бичээч өөрөө нийтэлнэ." : "контент шууд нийтлэгдэнэ."}
            </p>
          </section>
        </aside>
      </div>
    </form>
  );
}
