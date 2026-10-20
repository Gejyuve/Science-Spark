"use client";

import { useState } from "react";

// Нууц үгийн талбар: нүдэн дүрсээр бичсэнээ харж шалгана (утсан дээр алдаагүй бичихэд тусална)
export default function PwField({ wrap = "au-field", ...props }) {
  const [show, setShow] = useState(false);
  return (
    <label className={wrap + " pw-field"}>
      <input {...props} type={show ? "text" : "password"} />
      <button type="button" className="pw-eye" onClick={() => setShow(!show)}
        aria-label={show ? "Нууц үгийг нуух" : "Нууц үгийг харах"} title={show ? "Нуух" : "Харах"}>
        <img src={`/icons/${show ? "eyeoff" : "eye"}.svg`} width={18} height={18} alt="" />
      </button>
    </label>
  );
}
