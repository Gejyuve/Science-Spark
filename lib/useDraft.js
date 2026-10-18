"use client";

import { useEffect, useRef, useState } from "react";

// Маягтын ноорог: бөглөсөн утгыг энэ төхөөрөмж дээр (localStorage) 1.5 сек тутам хадгалж,
// буцаж ороход сэргээнэ. Файл, зөвшөөрлийн тэмдэглэгээг хадгалахгүй.
export function useDraft(key, formRef, { skip = ["agree"] } = {}) {
  const [draft, setDraft] = useState(null);
  const [restoredAt, setRestoredAt] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const [ver, setVer] = useState(0);
  const base = useRef(null);
  const off = useRef(false);

  const read = () => {
    const f = formRef.current;
    if (!f) return null;
    const v = {};
    for (const [k, x] of new FormData(f)) if (typeof x === "string" && !skip.includes(k)) v[k] = x;
    return v;
  };

  useEffect(() => {
    try {
      // Өмнө нь илгээсэн бөгөөд алдаагүй бол (амжилттай хадгалсан) ноорог хэрэггүй
      if (sessionStorage.getItem(key + ":sent")) {
        sessionStorage.removeItem(key + ":sent");
        if (!/[?&]error=/.test(location.search)) { localStorage.removeItem(key); return; }
      }
      const d = JSON.parse(localStorage.getItem(key) || "null");
      if (d && d.v) { setDraft(d.v); setRestoredAt(d.t); setSavedAt(d.t); setVer((x) => x + 1); }
    } catch (e) {}
  }, [key]);

  // Анхны (бөглөөгүй) байдлыг тэмдэглэнэ — өөрчлөгдөөгүй бол ноорог үүсгэхгүй
  useEffect(() => {
    base.current = null;
    const t = setTimeout(() => { base.current = JSON.stringify(read()); }, 400);
    return () => clearTimeout(t);
  }, [ver]);

  useEffect(() => {
    const save = () => {
      if (off.current || base.current === null) return;
      const v = read();
      if (!v) return;
      const s = JSON.stringify(v);
      if (s === base.current && !restoredAt) return;
      try {
        const prev = localStorage.getItem(key);
        if (prev && JSON.parse(prev).s === s) return;
        const t = Date.now();
        localStorage.setItem(key, JSON.stringify({ v, s, t }));
        setSavedAt(t);
      } catch (e) {}
    };
    const i = setInterval(save, 1500);
    window.addEventListener("beforeunload", save);
    return () => { clearInterval(i); window.removeEventListener("beforeunload", save); };
  }, [key, restoredAt]);

  const clear = () => {
    try { localStorage.removeItem(key); } catch (e) {}
    setDraft(null); setRestoredAt(null); setSavedAt(null); setVer((x) => x + 1);
  };
  // Илгээх үед тэмдэглэнэ: амжилттай бол дараагийн удаа ноорог устна, алдаа гарвал хэвээр үлдэнэ
  const drop = () => { try { sessionStorage.setItem(key + ":sent", "1"); } catch (e) {} };
  const keep = () => { try { sessionStorage.removeItem(key + ":sent"); } catch (e) {} };
  return { draft, ver, savedAt, restoredAt, clear, drop, keep };
}

export const hhmm = (t) => (t ? new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "");
