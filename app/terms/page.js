import Link from "next/link";
import { getUser } from "@/lib/auth";
import { POOL_SHARE, TIP_FEE, WITHDRAW_MIN, INCOME_TAX } from "@/lib/money";
import { AGREEMENT_VERSION, AGREEMENT_DATE, agreementSections } from "@/lib/agreement";
import Shell from "../components/Shell";
import PageHero from "../components/PageHero";

export const dynamic = "force-dynamic";
export const metadata = { title: "Хэрэглэгчийн гэрээ · Science Spark" };

export default async function Terms() {
  let user = null;
  // getUser нь Тохиргооны утгуудыг (шимтгэл, доод дүн) ачаална
  try { user = await getUser(); } catch (e) {}
  const sections = agreementSections({ poolShare: POOL_SHARE, tipFee: TIP_FEE, withdrawMin: WITHDRAW_MIN, incomeTax: INCOME_TAX });

  return (
    <Shell user={user} active="/help" header={false}>
      <div className="hp-page">
        <PageHero tone="help" title="Хэрэглэгчийн гэрээ" text={`Science Spark-ийг хамтдаа аюулгүй, шударга, сонирхолтой газар болгох дүрэм. Хувилбар ${AGREEMENT_VERSION} · ${AGREEMENT_DATE}-аас хүчинтэй.`}>
          <Link href="/help#send" className="ph-btn solid">Асуулт байна уу?</Link>
        </PageHero>

        <nav className="hp-topics" aria-label="Гэрээний хэсгүүд">
          {sections.map(([id, e, t], i) => <a key={id} href={`#${id}`}><span>{e}</span>{i + 1}. {t}</a>)}
        </nav>

        {sections.map(([id, e, title, items], i) => {
          let k = 0;
          return (
            <section key={id} id={id} className="ss-card hp-group tm-sec">
              <h2><span aria-hidden="true">{e}</span>{i + 1}. {title}</h2>
              <ol className="tm-list">
                {items.map((t) => t.startsWith("• ")
                  ? <li key={t} className="tm-sub">{t.slice(2)}</li>
                  : <li key={t}><b>{i + 1}.{++k}</b><span>{t}</span></li>)}
              </ol>
            </section>
          );
        })}
      </div>
    </Shell>
  );
}
