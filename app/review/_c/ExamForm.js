"use client";

import { useState } from "react";
import { submitExam } from "../actions";

// Өгүүлбэр дээр дарж тэмдэглэнэ, дараа нь алдааны төрлөө сонгоно.
export default function ExamForm({ sample, meta, list, types, decisions }) {
  const [marks, setMarks] = useState({});
  const [open, setOpen] = useState(null);
  const toggle = (i) => setOpen((o) => (o === i ? null : i));
  const setMark = (i, v) => {
    setMarks((m) => {
      const n = { ...m };
      if (v) n[i] = v;
      else delete n[i];
      return n;
    });
    setOpen(null);
  };
  const label = Object.fromEntries(types);
  const paras = [];
  list.forEach((x) => (paras[x.p] = paras[x.p] || []).push(x));
  const count = Object.keys(marks).length;

  return (
    <form action={submitExam} className="rv-exam">
      <input type="hidden" name="sample" value={sample} />
      {Object.entries(marks).map(([i, v]) => <input key={i} type="hidden" name={`m${i}`} value={v} />)}
      <section className="adm-card rv-article">
        <div className="rv-meta">
          <span className="adm-pill">{meta.kind}</span>
          <span className="adm-pill teal">{meta.category}</span>
          <small>Бичээч: {meta.author} · жишээ нийтлэл</small>
        </div>
        <h2>{meta.title}</h2>
        <p className="rv-sub">{meta.subtitle}</p>
        {paras.map((p, pi) => (
          <p key={pi} className="rv-para">
            {p.map((x) => (
              <span key={x.i} className="rv-sent-wrap">
                <span
                  role="button"
                  tabIndex={0}
                  className={"rv-sent" + (marks[x.i] ? " marked" : "") + (open === x.i ? " open" : "")}
                  onClick={() => toggle(x.i)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), toggle(x.i))}
                >
                  {x.t}
                  {marks[x.i] && <em>{label[marks[x.i]]}</em>}
                </span>{" "}
                {open === x.i && (
                  <span className="rv-pick">
                    {types.map(([k, l]) => (
                      <button key={k} type="button" className={marks[x.i] === k ? "on" : ""} onClick={() => setMark(x.i, k)}>{l}</button>
                    ))}
                    {marks[x.i] && <button type="button" className="clear" onClick={() => setMark(x.i, null)}>Алдаагүй</button>}
                  </span>
                )}
              </span>
            ))}
          </p>
        ))}
      </section>

      <aside className="rv-side">
        <section className="adm-card">
          <div className="adm-card-head"><b>Заавар</b></div>
          <ol className="rv-howto">
            <li>Алдаатай гэж үзсэн өгүүлбэр дээрээ дарна.</li>
            <li>Гарч ирэх жагсаалтаас алдааны төрлийг сонгоно.</li>
            <li>Нийтлэлийг юу хийхээ шийднэ.</li>
          </ol>
          <p className="adm-muted small">Тэмдэглэсэн: <b>{count}</b> өгүүлбэр. Алдаагүй өгүүлбэрийг тэмдэглэвэл оноо хасагдана.</p>
        </section>
        <section className="adm-card">
          <div className="adm-card-head"><b>Шийдвэр</b></div>
          <div className="rv-radios">
            {decisions.map(([k, l]) => (
              <label key={k} className="adm-check">
                <input type="radio" name="decision" value={k} required />
                <span>{l}</span>
              </label>
            ))}
          </div>
          <label className="rv-note">
            <span>Бичээчид үлдээх тайлбар</span>
            <textarea name="note" required minLength={20} maxLength={1000} rows={4} placeholder="Юуг засах шаардлагатай вэ? (20+ тэмдэгт)" />
          </label>
          <button className="adm-btn teal big">Шалгалт илгээх</button>
        </section>
      </aside>
    </form>
  );
}
