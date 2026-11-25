import { redirect } from "next/navigation";
import { ensureSchema } from "@/lib/db";
import { getUser, needsName } from "@/lib/auth";
import { merchantOpenFor, loadMerchant } from "@/lib/merchant";
import {
  MERCHANT_TYPES, MERCHANT_STATUS, BANK_STATUS, EDITABLE, INDIVIDUAL_FIELDS, BUSINESS_FIELDS, DOC_KINDS, merchantName,
} from "@/lib/merchant-shared";
import Link from "next/link";
import Shell from "../components/Shell";
import MerchantForm from "./MerchantForm";
import BankFields from "./BankFields";
import Docs from "./Docs";
import { startMerchant, changeBank, withdrawMerchant } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Мерчант · Science Spark" };

const when = (d) => (d ? new Date(d).toLocaleString("sv-SE", { timeZone: "Asia/Ulaanbaatar" }).slice(0, 16).replaceAll("-", ".") : "—");

// Мерчант: Science Spark-аар дамжуулан бараа, тасалбар борлуулах эрх авах бүртгэл
export default async function MerchantPage({ searchParams }) {
  const sp = await searchParams;
  const user = await getUser();
  if (!user) redirect("/login?next=/merchant");
  if (needsName(user)) redirect("/profile/edit");
  if (user.is_bot || !(await merchantOpenFor(user))) redirect("/");
  await ensureSchema();
  const m = await loadMerchant({ userId: user.id });

  return (
    <Shell user={user} header="nav">
      <div className="mc-page">
        {sp.error && <p className="mc-flash bad">{sp.error}</p>}
        {sp.ok && <p className="mc-flash ok">{sp.ok}</p>}
        {!m ? <Intro /> : m.status !== "draft" && <Status m={m} />}
        {m && EDITABLE.includes(m.status) && <MerchantForm m={m} />}
        {m && !EDITABLE.includes(m.status) && m.status !== "rejected" && <Summary m={m} />}
        {m && m.status === "rejected" && <Intro again />}
        {m && m.log.length > 1 && <History log={m.log} />}
      </div>
    </Shell>
  );
}

function Intro({ again }) {
  return (
    <section className="pf-card mc-intro">
      <h1>{again ? "Дахин өргөдөл гаргах" : "Мерчантын бүртгэл"}</h1>
      <p className="mc-lead">Бараа, тасалбар борлуулах эрх. Зуучлалын шимтгэл 4%.</p>
      <div className="mc-types">
        {Object.entries(MERCHANT_TYPES).map(([k, label]) => (
          <form key={k} action={startMerchant}>
            <input type="hidden" name="type" value={k} />
            <button className="mc-type">
              <span><b>{k === "individual" ? "Хувь хүн" : "Хуулийн этгээд"}</b><small>{k === "individual" ? "Иргэн" : "ХХК, ТББ, сургууль"}</small></span>
              <img className="ic" src="/icons/chev16.svg" width={16} height={16} alt="" />
            </button>
          </form>
        ))}
      </div>
    </section>
  );
}

function Status({ m }) {
  const [label, tone] = MERCHANT_STATUS[m.status] || [m.status, "gray"];
  const TEXT = {
    draft: "",
    pending_review: "Шалгаж байна. Шийдвэр гармагц мэдэгдэнэ.",
    revision_required: "Засвар шаардлагатай.",
    approved: "Дараагийн алхам: мерчантын гэрээ.",
    rejected: "",
    suspended: "Өмнөх борлуулалтын тооцоо хэвээр.",
    terminated: "Өмнөх борлуулалтын тооцоо хэвээр.",
  };
  return (
    <section className={"pf-card mc-status " + tone}>
      <div className="mc-status-top">
        <span className="mc-dot" aria-hidden="true" />
        <div>
          <small>{MERCHANT_TYPES[m.type]} · Мерчант №{m.id}</small>
          <h1>{merchantName(m)}</h1>
        </div>
        <span className={"mc-pill " + tone}>{label}</span>
      </div>
      {m.status === "approved" ? <AgreementLine m={m} /> : TEXT[m.status] && <p>{TEXT[m.status]}</p>}
      {m.review_note && ["revision_required", "rejected", "suspended", "terminated"].includes(m.status) && (
        <p className="mc-review">{m.review_note}</p>
      )}
      {m.status === "pending_review" && (
        <form action={withdrawMerchant}><button className="mc-btn ghost">Буцааж авч засах</button></form>
      )}
    </section>
  );
}

