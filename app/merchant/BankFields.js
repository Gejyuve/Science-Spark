"use client";

import { useState } from "react";
import { BANKS } from "@/lib/merchant-shared";

// Банк, дансны дугаар, эзэмшигч, данс эзэмшлийн баримт (заавал биш), «өөрийн нэр дээр» гэсэн баталгаа
export default function BankFields({ bank, errors = {}, biz, docs = [] }) {
  const init = bank?.bank_name || "";
  const [own, setOwn] = useState(!!init && !BANKS.includes(init));
  const proofs = docs.filter((d) => d.kind === "bank_proof");
  return (
    <>
      <div className="pf-grid2">
        <div className="mc-field">
          <label className="pf-label" htmlFor="mb-bank"><span>Банк<i>*</i></span></label>
          {own ? (
            <div className={"pf-input" + (errors.bank_name ? " bad" : "")}><input id="mb-bank" name="bank_name" defaultValue={init} maxLength={60} placeholder="Банкны нэр" /></div>
          ) : (
            <div className={"pf-select" + (errors.bank_name ? " bad" : "")}>
              <select id="mb-bank" name="bank_name" defaultValue={init}>
                <option value="">Банк сонгох</option>
                {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
              <img src="/icons/chev16.svg" width={16} height={16} alt="" />
            </div>
          )}
          <button type="button" className="mc-link" onClick={() => setOwn(!own)}>{own ? "Жагсаалтаас сонгох" : "Жагсаалтад байхгүй"}</button>
          {errors.bank_name && <small className="mc-err">{errors.bank_name}</small>}
        </div>
        <div className="mc-field">
          <label className="pf-label" htmlFor="mb-acc"><span>Дансны дугаар / IBAN<i>*</i></span></label>
          <div className={"pf-input" + (errors.account_no ? " bad" : "")}><input id="mb-acc" name="account_no" defaultValue={bank?.account_no || ""} maxLength={34} inputMode="text" placeholder="5000123456" autoComplete="off" /></div>
          {errors.account_no && <small className="mc-err">{errors.account_no}</small>}
        </div>
        <div className="mc-field">
          <label className="pf-label" htmlFor="mb-holder"><span>Данс эзэмшигч<i>*</i></span></label>
          <div className={"pf-input" + (errors.holder_name ? " bad" : "")}><input id="mb-holder" name="holder_name" defaultValue={bank?.holder_name || ""} maxLength={120} placeholder={biz ? "Байгууллагын нэр" : "Овог, нэр"} /></div>
          {errors.holder_name && <small className="mc-err">{errors.holder_name}</small>}
        </div>
        <div className="mc-field">
          <div className="pf-label"><span>Валют</span></div>
          <div className="pf-input mc-fixed"><input value="MNT" readOnly tabIndex={-1} aria-label="Дансны валют" /></div>
        </div>
      </div>
      {proofs.length > 0 && (
        <>
          <label className="pf-label" htmlFor="mb-proof"><span>Данс эзэмшлийн баримт</span></label>
          <div className="pf-select">
            <select id="mb-proof" name="proof_doc_id" defaultValue={bank?.proof_doc_id || ""}>
              <option value="">Сонгоогүй</option>
              {proofs.map((d) => <option key={d.id} value={d.id}>{d.file_name}</option>)}
            </select>
            <img src="/icons/chev16.svg" width={16} height={16} alt="" />
          </div>
        </>
      )}
      <label className={"mc-check" + (errors.own_account ? " bad" : "")}>
        <input type="checkbox" name="own_account" defaultChecked={!!bank} />
        <span>{biz ? "Данс байгууллагын нэр дээр бүртгэлтэй" : "Данс миний нэр дээр бүртгэлтэй"}</span>
      </label>
      {errors.own_account && <small className="mc-err">{errors.own_account}</small>}
    </>
  );
}
