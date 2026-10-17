import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser, isStaff } from "@/lib/auth";
import { examState, SAMPLES, sentences, ERROR_TYPES, DECISIONS, MAX_FAILS } from "@/lib/exam";
import Head, { Flash } from "../../admin/_c/Head";
import ExamForm from "../_c/ExamForm";

export default async function Exam({ searchParams }) {
  const user = await getUser();
  if (isStaff(user)) redirect("/review");
  const sp = await searchParams;
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