// Баталгаажсан мерчантын гэрээний төлөв, холбоос
function AgreementLine({ m }) {
  const o = m.agreementOpen;
  if (o?.status === "pending_merchant") return <p>Мерчантын гэрээг баталгаажуулна уу. <Link href="/merchant/agreement" className="mc-link">Гэрээ унших</Link></p>;
  if (o?.status === "pending_platform") return <p>Гэрээг платформ баталгаажуулахыг хүлээж байна. <Link href="/merchant/agreement" className="mc-link">Гэрээ</Link></p>;
  if (m.agreement) return <p>Гэрээ {m.agreement.number} хүчинтэй. <Link href="/merchant/agreement" className="mc-link">Гэрээ</Link></p>;
  return <p>Дараагийн алхам: мерчантын гэрээ. <Link href="/merchant/agreement" className="mc-link">Гэрээ</Link></p>;
}

function Summary({ m }) {
  const fields = m.type === "business" ? BUSINESS_FIELDS : INDIVIDUAL_FIELDS;
  const p = m.type === "business" ? m.business : m.individual;
  const canChange = ["approved", "suspended"].includes(m.status);
  return (
    <>
      <section className="pf-card">
        <h2>Бүртгэлийн мэдээлэл</h2>
        <dl className="mc-dl">
          {fields.filter(([k]) => p[k]).map(([k, label]) => <div key={k}><dt>{label}</dt><dd>{p[k]}</dd></div>)}
          {m.shop_name && <div><dt>Дэлгүүрийн нэр</dt><dd>{m.shop_name}</dd></div>}
          <div><dt>Бүтээгдэхүүний төрөл</dt><dd>{m.product_types.join(", ") || "—"}</dd></div>
          <div><dt>НӨАТ төлөгч</dt><dd>{m.vat_payer ? "Тийм" : "Үгүй"}</dd></div>
          {m.tax_id && <div><dt>Татвар төлөгчийн дугаар</dt><dd>{m.tax_id}</dd></div>}
        </dl>
      </section>

      <section className="pf-card" id="bank">
        <h2>Банкны данс</h2>
        {m.bank ? (
          <div className="mc-bank">
            <b>{m.bank.bank_name} · {m.bank.account_no}</b>
            <small>{m.bank.holder_name} · {m.bank.currency} · баталгаажсан {when(m.bank.verified_at)}</small>
          </div>
        ) : <p className="mc-note">Баталгаажсан данс алга.</p>}
        {m.pendingBank && (
          <div className="mc-bank pending">
            <b>{m.pendingBank.bank_name} · {m.pendingBank.account_no}</b>
            <small>{m.pendingBank.holder_name} · {BANK_STATUS.pending[0]}{m.bank ? ". Баталгаажих хүртэл дээрх данс хүчинтэй" : ""}</small>
          </div>
        )}
        {m.banks.filter((b) => ["rejected", "replaced"].includes(b.status)).length > 0 && (
          <details className="mc-more">
            <summary>Дансны түүх</summary>
            <ul className="mc-hist">
              {m.banks.filter((b) => ["rejected", "replaced"].includes(b.status)).map((b) => (
                <li key={b.id}><b>{b.bank_name} · {b.account_no}</b><small>{BANK_STATUS[b.status][0]} · {when(b.replaced_at || b.created_at)}{b.note ? ` · ${b.note}` : ""}</small></li>
              ))}
            </ul>
          </details>
        )}
        {canChange && (
          <details className="mc-more" open={false}>
            <summary>{m.pendingBank ? "Шалгуулж буй дансаа засах" : "Данс солих"}</summary>
            <p className="mc-note">Шинэ данс баталгаажих хүртэл одоогийн данс хүчинтэй.</p>
            <Docs kinds={[["bank_proof", DOC_KINDS.bank_proof]]} only="bank_proof" initial={m.docs} />
            <form action={changeBank} className="mc-col tight">
              <BankFields bank={m.pendingBank} biz={m.type === "business"} docs={m.docs} />
              <div><button className="mc-btn">Илгээх</button></div>
            </form>
          </details>
        )}
      </section>

      <section className="pf-card">
        <h2>Баримт бичиг</h2>
        {m.docs.length ? <Docs kinds={[]} initial={m.docs} readOnly /> : <p className="mc-note">Баримт хавсаргаагүй.</p>}
      </section>
    </>
  );
}

function History({ log }) {
  return (
    <section className="pf-card">
      <h2>Түүх</h2>
      <ul className="mc-hist">
        {log.map((l) => (
          <li key={l.id}>
            <b>{MERCHANT_STATUS[l.to_status]?.[0] || l.to_status}</b>
            <small>{when(l.created_at)}{l.note ? ` · ${l.note}` : ""}</small>
          </li>
        ))}
      </ul>
    </section>
  );
}
