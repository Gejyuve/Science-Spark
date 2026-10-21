"use client";

import { useEffect } from "react";
import { WRITING_TITLE, writingRules, ruleText } from "@/lib/writing";

const LETTERS = "абвгдеёжзиклмнопрстуфхцчшщэюя";

// «Урьдчилж харах»-ын хажуух «Бичих дүрэм» товч. Дарахад дүрэм Хэрэглэгчийн гэрээ шиг энгийн
// баримт бичгийн хэлбэрээр нээгдэж, доод талын «Зөвшөөрч байна»-г дарснаар бичвэрийг илгээж болно.
export function RulesButton({ agreed, onOpen }) {
  return (
    <button type="button" className={`wr-rulesbtn${agreed ? " on" : ""}`} onClick={onOpen} aria-pressed={agreed}>
      <i aria-hidden="true">{agreed ? "✓" : ""}</i>
      «Бичих дүрэм»-ийг зөвшөөрч байна
    </button>
  );
}

export default function WritingRules({ articleLevel, newsLevel, open, onClose, onAgree }) {
  useEffect(() => {
    if (!open) return;
    const esc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [open, onClose]);
  if (!open) return null;
  const groups = writingRules({ articleLevel, newsLevel });
  return (
    <div className="wr-rules-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <article className="tm-doc wr-rules-doc" role="dialog" aria-modal="true" aria-label={WRITING_TITLE}>
        <button type="button" className="wr-rules-x" onClick={onClose} aria-label="Хаах">×</button>
        <h1>{WRITING_TITLE}</h1>
        <p className="tm-meta">Science Spark платформын хэрэглэгчийн гэрээний хавсралт. <a href="/terms#writing" target="_blank" rel="noopener">Гэрээнээс унших</a></p>
        <section className="tm-annex">
          {groups.map(([id, title, items], i) => {
            let k = 0, sub = 0;
            return (
              <div key={id}>
                <h3>Х{i + 1}. {title}</h3>
                {items.map((t) => {
                  const isSub = t.startsWith("• ");
                  const no = isSub ? `${LETTERS[sub++]})` : `Х${i + 1}.${++k}.`;
                  if (!isSub) sub = 0;
                  return <p key={t} className={isSub ? "tm-sub" : ""}><span>{no}</span>{ruleText(isSub ? t.slice(2) : t)}</p>;
                })}
              </div>
            );
          })}
        </section>
        <p className="tm-end">--- Хавсралтын төгсгөл ---</p>
        <div className="wr-rules-acts">
          <button type="button" className="wr-cancel" onClick={onClose}>Хаах</button>
          <button type="button" className="wr-go" onClick={onAgree}>Зөвшөөрч байна</button>
        </div>
      </article>
    </div>
  );
}
