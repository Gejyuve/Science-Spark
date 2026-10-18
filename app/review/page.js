import Link from "next/link";
import { sql } from "@/lib/db";
import { getUser, isStaff, canReview, canApproveEvents } from "@/lib/auth";
import { EVENT_APPROVE_REWARD, ARTICLE_REVIEW_REWARD, EVENT_PENALTY, ARTICLE_PENALTY } from "@/lib/levels";
import { ago } from "@/lib/admin";
import { fmtDate } from "@/lib/format";
import { examState, MAX_FAILS, PASS_SCORE } from "@/lib/exam";
import Head, { Stat, Tabs, Chip, Flash, who } from "../admin/_c/Head";
import { TERM_KIND, canApproveWords, daysLeft, SUPPORT_NEEDED } from "@/lib/terms";
import { crumbs } from "@/lib/tree";
import { decideCategory, resolveCategoryReport } from "../tree/actions";

const GROUPS = { posts: ["Нийтлэл", "Мэдээ"], events: ["Эвент", "Зарлал"] };

export default async function ReviewHome({ searchParams }) {
  const user = await getUser();
  const sp = await searchParams;
  if (isStaff(user) || (sp.t === "words" && canApproveWords(user)) || (canApproveEvents(user) && (sp.t === "events" || !canReview(user)))) return <Queue user={user} sp={sp} />;
  return <Become user={user} sp={sp} />;
}

