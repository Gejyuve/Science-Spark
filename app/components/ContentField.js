"use client";

import { useState } from "react";

// Агуулгын талбар: үгийн тоог шууд харуулна
export default function ContentField({ defaultValue = "" }) {
  const [text, setText] = useState(defaultValue);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return (
    <>
      <span className="wr-count">{words} үг</span>
      <textarea
        name="body"
        required
        rows={14}
        maxLength={20000}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Энд бичнэ үү… (догол мөр хооронд хоосон мөр үлдээнэ)"
        aria-label="Агуулга"
      />
    </>
  );
}
