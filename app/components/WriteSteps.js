"use client";

import { useEffect, useRef, useState } from "react";

// Бичих алхмууд: бөглөгдсөн алхам ногоорно (Гарчиг · Төрөл · Агуулга · Илгээх)
export default function WriteSteps({ sent = false }) {
  const box = useRef(null);
  const [done, setDone] = useState({ title: false, kind: false, body: false });
  useEffect(() => {
    const form = box.current?.closest("form");
    if (!form) return;
    const check = () => {
      const v = (n) => String(form.querySelector(`[name="${n}"]`)?.value || "").trim();
      setDone({ title: v("title").length >= 3, kind: !!v("kind") && !!v("category"), body: v("body").length >= 50 });
    };
    check();
    form.addEventListener("input", check);
    form.addEventListener("change", check);
    const t = setInterval(check, 800); // ангилал сонгогч гэх мэт нуугдмал талбарын өөрчлөлтийг барина
    return () => { form.removeEventListener("input", check); form.removeEventListener("change", check); clearInterval(t); };
  }, []);
  const steps = [["Гарчиг", done.title], ["Төрөл", done.kind], ["Агуулга", done.body], ["Илгээх", sent]];
  return (
    <div className="wr-steps" ref={box}>
      {steps.map(([s, ok]) => <span key={s} className={ok ? "done" : ""}><i />{s}</span>)}
    </div>
  );
}