// Хянагчийн хяналтын жагсаалт (Figma 628:1121, 628:1294)
async function Queue({ user, sp }) {
  const words = canApproveWords(user);
  const staff = isStaff(user);
  const ev = canApproveEvents(user);
  const t = sp.t === "words" ? "words" : !staff ? (ev ? "events" : "words") : sp.t === "cats" ? "cats" : sp.t === "events" ? "events" : "posts";
  const kinds = GROUPS[t] || [];
  const rows = await sql`
    SELECT p.id, p.kind, p.title, p.created_at, p.author_id, u.initial, u.first_name, u.email, u.account_type
    FROM posts p JOIN users u ON u.id = p.author_id
    WHERE p.status = 'pending' AND p.kind = ANY(${kinds})
    ORDER BY p.created_at ASC`;
  const [s] = await sql`SELECT
      (SELECT COUNT(*) FROM posts WHERE status = 'pending' AND author_id <> ${user.id})::int AS pending,
      (SELECT COUNT(*) FROM posts WHERE status = 'pending' AND kind = ANY(${GROUPS.posts}))::int AS posts,
      (SELECT COUNT(*) FROM posts WHERE status = 'pending' AND kind = ANY(${GROUPS.events}))::int AS events,
      (SELECT COUNT(*) FROM posts WHERE status = 'discussion' AND kind = ${TERM_KIND})::int AS words,
      ((SELECT COUNT(*) FROM category_requests WHERE status = 'pending') + (SELECT COUNT(*) FROM category_reports WHERE status = 'open'))::int AS cats,
      (SELECT COUNT(*) FROM posts WHERE reviewer_id = ${user.id} AND reviewed_at > date_trunc('day', now()))::int AS today,
      (SELECT COUNT(*) FROM posts WHERE reviewer_id = ${user.id} AND status IN ('published','approved','rejected'))::int AS total,
      (SELECT COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM reviewed_at - created_at)) / 360) / 10, 0)
         FROM posts WHERE reviewer_id = ${user.id} AND status IN ('published','approved','rejected')
         AND reviewed_at > now() - interval '30 days')::float AS avg_h`;
  return (
    <>
      <Head user={user} tag="Хянагч" title="Хяналтын жагсаалт" sub="Хүлээгдэж буй контент · «Хянах» дээр дарж засварлах самбарыг нээнэ" />
      <Flash ok={sp.ok} error={sp.error} />
      <div className="adm-stats">
        <Stat label="Хүлээгдэж буй" value={staff ? s.pending : s.events} note="таны хянах боломжтой" tone={s.pending ? "warn" : ""} />
        <Stat label="Өнөөдөр хянасан" value={s.today} />
        <Stat label="Дундаж хугацаа" value={`${s.avg_h} цаг`} note="ирснээс шийдвэр хүртэл" />
        <Stat label="Нийт хянасан" value={s.total} />
      </div>
      <Tabs cur={t === "posts" ? "" : t} href={(k) => (k ? `/review?t=${k}` : "/review")}
        tabs={[...(staff ? [["", "Нийтлэл, мэдээ", s.posts]] : []), ...(ev ? [["events", "Эвент, зарлал", s.events]] : []), ["words", "Шинэ үг", s.words], ...(staff ? [["cats", "Ангилал", s.cats]] : [])]} />
      {t === "cats" ? <Cats /> : t === "words" ? <Words user={user} can={words} /> : (
      <section className="adm-card flush">
        <div className="adm-card-head pad"><b>{t === "posts" ? "Нийтлэл, мэдээ" : "Эвент, зарлал"} ({rows.length})</b></div>
        {rows.length === 0 ? (
          <p className="adm-empty">Хүлээгдэж буй зүйл алга ✓</p>
        ) : (
          <table className="adm-table">
            <thead><tr><th>Гарчиг</th><th>{t === "posts" ? "Бичээч" : "Илгээгч"}</th><th>Төрөл</th><th>Илгээсэн</th><th></th></tr></thead>
            <tbody>
              {rows.map((p) => {
                const own = p.author_id === user.id;
                const old = Date.now() - new Date(p.created_at).getTime() > 3 * 86400000;
                return (
                  <tr key={p.id}>
                    <td className="adm-strong adm-clip">{p.title}</td>
                    <td>{who(p)}</td>
                    <td><Chip tone={p.kind === "Эвент" ? "ok" : p.kind === "Зарлал" ? "teal" : ""}>{p.kind}</Chip></td>
                    <td>{old ? <Chip tone="bad">{fmtDate(p.created_at)}</Chip> : fmtDate(p.created_at)}</td>
                    <td className="adm-right">
                      {own ? <Chip tone="gray">Өөрийн · өөр хянагч</Chip> : <Link href={`/review/${p.id}`} className="adm-btn teal">Хянах</Link>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <p className="adm-banner inset">
          {t === "posts"
            ? `Зөвшөөрсөн нийтлэл, мэдээ бүрт +${ARTICLE_REVIEW_REWARD.toLocaleString("en-US")} оч. Хэтэрхий алдаатай нийтлэлийг зөвшөөрсөн нь илэрвэл −${ARTICLE_PENALTY.toLocaleString("en-US")} оч, хянагчийн эрхийг түдгэлзүүлж болно. Өөрийн нийтлэлийг хянах боломжгүй.`
            : `Зөвшөөрсөн эвент, зарлал бүрт +${EVENT_APPROVE_REWARD} оч. Асуудалтай эвент, зарлалыг зөвшөөрсөн нь илэрвэл −${EVENT_PENALTY.toLocaleString("en-US")} оч. Огноо, байршил, холбоосыг заавал шалгаарай.`}
        </p>
      </section>
      )}
    </>
  );
}

// Шинэ үг: хэлэлцүүлэгт байгаа нэр томьёо (Figma 628:1294, 692:746). Түвшин 5+ зөвшөөрнө.
async function Words({ user, can }) {
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
async function Cats() {
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
            <input type="hidden" name="id" value={r.id} />
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
                      <input type="hidden" name="id" value={r.id} />
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

// Түвшин 4+ хэрэглэгч: хянагч болох шалгалт (Figma 628:1218, 709:496)
async function Become({ user, sp }) {
  const st = await examState(user);
  const step = st.state === "pending" ? 2 : 1;
  const steps = [
    ["Шалгалт өгөх", st.state === "pending" ? "Тэнцсэн" : `${st.fails}/${MAX_FAILS} оролдлого ашигласан`],
    ["Редакц шалгах", st.state === "pending" ? "Таны нийтлэл, шалгалтыг хянаж байна" : "Тэнцсэний дараа"],
    ["Хянагчийн эрх", "Редакц эрх нээнэ"],
  ];
  return (
    <>
      <Head user={user} tag="Түвшин 4+" title="Хянагч болох" sub="Хянагч болохыг хүсэж байвал шалгалт өгөөрэй" />
      <Flash ok={sp.ok} error={sp.error} />
      <section className="adm-card">
        <div className="adm-card-head"><b>Хянагчийн шалгалт</b></div>
        <p className="adm-lead">
          Та 4-р түвшинд хүрсэн тул нийтлэл хянах эрх авах боломжтой боллоо. Шалгалтад танд жишээ нийтлэл өгөгдөнө.
          Түүн доторх алдаатай өгүүлбэрүүдийг олж, алдааны төрлийг нь сонгоод, нийтлэлийг юу хийх вэ гэдэг шийдвэрээ гаргана.
        </p>
        <div className="rv-steps">
          {steps.map(([t, d], i) => (
            <div key={t} className={"rv-step" + (i + 1 < step ? " done" : i + 1 === step ? " on" : "")}>
              <span>{i + 1 < step ? "✓" : i + 1}</span>
              <b>{t}</b>
              <small>{d}</small>
            </div>
          ))}
        </div>

        {st.state === "open" && (
          <div className="rv-cta">
            <ul className="rv-rules">
              <li>Тэнцэх босго: {PASS_SCORE} оноо, эцсийн шийдвэр зөв байх.</li>
              <li>Буруу тэмдэглэсэн өгүүлбэр бүр оноо хасна.</li>
              <li>Унавал дараагийн оролдлогод өөр жишээ нийтлэл өгөгдөнө.</li>
              <li>{MAX_FAILS} удаа унавал шалгалт өгөх эрх 1 сар хаагдана. Танд <b>{st.left}</b> оролдлого үлдсэн.</li>
            </ul>
            <Link href="/review/exam" className="adm-btn teal big">{st.fails ? "Дахин шалгалт өгөх" : "Шалгалт эхлүүлэх"}</Link>
          </div>
        )}
        {st.state === "locked" && (
          <p className="adm-banner">
            Та {MAX_FAILS} удаа тэнцээгүй тул шалгалт өгөх эрх <b>{fmtDate(st.unlockAt)}</b> хүртэл хаагдсан. Энэ хугацаанд нийтлэл бичиж, туршлагаа хуримтлуулаарай.
          </p>
        )}
        {st.state === "pending" && (
          <p className="adm-flash ok">
            Баяр хүргэе! Та шалгалтад тэнцлээ. Редакц таны бичсэн нийтлэл, шалгалтын дүнг хянаад хянагчийн эрх нээнэ. Шийдвэрийг мэдэгдлээр хүлээн авна.
          </p>
        )}
        {st.request?.status === "declined" && st.state !== "pending" && (
          <p className="adm-muted small">Өмнөх хүсэлтийн хариу: {st.request.note || "хүлээж аваагүй"}</p>
        )}
      </section>

      {st.history.length > 0 && (
        <section className="adm-card flush">
          <div className="adm-card-head pad"><b>Миний оролдлогууд</b></div>
          <table className="adm-table">
            <thead><tr><th>Огноо</th><th>Оноо</th><th>Дүн</th><th></th></tr></thead>
            <tbody>
              {st.history.map((a) => (
                <tr key={a.id}>
                  <td>{ago(a.created_at)}</td>
                  <td className="adm-strong">{a.score}</td>
                  <td>{a.passed ? <Chip tone="ok">Тэнцсэн</Chip> : <Chip tone="bad">Тэнцээгүй</Chip>}</td>
                  <td className="adm-right"><Link href={`/review/exam/${a.id}`} className="adm-btn">Дэлгэрэнгүй</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
