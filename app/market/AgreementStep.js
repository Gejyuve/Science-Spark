import Link from "next/link";
import { loadSettings } from "@/lib/settings";
import { companyReady } from "@/lib/company";
import { ensureAgreement, getAgreement } from "@/lib/merchant-agreement";
import { MERCHANT_TYPES } from "@/lib/merchant-shared";
import { startMerchant } from "../merchant/actions";
import MerchantForm from "../merchant/MerchantForm";
import AgreementDoc from "../merchant/agreement/AgreementDoc";
import SignPanel from "../merchant/agreement/SignPanel";

// «Редакц руу илгээх»-ийн өмнөх сүүлийн алхам: мерчантын мэдээлэл, гэрээ баталгаажуулалт
export default async function AgreementStep({ m, stage, next }) {
  let body = null;
  if (stage === "none") {
    body = (
      <section className="pf-card">
        <h2>Мерчантын гэрээ</h2>
        <p className="mc-note">Маркетад борлуулахын тулд Science Spark-тай зуучлалын гэрээ байгуулна. Шимтгэл 4%.</p>
        <div className="mc-types">
          {Object.keys(MERCHANT_TYPES).map((k) => (
            <form key={k} action={startMerchant}>
              <input type="hidden" name="type" value={k} />
              <input type="hidden" name="next" value={next} />
              <button className="mc-type">
                <span><b>{k === "individual" ? "Хувь хүн" : "Хуулийн этгээд"}</b><small>{k === "individual" ? "Иргэн" : "ХХК, ТББ, сургууль"}</small></span>
                <img className="ic" src="/icons/chev16.svg" width={16} height={16} alt="" />
              </button>
            </form>
          ))}
        </div>
      </section>
    );
  } else if (stage === "form") {
    body = (
      <>
        <section className="pf-card mk-stephead">
          <h2>Мерчантын гэрээ · талуудын мэдээлэл</h2>
          <p className="mc-note">Гэрээнд таны мэдээлэл ингэж орно. {m.review_note ? <b>Засвар: {m.review_note}</b> : null}</p>
        </section>
        <MerchantForm m={m} next={next} />
      </>
    );
  } else if (stage === "sign") {
    const s = await loadSettings();
    const a = companyReady(s.company) ? await ensureAgreement(m, s.company) : null;
    const full = a ? await getAgreement(a.id) : null;
    body = full && full.status === "pending_merchant" ? (
      <>
        <section className="pf-card mk-stephead">
          <h2>Мерчантын гэрээ</h2>
          <p className="mc-note">Гэрээг уншаад баталгаажуулна уу. <Link href="/merchant/agreement" className="mc-link" target="_blank">Тусдаа нээх, хэвлэх</Link></p>
        </section>
        <div className="mk-docbox"><AgreementDoc a={full} /></div>
        <SignPanel aid={full.id} hash={full.content_hash} next={next} title={null} />
      </>
    ) : (
      <section className="pf-card"><h2>Мерчантын гэрээ</h2><p className="mc-note">Гэрээ бэлтгэгдэж байна. Бэлэн болмогц мэдэгдэнэ.</p></section>
    );
  } else if (stage === "ready") {
    const done = m.agreement || m.agreementOpen;
    body = (
      <section className="pf-card mk-ready">
        <span className="mk-check" aria-hidden="true">✓</span>
        <div><b>Мерчантын гэрээ баталгаажсан</b><small>{done?.number}{m.agreement ? " · хүчинтэй" : " · платформ баталгаажуулж байна"}</small></div>
        <span className="pf-grow" />
        <button className="mc-btn" form="product-form" name="intent" value="submit">Редакц руу илгээх</button>
      </section>
    );
  } else {
    body = <section className="pf-card"><h2>Мерчантын гэрээ</h2><p className="mc-note">Таны борлуулах эрх түдгэлзсэн байна. <Link href="/merchant" className="mc-link">Дэлгэрэнгүй</Link></p></section>;
  }
  return <div id="agreement" className="mc-col mk-agreement">{body}</div>;
}
