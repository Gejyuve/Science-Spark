import Link from "next/link";
import { getUser } from "@/lib/auth";
import { POOL_SHARE, TIP_FEE, WITHDRAW_MIN, INCOME_TAX } from "@/lib/money";
import { AGREEMENT_TITLE, AGREEMENT_VERSION, AGREEMENT_DATE, agreementSections } from "@/lib/agreement";
import { WRITING_TITLE, writingRules, ruleText } from "@/lib/writing";
import { ARTICLE_LEVEL, NEWS_LEVEL } from "@/lib/levels";
import Shell from "../components/Shell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Хэрэглэгчийн гэрээ · Science Spark" };

const LETTERS = "абвгдеёжзиклмнопрстуфхцчшщэюя";

// Заалтуудыг дугаарлана: үндсэн заалт 1.1, 1.2..., «• »-ээр эхэлсэн дэд заалт а), б)...
function clauses(n, items) {
  const out = [];
  let k = 0, sub = 0;
  for (const t of items) {
    if (t.startsWith("• ")) out.push({ sub: true, no: `${LETTERS[sub++]})`, text: t.slice(2) });
    else { sub = 0; out.push({ sub: false, no: `${n}.${++k}.`, text: t }); }
  }
  return out;
}

export default async function Terms() {
  let user = null;
  // getUser нь Тохиргооны утгуудыг (шимтгэл, доод дүн) ачаална
  try { user = await getUser(); } catch (e) {}
  const sections = agreementSections({ poolShare: POOL_SHARE, tipFee: TIP_FEE, withdrawMin: WITHDRAW_MIN, incomeTax: INCOME_TAX });
  const annex = writingRules({ articleLevel: ARTICLE_LEVEL, newsLevel: NEWS_LEVEL });

  return (
    <Shell user={user} active="/help" header={false}>
      <article className="tm-doc">
        <h1>{AGREEMENT_TITLE}</h1>
        <p className="tm-meta">Хувилбар {AGREEMENT_VERSION}. {AGREEMENT_DATE}-ны өдрөөс эхлэн хүчин төгөлдөр.</p>

        <nav className="tm-toc" aria-label="Агуулга">
          <b>Агуулга</b>
          <ol>
            {sections.map(([id, title]) => <li key={id}><a href={`#${id}`}>{title}</a></li>)}
          </ol>
          <p className="tm-toc-annex"><a href="#writing">Хавсралт. {WRITING_TITLE}</a></p>
        </nav>

        {sections.map(([id, title, items], i) => (
          <section key={id} id={id}>
            <h2>{i + 1}. {title}</h2>
            {clauses(i + 1, items).map((c) => (
              <p key={c.no + c.text} className={c.sub ? "tm-sub" : ""}><span>{c.no}</span>{c.text}</p>
            ))}
          </section>
        ))}

        <p className="tm-end">--- Гэрээний төгсгөл ---</p>

        <section id="writing" className="tm-annex">
          <h2>Хавсралт. {WRITING_TITLE}</h2>
          {annex.map(([id, title, items], i) => (
            <div key={id} id={id}>
              <h3>Х{i + 1}. {title}</h3>
              {clauses(`Х${i + 1}`, items).map((c) => (
                <p key={c.no + c.text} className={c.sub ? "tm-sub" : ""}><span>{c.no}</span>{ruleText(c.text)}</p>
              ))}
            </div>
          ))}
        </section>
        <p className="tm-end">--- Хавсралтын төгсгөл ---</p>
        <p className="tm-meta">Асуулт байвал <Link href="/help#send">Тусламж</Link> хуудсаар хандана уу.</p>
      </article>
    </Shell>
  );
}
