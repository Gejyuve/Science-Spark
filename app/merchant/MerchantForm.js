"use client";

import { useActionState, useEffect, useState, startTransition } from "react";
import { saveMerchant } from "./actions";
import Docs from "./Docs";
import BankFields from "./BankFields";
import Spark from "../components/Spark";
import { INDIVIDUAL_FIELDS, BUSINESS_FIELDS, PRODUCT_TYPES, REP_BASIS, DOC_KINDS } from "@/lib/merchant-shared";

const PH = {
  parent_name: "Жишээ: Батын", first_name: "Жишээ: Болд", register_no: "УБ99112233", phone: "99112233", email: "name@example.mn",
  address: "Аймаг/хот, сум/дүүрэг, баг/хороо, гудамж, байр, тоот", legal_name: "Жишээ: Шинэ Од ХХК", state_reg_no: "Гэрчилгээн дээрх дугаар",
  register_no_b: "1234567", rep_name: "Жишээ: Батын Болд", rep_position: "Жишээ: Гүйцэтгэх захирал",
};
const INPUT = { phone: "tel", email: "email" };

function Field({ f, value, error }) {
  const [key, label, required, kind] = f;
  const id = `mf-${key}`;
  return (
    <div className="mc-field">
      <label className="pf-label" htmlFor={id}>
        <span>{label}{required && <i>*</i>}</span>
        {required ? <em>Заавал</em> : <small className="mc-opt">Байгаа бол</small>}
      </label>
      {kind === "basis" ? (
        <div className={"pf-select" + (error ? " bad" : "")}>
          <select id={id} name={key} defaultValue={value || ""}>
            <option value="">Сонгох</option>
            {[...new Set([...REP_BASIS, ...(value && !REP_BASIS.includes(value) ? [value] : [])])].map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <img src="/icons/chev16.svg" width={16} height={16} alt="" />
        </div>
      ) : (
        <div className={"pf-input" + (error ? " bad" : "")}>
          <input id={id} name={key} type={INPUT[kind] || "text"} defaultValue={value || ""} maxLength={kind === "address" ? 300 : 120}
            placeholder={PH[key === "register_no" && kind === "reg_org" ? "register_no_b" : key] || ""} autoComplete="off" />
        </div>
      )}
      {error && <small className="mc-err">{error}</small>}
    </div>
  );
}

// Мерчантын мэдээлэл бөглөх маягт (ноорог хадгалах, шалгуулахаар илгээх)
export default function MerchantForm({ m }) {
  const [state, action, pending] = useActionState(saveMerchant, null);
  const [intent, setIntent] = useState("");
  const [vat, setVat] = useState(m.vat_payer ? "yes" : m.submitted_at || m.tax_id ? "no" : "");
  const errors = state?.errors || {};
  const biz = m.type === "business";
  const fields = biz ? BUSINESS_FIELDS : INDIVIDUAL_FIELDS;
  const p = biz ? m.business : m.individual;
  useEffect(() => { if (state) window.scrollTo({ top: 0, behavior: "smooth" }); }, [state]);
  const docKinds = Object.entries(DOC_KINDS).filter(([, d]) => d.types.includes(m.type));

  return (
    // Маягтыг React-аар автоматаар цэвэрлүүлэхгүйн тулд (алдаатай утга алга болохгүй) гараар илгээнэ
    <form className="mc-col" onSubmit={(e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget, e.nativeEvent.submitter);
      setIntent(String(fd.get("intent") || ""));
      startTransition(() => action(fd));
    }}>
      {state?.error && <p className="mc-flash bad">{state.error}</p>}
      {state?.ok && <p className="mc-flash ok">{state.ok}</p>}

      <section className="pf-card">
        <h2>{biz ? "Байгууллагын мэдээлэл" : "Хувийн мэдээлэл"}</h2>
        <p className="pf-sub">Албан бичиг баримттай яг ижил бичнэ үү. Регистр, хаяг зэрэг мэдээлэл олон нийтэд харагдахгүй, зөвхөн гэрээ, тооцоонд ашиглагдана.</p>
        {biz ? (
          <>
            <div className="pf-grid2">{fields.slice(0, 6).map((f) => <Field key={f[0]} f={f} value={p[f[0]]} error={errors[f[0]]} />)}</div>
            <h3 className="mc-h3">Эрх бүхий төлөөлөгч</h3>
            <div className="pf-grid2">{fields.slice(6, 11).map((f) => <Field key={f[0]} f={f} value={p[f[0]]} error={errors[f[0]]} />)}</div>
            <h3 className="mc-h3">Нягтлан бодогч</h3>
            <div className="pf-grid2">{fields.slice(11).map((f) => <Field key={f[0]} f={f} value={p[f[0]]} error={errors[f[0]]} />)}</div>
          </>
        ) : (
          <div className="pf-grid2">{fields.map((f) => <Field key={f[0]} f={f} value={p[f[0]]} error={errors[f[0]]} />)}</div>
        )}
      </section>

      <section className="pf-card">
        <h2>Борлуулалт, татвар</h2>
        <p className="pf-sub">Юу зарах гэж байгаагаа сонгоно уу. Дэлгүүрийн нэр бүтээгдэхүүний хуудсанд «Борлуулагч» гэж харагдана.</p>
        <label className="pf-label" htmlFor="mf-shop"><span>Дэлгүүрийн нэр</span><small className="mc-opt">Сонголтоор</small></label>
        <div className="pf-input"><input id="mf-shop" name="shop_name" defaultValue={m.shop_name || ""} maxLength={60} placeholder="Жишээ: Одон номын дэлгүүр" /></div>
        <div className="pf-label"><span>Борлуулах бүтээгдэхүүний төрөл<i>*</i></span><em>Заавал</em></div>
        <div className="mc-chips">
          {PRODUCT_TYPES.map((t) => (
            <label key={t} className="pf-chip"><input type="checkbox" name="product_types" value={t} defaultChecked={m.product_types?.includes(t)} /><span>{t}</span></label>
          ))}
        </div>
        {errors.product_types && <small className="mc-err">{errors.product_types}</small>}
        <div className="pf-label"><span>НӨАТ төлөгч эсэх<i>*</i></span><em>Заавал</em></div>
        <div className="mc-chips">
          <label className="pf-chip"><input type="radio" name="vat_payer" value="yes" checked={vat === "yes"} onChange={() => setVat("yes")} /><span>Тийм</span></label>
          <label className="pf-chip"><input type="radio" name="vat_payer" value="no" checked={vat === "no"} onChange={() => setVat("no")} /><span>Үгүй</span></label>
        </div>
        {errors.vat_payer && <small className="mc-err">{errors.vat_payer}</small>}
        <label className="pf-label" htmlFor="mf-tax"><span>Татвар төлөгчийн дугаар</span>{vat === "yes" ? <em>Заавал</em> : <small className="mc-opt">Хамаарах бол</small>}</label>
        <div className={"pf-input" + (errors.tax_id ? " bad" : "")}><input id="mf-tax" name="tax_id" defaultValue={m.tax_id || ""} maxLength={14} placeholder={biz ? "Байгууллагын ТТД" : "Иргэний ТТД (ихэвчлэн регистрийн дугаар)"} /></div>
        {errors.tax_id && <small className="mc-err">{errors.tax_id}</small>}
      </section>

      <section className="pf-card">
        <h2>Банкны данс</h2>
        <p className="pf-sub">Борлуулалтын орлогыг сар бүр энэ дансанд шилжүүлнэ. {biz ? "Данс тухайн байгууллагын нэр дээр" : "Данс таны өөрийн нэр дээр"} байх ёстой. Гуравдагч этгээдийн данс бүртгэхгүй.</p>
        <BankFields bank={m.pendingBank} errors={errors} biz={biz} docs={m.docs} />
      </section>

      <section className="pf-card">
        <h2>Баримт бичиг</h2>
        <p className="pf-sub">PDF, JPG, PNG, 4MB хүртэл. Баримт зөвхөн танд болон шалгах ажилтанд харагдана.
          {biz ? " Улсын бүртгэлийн гэрчилгээ заавал хэрэгтэй." : " Иргэний үнэмлэхийг шалгах ажилтан хүсвэл хавсаргана."}</p>
        <Docs kinds={docKinds} initial={m.docs} />
        {Object.keys(errors).filter((k) => k.startsWith("doc_")).map((k) => <small key={k} className="mc-err">{errors[k]}</small>)}
      </section>

      <section className="pf-card pf-foot mc-foot">
        <p className="mc-note">Илгээсний дараа ажилтан шалгаж, баталгаажуулна. Дараагийн алхамд мерчантын гэрээг цахимаар байгуулна.</p>
        <span className="pf-grow" />
        <button className="ss-pill ghost" name="intent" value="save" disabled={pending}>{pending && intent === "save" ? <Spark mono size={16} /> : null}Ноорог хадгалах</button>
        <button className="pf-save" name="intent" value="submit" disabled={pending}>{pending && intent === "submit" ? <Spark mono size={16} /> : null}Шалгуулахаар илгээх</button>
      </section>
    </form>
  );
}
