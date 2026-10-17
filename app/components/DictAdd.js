"use client";

import { useActionState, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { proposeTerm } from "../dict/actions";
import { latinShare, LATIN_LIMIT, LATIN_MSG } from "@/lib/format";

const DEF_MAX = 500;
const msg = (text) => ({
  onInvalid: (e) => e.target.setCustomValidity(text),
  onInput: (e) => e.target.setCustomValidity(""),
});

// Figma 552:400 · Шинэ үгийн тайлбар нэмэх (цонх). Толь болон нийтлэл бичих хуудаснаас нээгдэнэ.
export function TermCard({ v }) {
  const syn = String(v.synonyms || "").split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  return (
    <div className="tm-card">
      <div className="tm-card-top"><b>{v.title || "Нэр томьёо"}</b><em className="tm-badge"><img src="/icons/dict.svg" width={11} height={11} alt="" />Толь</em></div>
      <div className="tm-langs">
        <span><i>EN</i>{v.en || "—"}</span>
        {v.ru && <span><i>RU</i>{v.ru}</span>}
        {v.la && <span><i>LA</i>{v.la}</span>}
      </div>
      <p>{v.body || "Тайлбар энд харагдана…"}</p>
      {syn.length > 0 && <small><span>Ижил утгатай:</span> <b>{syn.join(", ")}</b></small>}
      <div className="tm-card-foot">
        {v.source ? <span className="tm-src">↗ {String(v.source).replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}</span> : <span />}
        <span className="tm-go">Толь руу →</span>
      </div>
    </div>
  );
}

export default function DictAdd({ label = "Үг нэмэх", className = "", loggedIn = true, icon = false, onInsert = null }) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ title: "", en: "", ru: "", la: "", body: "", synonyms: "", source: "" });
  const [state, action, pending] = useActionState(proposeTerm, null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [open]);
  useEffect(() => {
    if (state?.ok) setV({ title: "", en: "", ru: "", la: "", body: "", synonyms: "", source: "" });
  }, [state]);
  const set = (k) => (e) => {
    setV((x) => ({ ...x, [k]: e.target.value }));
    if (k === "body") e.target.setCustomValidity(latinShare(e.target.value) > LATIN_LIMIT ? LATIN_MSG : "");
    else if (k === "title") e.target.setCustomValidity(latinShare(e.target.value) > LATIN_LIMIT ? "Нэр томьёог кириллээр бичнэ үү." : "");
    else e.target.setCustomValidity("");
  };
  const tooLatin = latinShare(v.body) > LATIN_LIMIT;
  const term = v.title || "иррационал тоо";

  const modal = open && (
    <div className="tm-overlay" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="tm-modal" role="dialog" aria-modal="true" aria-labelledby="tm-h">
        <div className="tm-head">
          <div>
            <b id="tm-h">Шинэ үгийн тайлбар нэмэх</b>
            <small>Нийтлэл доторх ойлгомжгүй нэр томьёог тайлбарлана. Үг тодорч, дээр нь очиход тайлбар гарна.</small>
          </div>
          <button type="button" className="tm-x" onClick={() => setOpen(false)} aria-label="Хаах">×</button>
        </div>
        {state?.ok ? (
          <div className="tm-done">
            <span className="tm-done-ic">✓</span>
            <b>«{state.title}» хэлэлцүүлэгт орлоо</b>
            <p>Хүмүүс 7 хоногийн турш саналаа өгч, сэтгэгдлээ үлдээнэ. Дэмжлэг авбал зөвшөөрөгч баталж Толь-д оруулна.</p>
            <div className="tm-copy">
              <input readOnly value={`${typeof window !== "undefined" ? window.location.origin : ""}/post/${state.id}`} onFocus={(e) => e.target.select()} aria-label="Үгийн холбоос" />
              <button type="button" className={"tm-btn" + (copied ? " ok" : "")} onClick={async () => {
                try { await navigator.clipboard.writeText(`${window.location.origin}/post/${state.id}`); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch (e) {}
              }}>{copied ? "✓ Хуулагдлаа" : "Холбоос хуулах"}</button>
            </div>
            <div>
              {onInsert && <button type="button" className="tm-btn" onClick={() => { onInsert({ id: state.id, title: state.title }); setOpen(false); }}>Нийтлэлд холбоос болгон оруулах</button>}
              <Link href={`/post/${state.id}`} className={"tm-btn" + (onInsert ? " ghost" : "")} target={onInsert ? "_blank" : undefined}>Хэлэлцүүлгийг харах</Link>
              <button type="button" className="tm-btn ghost" onClick={() => setOpen(false)}>Хаах</button>
            </div>
          </div>
        ) : (
          <form action={action} className="tm-form">
            {state?.error && (
              <p className="tm-err">{state.error}{state.dup && <> · <Link href={`/post/${state.dup}`}>Үзэх →</Link></>}</p>
            )}
            <div className="tm-grid">
              <label><span>Нэр томьёо <i>*</i></span>
                <input name="title" required maxLength={80} value={v.title} onChange={set("title")} placeholder="Жишээ: Иррационал тоо" {...msg("Нэр томьёогоо бичнэ үү")} /></label>
              <label><span>Англи орчуулга <i>*</i></span>
                <input name="en" required maxLength={120} value={v.en} onChange={set("en")} placeholder="Жишээ: Irrational number" {...msg("Англи орчуулгаа бичнэ үү")} /></label>
              <label><span>Орос орчуулга <em>заавал биш</em></span>
                <input name="ru" maxLength={120} value={v.ru} onChange={set("ru")} placeholder="Жишээ: Иррациональное число" /></label>
              <label><span>Латин нэршил <em>заавал биш</em></span>
                <input name="la" maxLength={120} value={v.la} onChange={set("la")} placeholder="Жишээ: Numerus irrationalis" /></label>
              <label className="wide"><span>Тайлбар <i>*</i></span>
                <span className={"tm-area" + (tooLatin ? " bad" : "")}>
                  <textarea name="body" required minLength={20} maxLength={DEF_MAX} rows={3} value={v.body} onChange={set("body")}
                    placeholder="Нэр томьёог энгийн, ойлгомжтой үгээр тайлбарлана уу…" {...msg(tooLatin ? LATIN_MSG : "Тайлбараа дор хаяж 20 тэмдэгтээр бичнэ үү")} />
                  {tooLatin && <em className="cp-latin">{LATIN_MSG}</em>}
                  <small>{v.body.length} / {DEF_MAX}</small>
                </span>
              </label>
              <label><span>Ижил утгатай өөр монгол үг <em>заавал биш</em></span>
                <input name="synonyms" maxLength={300} value={v.synonyms} onChange={set("synonyms")} placeholder="Жишээ: рационал бус тоо" /></label>
              <label><span>Эх сурвалжийн линк <em>заавал биш</em></span>
                <span className="tm-link"><img className="ic" src="/icons/f_link.svg" width={16} height={16} alt="" />
                  <input name="source" type="url" maxLength={300} value={v.source} onChange={set("source")} placeholder="https://..." {...msg("Холбоос https:// -ээр эхэлнэ")} /></span></label>
            </div>
            <div className="tm-preview">
              <b>Нийтлэлд ингэж харагдана</b>
              <p>Энэ тогтмол нь <u className="tm-u">{term}</u> бөгөөд аравт бутархай хэлбэрээр хэзээ ч давтагдахгүй гэдгийг <u className="tm-l">Евклид</u> нотолсон.</p>
              <span className="tm-legend"><i className="g" />Толь бичгийн үг <i className="b" />Холбоос</span>
              <TermCard v={v} />
            </div>
            <div className="tm-foot">
              <small>Нэмсэн үг Толь хуудасны хэлэлцүүлэг рүү явна.</small>
              <span className="ss-grow" />
              <button type="button" className="tm-btn ghost" onClick={() => setOpen(false)}>Болих</button>
              <button type="submit" className="tm-btn" disabled={pending}>{pending ? "Илгээж байна…" : "Хадгалах"}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );

  if (!loggedIn) return <Link href="/login" className={className}>{icon}{label}</Link>;
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>{icon}{label}</button>
      {mounted && modal && createPortal(modal, document.body)}
    </>
  );
}
