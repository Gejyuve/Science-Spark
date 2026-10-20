import Link from "next/link";
import { getUser } from "@/lib/auth";
import { CLUB_CODE, CLUB_CODE_TITLE, CLUB_CODE_VERSION, CLUB_CODE_DATE, CLUB_CODE_MOTTO, CLUB_CODE_PREAMBLE } from "@/lib/clubCode";
import Shell from "../../components/Shell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Клубүүдийн код · Science Spark" };

const LETTERS = "абвгдеёжзиклмнопрстуфхцчшщэюя";

// Гэрээний хуудастай ижил энгийн баримт бичгийн хэлбэр (.tm-doc)
function clauses(n, items) {
  const out = [];
  let k = 0, sub = 0;
  for (const t of items) {
    if (t.startsWith("• ")) out.push({ sub: true, no: `${LETTERS[sub++]})`, text: t.slice(2) });
    else { sub = 0; out.push({ sub: false, no: `${n}.${++k}.`, text: t }); }
  }
  return out;
}

export default async function ClubCode() {
  let user = null;
  try { user = await getUser(); } catch (e) {}
  return (
    <Shell user={user} active="/clubs" header={false}>
      <article className="tm-doc">
        <h1>{CLUB_CODE_TITLE}</h1>
        <p className="tm-meta">Хувилбар {CLUB_CODE_VERSION}. {CLUB_CODE_DATE}-ны өдрөөс эхлэн мөрдөнө.</p>
        <p className="tm-motto">{CLUB_CODE_MOTTO}</p>
        {CLUB_CODE_PREAMBLE.map((t) => <p key={t}>{t}</p>)}

        <nav className="tm-toc" aria-label="Агуулга">
          <b>Агуулга</b>
          <ol>
            {CLUB_CODE.map(([id, title]) => <li key={id}><a href={`#${id}`}>{title}</a></li>)}
          </ol>
        </nav>

        {CLUB_CODE.map(([id, title, items], i) => (
          <section key={id} id={id}>
            <h2>{i + 1}. {title}</h2>
            {clauses(i + 1, items).map((c) => (
              <p key={c.no + c.text} className={c.sub ? "tm-sub" : ""}><span>{c.no}</span>{c.text}</p>
            ))}
          </section>
        ))}

        <p className="tm-end">--- Кодын төгсгөл ---</p>
        <p className="tm-meta"><Link href="/clubs/new">Клуб бүртгүүлэх</Link> · <Link href="/terms">Хэрэглэгчийн гэрээ</Link></p>
      </article>
    </Shell>
  );
}
