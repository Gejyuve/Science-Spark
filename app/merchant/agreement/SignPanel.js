"use client";

import { useActionState, useState, startTransition } from "react";
import Link from "next/link";
import { sendAgreementCode, signAgreement } from "./actions";
import Spark from "../../components/Spark";

// Мерчант гэрээг баталгаажуулах: зөвшөөрөл + и-мэйлээр ирсэн нэг удаагийн код
export default function SignPanel({ aid, hash }) {
  const [sent, sendAction, sending] = useActionState(sendAgreementCode, null);
  const [signed, signAction, signing] = useActionState(signAgreement, null);
  const [agree, setAgree] = useState(false);
  const [code, setCode] = useState("");
  const st = signed || sent;
  const codeSent = sent?.sent || signed?.sent;

  const submit = (fn) => (e) => {
    e.preventDefault();
    startTransition(() => fn(new FormData(e.currentTarget)));
  };

  return (
    <section className="pf-card ag-sign">
      <h2>Гэрээ баталгаажуулах</h2>
      {st?.error && <p className="mc-flash bad">{st.error}</p>}
      {!signed?.error && sent?.ok && <p className="mc-flash ok">{sent.ok}</p>}
      <label className="ag-check">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span>Дээрх гэрээ болон <Link href="/terms" target="_blank">Хэрэглэгчийн гэрээ</Link>-г уншиж танилцан, зөвшөөрч байна.</span>
      </label>
      <form onSubmit={submit(sendAction)} className="ag-row">
        <input type="hidden" name="aid" value={aid} />
        <button className="mc-btn ghost" disabled={!agree || sending}>{sending ? <Spark mono size={16} /> : null}{codeSent ? "Код дахин илгээх" : "И-мэйлээр код авах"}</button>
      </form>
      {codeSent && (
        <form onSubmit={submit(signAction)} className="ag-row">
          <input type="hidden" name="aid" value={aid} />
          <input type="hidden" name="hash" value={hash} />
          <input type="hidden" name="agree" value={agree ? "on" : ""} />
          <div className="pf-input ag-code">
            <input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6 оронтой код" value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} aria-label="Баталгаажуулах код" />
          </div>
          <button className="mc-btn" disabled={!agree || code.length !== 6 || signing}>{signing ? <Spark mono size={16} /> : null}Баталгаажуулах</button>
        </form>
      )}
    </section>
  );
}
