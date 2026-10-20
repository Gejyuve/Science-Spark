"use client";

import { useEffect } from "react";

// Маягт илгээсний дараа хариуны мэдэгдэл бүхий хэсэг рүү гүйлгэнэ
export default function ScrollInto({ id, dep }) {
  useEffect(() => {
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, [id, dep]);
  return null;
}
