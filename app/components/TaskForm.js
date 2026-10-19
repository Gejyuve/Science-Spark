"use client";

import { useState } from "react";
import RichEditor from "./RichEditor";
import ImageInput from "./ImageInput";
import { TYPE_MAX, TYPE_LEN } from "@/lib/tasks-shared";
import { latinShare, LATIN_LIMIT, LATIN_MSG } from "@/lib/format";

// Төрөл: олныг сонгоно, тохирох төрөл байхгүй бол шинээр нэмнэ
function TypePicker({ options }) {
  const [list, setList] = useState(options);
  const [sel, setSel] = useState([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const full = sel.length >= TYPE_MAX;
  const toggle = (v) => setSel((s) => (s.includes(v) ? s.filter((x) => x !== v) : s.length >= TYPE_MAX ? s : [...s, v]));
  const bad = draft && latinShare(draft) > LATIN_LIMIT;
  const add = () => {
    const v = draft.trim().replace(/\s+/g, " ").slice(0, TYPE_LEN);
    if (!v || bad) return;
    const known = list.find((x) => x.toLowerCase() === v.toLowerCase());
    if (!known) setList((l) => [...l, v]);
    if (!sel.includes(known || v) && !full) setSel((s) => [...s, known || v]);
    setDraft("");
    setAdding(false);
  };
  return (
    <div className="tk-types">
      <div className="tk-chips">
        {list.map((v) => (
          <button key={v} type="button" className={"tk-chip" + (sel.includes(v) ? " on" : "")} aria-pressed={sel.includes(v)}
            disabled={full && !sel.includes(v)} onClick={() => toggle(v)}>{sel.includes(v) ? "✓ " : ""}{v}</button>
        ))}
        {adding ? (
          <span className={"tk-add-box" + (bad ? " bad" : "")}>
            <input autoFocus value={draft} maxLength={TYPE_LEN} placeholder="Шинэ төрөл" onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } if (e.key === "Escape") setAdding(false); }} />
            <button type="button" onClick={add} disabled={!draft.trim() || bad}>Нэмэх</button>
            <button type="button" className="x" aria-label="Болих" onClick={() => { setAdding(false); setDraft(""); }}>×</button>
          </span>
        ) : (
          <button type="button" className="tk-chip add" onClick={() => setAdding(true)}>+ Төрөл нэмэх</button>
        )}
      </div>
      {bad && <small className="tk-bad">{LATIN_MSG}</small>}
      <small className="wr-hint">{TYPE_MAX} хүртэл төрөл сонгоно. Сонгосон: {sel.length}</small>
      {/* Нэг ч төрөл сонгоогүй бол илгээхгүй */}
      <input className="tk-req" tabIndex={-1} aria-hidden="true" value={sel.length ? "1" : ""} required onChange={() => {}}
        ref={(el) => el && el.setCustomValidity(sel.length ? "" : "Дор хаяж нэг төрөл сонгоно уу")} />
      <input type="hidden" name="types" value={JSON.stringify(sel)} />
    </div>
  );
}

// Клубийн даалгавар нэмэх самбар (нийтлэл бичихтэй ижил бүтэцтэй)
export default function TaskForm({ action, club, avatar, types, error }) {
  return (
    <div className="wr-layout">
      <aside className="wr-side left" />
      <form action={action} className="wr-col">
        <input type="hidden" name="kind" value="Даалгавар" />
        <section className="wr-card wr-head">
          <div className="wr-head-top">
            <img src="/icons/logo.svg" width={56} height={56} alt="" />
            <b>Клубийнхаа туршлагыг бусад клубтэй хуваалцаж, дараагийн үеийнхний сониуч занг асаая.</b>
          </div>
          <p className="tk-as">{avatar}<span><b>{club.name}</b> клубийн нэрээр нийтлэгдэнэ</span></p>
          {error && <p className="error">{error}</p>}
        </section>

        <section className="wr-card">
          <div className="wr-sec-head">
            <div><h2>Ковер зураг <em className="wr-req">Заавал</em></h2></div>
          </div>
          <ImageInput name="image" aspect={740 / 280} maxW={1600} variant="drop" required>
            <span className="wr-ring"><img src="/icons/imgadd.svg" width={26} height={26} alt="" /></span>
            <b>Ковер зураг нэмэх</b>
            <span className="wr-pick"><img src="/icons/plus16.svg" width={16} height={16} alt="" />Зураг сонгох</span>
            <small>JPG, PNG, WEBP · 1600×605 px (740:280 харьцаа)</small>
          </ImageInput>
          <div className="wr-coversrc">
            <label><span>Ковер зургийн эх сурвалж <em>заавал биш</em></span>
              <input name="cover_source" maxLength={150} placeholder="Жишээ: Клубийн гишүүдийн авсан зураг" /></label>
            <label><span>Эх сурвалжийн холбоос <em>заавал биш</em></span>
              <input name="cover_url" type="url" maxLength={300} placeholder="https://..." /></label>
          </div>
        </section>

        <section className="wr-card">
          <div className="wr-sec-head">
            <div><h2>Гарчиг ба төрөл</h2><p>Бусад клубүүд юу хийхээ гарчгаас нь шууд ойлгохоор бичээрэй.</p></div>
          </div>
          <label className="wr-label">Гарчиг <em>Заавал</em></label>
          <input className="wr-title" name="title" required maxLength={200} placeholder="Жишээ: Лаавын чийдэн хийж нягтын ялгааг харцгаая"
            onInvalid={(e) => e.target.setCustomValidity("Гарчгаа бичнэ үү")} onInput={(e) => e.target.setCustomValidity("")} />
          <label className="wr-label">Товч тайлбар <span className="wr-hint">заавал биш · 250 хүртэл</span></label>
          <textarea className="wr-sub" name="subtitle" maxLength={250} rows={2} placeholder="Хэдэн ангийн сурагчдад, хэр удаан, юу сурах вэ?" />
          <label className="wr-label">Төрөл <em>Заавал</em> <span className="wr-hint">Нэгээс олныг сонгож болно</span></label>
          <TypePicker options={types} />
        </section>

        <section className="wr-card">
          <div className="wr-sec-head">
            <div><h2>Даалгаврын агуулга</h2><p>Зорилго, шаардлагатай материал, алхмууд, аюулгүй байдлын анхааруулга, юу ажиглах ёстойг бичээрэй. Эх сурвалж нэмэх нь заавал биш.</p></div>
          </div>
          <div className="wr-editor">
            <RichEditor />
          </div>
        </section>

        <section className="wr-card wr-foot">
          <span className="cp-review"><img src="/icons/f_shield.svg" width={18} height={18} alt="" />Редакц шалгаж баталсны дараа нийтлэгдэнэ</span>
          <span className="ss-grow" />
          <button type="submit" className="wr-go">
            Редакц руу илгээх
            <img src="/icons/arrowr.svg" width={19} height={19} alt="" />
          </button>
        </section>
      </form>
      <aside className="wr-side right" />
    </div>
  );
}
