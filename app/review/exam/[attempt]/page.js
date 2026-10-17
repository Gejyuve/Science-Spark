import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { examState, SAMPLES, DECISION_LABEL, PASS_SCORE, MAX_FAILS } from "@/lib/exam";
import Head, { Stat } from "../../../admin/_c/Head";

export default async function ExamResult({ params }) {
  const user = await getUser();
  const { attempt } = await params;
  const id = Number(attempt);
  if (!Number.isInteger(id)) notFound();
  const [a] = await sql`SELECT * FROM exam_attempts WHERE id = ${id} AND user_id = ${user.id}`;
  if (!a) notFound();
  const r = a.result || {};
  const st = await examState(user);
  return (
    <>
      <Head user={user} tag="Шалгалт" title={a.passed ? "Та тэнцлээ 🎉" : "Энэ удаад тэнцсэнгүй"}
        sub={<><Link href="/review">← Хянагч болох</Link> · {SAMPLES[a.sample]?.title} · {fmtDate(a.created_at)}</>} />
      <div className="adm-stats">
        <Stat label="Оноо" value={a.score} note={`Тэнцэх босго ${PASS_SCORE}`} tone={a.passed ? "" : "bad"} />
        <Stat label="Олсон алдаа" value={`${r.found ?? 0} / ${r.total ?? 0}`} note={`Төрлийг зөв тодорхойлсон: ${r.typed ?? 0}`} />
        <Stat label="Илүү тэмдэглэсэн" value={r.falsePos ?? 0} note="алдаагүй өгүүлбэр" tone={r.falsePos ? "warn" : ""} />
        <Stat label="Шийдвэр" value={r.decisionOk ? "Зөв" : "Буруу"} note={DECISION_LABEL[a.answers?.decision] || ""} tone={r.decisionOk ? "" : "bad"} />
      </div>
      <section className="adm-card">
        {a.passed ? (
          <p className="adm-lead">Таны шалгалтын дүн редакц руу илгээгдлээ. Редакц таны бичсэн нийтлэлүүд болон шалгалтын дүнг хянаад хянагчийн эрх нээнэ. Шийдвэрийг мэдэгдлээр хүлээн авна.</p>
        ) : st.state === "locked" ? (
          <p className="adm-lead">Та {MAX_FAILS} удаа тэнцээгүй тул шалгалт өгөх эрх <b>{fmtDate(st.unlockAt)}</b> хүртэл хаагдлаа.</p>
        ) : (
          <>
            <p className="adm-lead">Дараагийн оролдлогод өөр жишээ нийтлэл өгөгдөнө. Танд <b>{st.left}</b> оролдлого үлдлээ. Зөв хариултыг нууцалсан тул алдаагаа өөрөө эргэцүүлээрэй: баримт, логик, эх сурвалж, зөв бичиг, сурталчилгаа.</p>
            {st.state === "open" && <Link href="/review/exam" className="adm-btn teal big">Дахин оролдох</Link>}
          </>
        )}
      </section>
    </>
  );
}
