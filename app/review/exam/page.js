import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser, isStaff } from "@/lib/auth";
import { examState, SAMPLES, sentences, ERROR_TYPES, DECISIONS, MAX_FAILS } from "@/lib/exam";
import Head, { Flash } from "../../admin/_c/Head";
import ExamForm from "../_c/ExamForm";

export default async function Exam({ searchParams }) {
  const user = await getUser();
  const sp = await searchParams;
  // Хянагч, редакц: шалгалтын 5 жишээг урьдчилж харна (илгээх боломжгүй)
  if (isStaff(user)) {
    const k = Math.min(SAMPLES.length, Math.max(1, Number(sp.n) || 1)) - 1;
    const s = SAMPLES[k];
    return (
      <>
        <Head user={user} tag="Урьдчилж харах" title="Хянагчийн шалгалтын жишээ" sub="Шалгалт өгөгчид яг ингэж харагдана. Зөв хариулт нь зөвхөн редакцын хүсэлтийн хуудсанд харагдана." />
        <div className="adm-tabs">
          {SAMPLES.map((x, i) => <a key={i} href={`/review/exam?n=${i + 1}`} className={i === k ? "on" : ""}>{i + 1}. {x.title}</a>)}
        </div>
        <ExamForm preview sample={k} meta={{ title: s.title, subtitle: s.subtitle, kind: s.kind, category: s.category, author: s.author }}
          list={sentences(s).map(({ i, p, t }) => ({ i, p, t }))} types={ERROR_TYPES} decisions={DECISIONS} />
      </>
    );
  }
  const st = await examState(user);
  if (st.state !== "open") redirect("/review");
  const s = SAMPLES[st.sample];
  // Алдааны хариуг клиент рүү илгээхгүй — зөвхөн текст
  const list = sentences(s).map(({ i, p, t }) => ({ i, p, t }));
  return (
    <>
      <Head user={user} tag="Шалгалт" title={`Хянагчийн шалгалт · ${st.attemptNo}-р оролдлого`}
        sub={<><Link href="/review">← Буцах</Link> · Үлдсэн оролдлого: {st.left}/{MAX_FAILS}</>} />
      <Flash error={sp.error} />
      <ExamForm
        sample={st.sample}
        meta={{ title: s.title, subtitle: s.subtitle, kind: s.kind, category: s.category, author: s.author }}
        list={list}
        types={ERROR_TYPES}
        decisions={DECISIONS}
      />
    </>
  );
}
