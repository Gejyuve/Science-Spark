"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { enter } from "../auth/actions";
import AuthCard, { Field } from "../components/AuthCard";
import PwField from "../components/PwField";

// Нэг цонх: нэвтрэх → (бүртгэлгүй бол) нууц үг давтах → и-мэйлээ баталгаажуулах → шинэ бүртгэл
// notice: и-мэйлийн холбоосоос буцаж ирэхэд харуулах мэдээ ({ text, bad })
export default function LoginForm({ notice = null }) {
  const [state, action, pending] = useActionState(enter, { step: "login", error: null });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [back, setBack] = useState(null);
  // «Буцах» дарсны дараа сервер шинэ хариу өгөх хүртэл нэвтрэх алхам руу буцсан хэвээр байна
  const confirmStep = state.step === "confirm" && back !== state;
  // И-мэйл рүү баталгаажуулах холбоос илгээсэн: «Дахин илгээх» нь ижил имэйл, нууц үгийг дахин илгээнэ
  const verifyStep = state.step === "verify" && back !== state;
  const first = state.step === "login" && !state.error && !state.email;
  const edit = (set) => (e) => { set(e.target.value); if (confirmStep) setBack(state); };

  return (
    <AuthCard
      action={action}
      busy={pending}
      error={back === state ? null : state.error || (first && notice?.bad ? notice.text : null)}
      button={pending ? "Түр хүлээнэ үү…" : verifyStep ? "Дахин илгээх" : confirmStep ? "Асаая өө!" : "Асаах"}
      footer={
        confirmStep || verifyStep ? (
          <p className="au-foot"><button type="button" className="au-link" onClick={() => { setBack(state); setConfirm(""); if (verifyStep) setPassword(""); }}>Өөр имэйлээр нэвтрэх</button></p>
        ) : (
          <p className="au-foot"><Link href="/forgot">Нууц үгээ мартсан уу?</Link></p>
        )
      }
    >
      {first && notice && !notice.bad && <p className="au-step">{notice.text}</p>}
      {verifyStep && (
        <div className="au-verify">
          <p className="au-step">
            <b>{state.email}</b> хаяг руу баталгаажуулах холбоос илгээлээ.<br />
            И-мэйлээ нээгээд «И-мэйлээ баталгаажуулах» товч дээр дарвал бүртгэл тань идэвхжинэ.
          </p>
          <p className="au-hint">Захидал ирээгүй бол «Spam», «Promotions» хавтсаа шалгаарай. Холбоос 24 цаг хүчинтэй.</p>
          {state.sent && <p className="au-check ok">✓ Илгээгдлээ</p>}
          <input type="hidden" name="email" value={state.email} />
          <input type="hidden" name="password" value={password} />
        </div>
      )}
      {confirmStep && (
        <p className="au-step">
          <b>{email}</b> хаяг бүртгэлгүй байна.<br />Шинээр асаахын тулд нууц үгээ дахин бичиж баталгаажуулна уу.
        </p>
      )}
      {!verifyStep && (<>
      <Field name="email" type="email" required autoComplete="email" placeholder="Мэйл" aria-label="Мэйл"
        value={email} onChange={edit(setEmail)} readOnly={confirmStep} />
      <PwField name="password" required autoComplete={confirmStep ? "new-password" : "current-password"}
        placeholder="Нууц үг" aria-label="Нууц үг" value={password} onChange={edit(setPassword)} />
      </>)}
      {confirmStep && (
        <>
          <PwField name="confirm" required autoFocus autoComplete="new-password"
            placeholder="Нууц үгээ дахин бичнэ үү" aria-label="Нууц үгээ дахин бичнэ үү" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {/* Бичих зуур шалгана: сервер рүү илгээхээс өмнө алдаагаа харна */}
          <p className={"au-check" + (confirm && confirm !== password ? " bad" : confirm ? " ok" : "")}>
            {!confirm ? "Хоёр нууц үг ижил байх ёстой" : confirm === password ? "✓ Нууц үг таарч байна" : "Нууц үг таарахгүй байна"}
          </p>
        </>
      )}
    </AuthCard>
  );
}
