import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { requireSection, ago, STATUS_LABELS } from "@/lib/admin";
import { fmtDate } from "@/lib/format";
import { levelFor, REVIEWER_LEVEL } from "@/lib/levels";
import { SAMPLES, sentences, ERROR_LABEL, DECISION_LABEL, PASS_SCORE } from "@/lib/exam";
import { decideRequest } from "../../actions";
import Head, { Chip, Flash, who, STATUS_TONE } from "../../_c/Head";
import { Avatar } from "../../../components/Bits";

// Figma 627:502 · Хянагчийн хүсэлт · Профайл (уулзалтгүй)
export default async function RequestDetail({ params, searchParams }) {
  const me = await requireSection("requests");
  const { id } = await params;
  const sp = await searchParams;
  const n = Number(id);
  if (!Number.isInteger(n)) notFound();
  const [r] = await sql`
    SELECT r.*, u.id AS uid, u.email, u.initial, u.first_name, u.surname, u.role, u.restricted_at, u.created_at AS joined,
      COALESCE((SELECT SUM(delta) FROM points_ledger WHERE user_id = u.id), 0)::int AS points,
      (SELECT COUNT(*) FROM follows WHERE followee_id = u.id)::int AS followers,
      (SELECT COUNT(*) FROM comments WHERE author_id = u.id)::int AS comments,
      d.initial AS di, d.first_name AS df, d.email AS de
    FROM reviewer_requests r JOIN users u ON u.id = r.user_id LEFT JOIN users d ON d.id = r.decided_by
    WHERE r.id = ${n}`;
  if (!r) notFound();
  const posts = await sql`SELECT id, kind, title, status, review_note, created_at FROM posts WHERE author_id = ${r.uid} ORDER BY created_at DESC LIMIT 30`;
  const attempts = await sql`SELECT id, sample, score, passed, answers, result, created_at FROM exam_attempts WHERE user_id = ${r.uid} ORDER BY created_at DESC`;
  const exam = attempts.find((a) => a.id === r.attempt_id) || attempts[0];
  const pub = posts.filter((p) => p.status === "published").length;
  const rej = posts.filter((p) => p.status === "rejected" || p.status === "removed").length;
  const [pen] = await sql`SELECT COUNT(*)::int AS n FROM points_ledger WHERE user_id = ${r.uid} AND delta < 0 AND created_at > now() - interval '1 year'`;
  const lv = levelFor(r.points);
  const checks = [
    [lv.n >= REVIEWER_LEVEL, `Түвшин ${REVIEWER_LEVEL}+`, `Түвшин ${lv.n} · ${r.points.toLocaleString("en-US")} оч`],
    [!!exam?.passed, "Шалгалтад тэнцсэн", exam ? `${exam.score} оноо (босго ${PASS_SCORE}) · ${attempts.length} оролдлого` : "—"],
    [pub > 0, "Нийтлэгдсэн контенттой", `${pub} нийтлэгдсэн · ${rej} буцаагдсан/нуугдсан`],
    [!r.restricted_at, "Хязгаарлалтгүй", r.restricted_at ? "Одоо хязгаарлагдсан байна" : "Хэвийн"],
    [pen.n === 0, "Торгуульгүй", pen.n ? `Сүүлийн жилд ${pen.n} удаа оч хасагдсан` : "Сүүлийн жилд оч хасагдаагүй"],
  ];
  const ok = checks.filter(([v]) => v).length;
  const s = exam ? SAMPLES[exam.sample] : null;
  const marks = exam?.answers?.marks || {};

  return (
    <>
      <Head user={me} title={`Хянагчийн хүсэлт · ${who(r)}`}
        sub={<><Link href="/admin/requests">← Хүсэлтүүд</Link> · #{r.id} · {fmtDate(r.created_at)} · <Chip tone={r.status === "pending" ? "warn" : r.status === "approved" ? "ok" : "bad"}>{{ pending: "Хүлээгдэж буй", approved: "Эрх нээсэн", declined: "Татгалзсан" }[r.status]}</Chip></>} />
      <Flash ok={sp.ok} error={sp.error} />
      <div className="adm-grid3">
        <div className="adm-stack">
          <section className="adm-card">
            <div className="adm-card-head"><b>Хэрэглэгч</b></div>
            <div className="adm-profile">
              <Avatar user={{ id: r.uid, first_name: r.first_name }} size={48} />
              <div><b>{r.surname ? `${r.surname} ` : ""}{r.first_name}</b><small>{r.email}</small></div>
            </div>
            <dl className="adm-dl">
              <dt>Түвшин</dt><dd>{lv.n} · {lv.name}</dd>
              <dt>Оч</dt><dd>{r.points.toLocaleString("en-US")}</dd>
              <dt>Нийтлэл</dt><dd>{posts.length}</dd>
              <dt>Сэтгэгдэл</dt><dd>{r.comments}</dd>
              <dt>Дагагч</dt><dd>{r.followers}</dd>
              <dt>Бүртгүүлсэн</dt><dd>{fmtDate(r.joined)}</dd>
            </dl>
            <Link href={`/u/${r.uid}`} className="adm-link">Нийтийн профайл →</Link>
          </section>
          <section className="adm-card">
            <div className="adm-card-head"><b>Бичсэн контент</b></div>
            {posts.length === 0 ? <p className="adm-empty">Контент алга.</p> : (
              <ul className="adm-feed">
                {posts.map((p) => (
                  <li key={p.id}>
                    <Chip tone={STATUS_TONE[p.status]}>{STATUS_LABELS[p.status]}</Chip>
                    <Link href={`/post/${p.id}`}>{p.title}</Link>
                    <small>{ago(p.created_at)}</small>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="adm-stack">
          <section className="adm-card">
            <div className="adm-card-head"><b>Автомат шалгалт</b><span className="ss-grow" /><Chip tone={ok === checks.length ? "ok" : "warn"}>{ok} / {checks.length} тэнцсэн</Chip></div>
            <ul className="rq-checks">
              {checks.map(([v, t, d]) => (
                <li key={t} className={v ? "ok" : "warn"}><span>{v ? "✓" : "!"}</span><div><b>{t}</b><small>{d}</small></div></li>
              ))}
            </ul>
          </section>
          {exam && s && (
            <section className="adm-card">
              <div className="adm-card-head"><b>Шалгалтын хариулт · {s.title}</b></div>
              <p className="adm-muted small">
                Олсон {exam.result.found}/{exam.result.total} · төрөл зөв {exam.result.typed} · илүү тэмдэглэсэн {exam.result.falsePos} ·
                шийдвэр: {DECISION_LABEL[exam.answers.decision]} ({exam.result.decisionOk ? "зөв" : "буруу"})
              </p>
              <ol className="rq-sents">
                {sentences(s).map((x) => {
                  const m = marks[x.i];
                  const cls = x.err ? (m ? (x.err.includes(m) ? "hit" : "half") : "miss") : m ? "fp" : "";
                  return (
                    <li key={x.i} className={cls}>
                      {x.t}
                      {(x.err || m) && (
                        <small>
                          {x.err && <>Алдаа: {x.err.map((e) => ERROR_LABEL[e]).join(" / ")}</>}
                          {m && <> · Тэмдэглэсэн: {ERROR_LABEL[m]}</>}
                          {x.err && !m && <> · Олоогүй</>}
                        </small>
                      )}
                    </li>
                  );
                })}
              </ol>
              <div className="rq-note"><small>Бичээчид үлдээсэн тайлбар</small><p>{exam.answers.note}</p></div>
            </section>
          )}
        </div>

        <div className="adm-stack">
          <section className="adm-card">
            <div className="adm-card-head"><b>Шийдвэр</b></div>
            {r.status === "pending" ? (
              r.role !== "user" ? (
                <p className="adm-muted">Энэ хэрэглэгч аль хэдийн {r.role === "reviewer" ? "хянагч" : "редакцын гишүүн"} болсон байна.</p>
              ) : (
                <form action={decideRequest} className="adm-form">
                  <input type="hidden" name="request_id" value={r.id} />
                  <button name="op" value="approve" className="adm-btn teal big">Хянагчийн эрх нээх</button>
                  <label>Татгалзах шалтгаан<textarea name="note" rows={3} maxLength={500} placeholder="Хэрэглэгчид мэдэгдлээр очно" /></label>
                  <button name="op" value="decline" className="adm-btn danger big">Татгалзах</button>
                </form>
              )
            ) : (
              <p className="adm-muted">
                {r.status === "approved" ? "Эрх нээсэн" : "Татгалзсан"}: {r.di || r.de ? who({ initial: r.di, first_name: r.df, email: r.de }) : "—"} · {fmtDate(r.decided_at)}
                {r.note && <><br />“{r.note}”</>}
              </p>
            )}
            <p className="adm-banner small">Шийдвэрийг хэрэглэгчид мэдэгдлээр хүргэнэ. Бүх шийдвэр аудит логт бичигдэнэ.</p>
          </section>
          <section className="adm-card">
            <div className="adm-card-head"><b>Шалгалтын түүх</b></div>
            <ul className="adm-feed">
              {attempts.map((a) => (
                <li key={a.id}>
                  <Chip tone={a.passed ? "ok" : "bad"}>{a.score}</Chip>
                  <span>{SAMPLES[a.sample]?.title}</span>
                  <small>{ago(a.created_at)}</small>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
