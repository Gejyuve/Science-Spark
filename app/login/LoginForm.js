"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { enter } from "../auth/actions";
import AuthCard, { Field } from "../components/AuthCard";
import PwField from "../components/PwField";

// Нэг цонх: нэвтрэх → (бүртгэлгүй бол) нууц үг давтах → шинэ бүртгэл
export default function LoginForm() {
  const [state, action, pending] = useActionState(enter, { step: "login", error: null });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [back, setBack] = useState(null);
  // «Буцах» дарсны дараа сервер шинэ хариу өгөх хүртэл нэвтрэх алхам руу буцсан хэвээр байна
  const confirmStep = state.step === "confirm" && back !== state;
  const edit = (set) => (e) => { set(e.target.value); if (confirmStep) setBack(state); };

  return (
    <AuthCard
      action={action}
      busy={pending}
      error={back === state ? null : state.error}
      button={pending ? "Түр хүлээнэ үү…" : confirmStep ? "Асаая өө!" : "Асаах"}
      footer={
        confirmStep ? (
          <p className="au-foot"><button type="button" className="au-link" onClick={() => { setBack(state); setConfirm(""); }}>Өөр имэйлээр нэвтрэх</button></p>
        ) : (
          <p className="au-foot"><Link href="/forgot">Нууц үгээ мартсан уу?</Link></p>
        )
      }
    >
      {confirmStep && (
        <p className="au-step">
          <b>{email}</b> хаяг бүртгэлгүй байна.<br />Шинээр асаахын тулд нууц үгээ дахин бичиж баталгаажуулна уу.
        </p>
      )}
      <Field name="email" type="email" required autoComplete="email" placeholder="Мэйл" aria-label="Мэйл"
        value={email} onChange={edit(setEmail)} readOnly={confirmStep} />
      <PwField name="password" required autoComplete={confirmStep ? "new-password" : "current-password"}
        placeholder="Нууц үг" aria-label="Нууц үг" value={password} onChange={edit(setPassword)} />
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
