"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import RichEditor from "./RichEditor";
import WriteSteps from "./WriteSteps";
import CatTools from "./CatTools";
import ImageInput from "./ImageInput";
import CategoryPicker from "./CategoryPicker";
import WritingRules, { RulesButton } from "./WritingRules";

const KINDS = ["Нийтлэл", "Мэдээ"];
const FIELDS = ["title", "subtitle", "kind", "category", "body", "sources", "image", "cover_source", "cover_url"];

// Нийтлэл бичих маягт. Бичиж байсан бүх зүйлийг (текст, холбоос, зураг, эх сурвалж, төрөл, ангилал)
// энэ хөтөч дээр автоматаар хадгалж, дараа нь буцаж ороход сэргээнэ.
export default function WriteForm({ action, post = {}, tree, error, extra, heading, kinds = KINDS, locked = {}, submit = "Урьдчилж харах", draftKey, panel, rules = true }) {
  const form = useRef(null);
  const key = draftKey || (post.id ? `ss-draft:edit:${post.id}` : "ss-draft:new");
  const base = {
    title: post.title || "", subtitle: post.subtitle || "", kind: KINDS.includes(post.kind) ? post.kind : "Нийтлэл",
    category: post.category || "", body: post.body || "", sources: post.meta?.sources || [], image: post.image_id ? String(post.image_id) : "",
    cover_source: post.meta?.cover?.source || "", cover_url: post.meta?.cover?.url || "",
  };
  const [init, setInit] = useState(base);
  const [ver, setVer] = useState(0);
  const [restored, setRestored] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  // «Бичих дүрэм»-ийг зөвшөөрөөгүй бол илгээхгүй. Илгээх гэж оролдвол дүрмийг нээж, зөвшөөрмөгц илгээнэ.
  const [agreed, setAgreed] = useState(!rules);
  const [rulesOpen, setRulesOpen] = useState(false);
  const sendAfter = useRef(false);
  const closeRules = useCallback(() => { sendAfter.current = false; setRulesOpen(false); }, []);
  const agree = () => {
    setAgreed(true);
    setRulesOpen(false);
    if (sendAfter.current) { sendAfter.current = false; setTimeout(() => form.current?.requestSubmit(), 0); }
  };

  // Хадгалсан ноорог байвал сэргээнэ
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const d = JSON.parse(raw);
      const changed = FIELDS.some((f) => JSON.stringify(d[f] ?? "") !== JSON.stringify(base[f] ?? ""));
      if (!changed) return;
      setInit({ ...base, ...d, sources: Array.isArray(d.sources) ? d.sources : base.sources });
      setVer((v) => v + 1);
      setRestored(d.at || Date.now());
    } catch (e) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 1.5 секунд тутам хадгална (нуугдмал талбаруудын өөрчлөлтийг ч барина)
  useEffect(() => {
    let last = "";
    const save = () => {
      const f = form.current;
      if (!f) return;
      const fd = new FormData(f);
      const d = {};
      for (const k of FIELDS) d[k] = String(fd.get(k) ?? "");
      try { d.sources = JSON.parse(d.sources || "[]"); } catch (e) { d.sources = []; }
      const s = JSON.stringify(d);
      if (s === last) return;
      last = s;
      const empty = !d.title && !d.body && !d.image && !d.subtitle;
      try {
        if (empty && !post.id) localStorage.removeItem(key);
        else { localStorage.setItem(key, JSON.stringify({ ...d, at: Date.now() })); setSavedAt(Date.now()); }
      } catch (e) {}
    };
    const t = setInterval(save, 1500);
    window.addEventListener("beforeunload", save);
    return () => { clearInterval(t); window.removeEventListener("beforeunload", save); };
  }, [key, post.id]);

  const discard = () => {
    try { localStorage.removeItem(key); } catch (e) {}
    setInit(base);
    setVer((v) => v + 1);
    setRestored(null);
  };
  const t = (ms) => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });

  return (
    <div className="wr-layout">
    <aside className="wr-side left"><div id="wr-outline-slot" /></aside>
    <form ref={form} action={action} className="wr-col" key={ver}
      onSubmit={(e) => {
        if (!agreed) { e.preventDefault(); sendAfter.current = true; setRulesOpen(true); return; }
        try { localStorage.removeItem(key); } catch (e) {}
      }}>
      {post.id && <input type="hidden" name="post_id" value={post.id} />}

      <section className="wr-card wr-head">
        <div className="wr-head-top">
          <img src="/icons/logo.svg" width={56} height={56} alt="" />
          <b>{heading}</b>
        </div>
        <WriteSteps />
        {restored && (
          <p className="wr-restored">
            <span>↺ Өмнө бичиж байсан ноорог тань сэргээгдлээ ({t(restored)}).</span>
            <button type="button" onClick={discard}>Устгаад {post.id ? "анхны хувилбар руу буцах" : "шинээр эхлэх"}</button>
          </p>
        )}
        {error && <p className="error">{error}</p>}
      </section>

      <section className="wr-card">
        <div className="wr-sec-head">
          <div><h2>Нийтлэлийн ковер <em className="wr-req">Заавал</em></h2></div>
        </div>
        <ImageInput name="image" aspect={740 / 280} maxW={1600} variant="drop" initial={init.image || null} required>
          <span className="wr-ring"><img src="/icons/imgadd.svg" width={26} height={26} alt="" /></span>
          <b>Ковер зураг нэмэх</b>
          <span className="wr-pick"><img src="/icons/plus16.svg" width={16} height={16} alt="" />Зураг сонгох</span>
          <small>JPG, PNG, WEBP · 1600×605 px (740:280 харьцаа)</small>
        </ImageInput>
        <div className="wr-coversrc">
          <label><span>Ковер зургийн эх сурвалж <i className="wr-star">*</i></span>
            <input name="cover_source" required maxLength={150} defaultValue={init.cover_source} placeholder="Жишээ: NASA/JPL-Caltech эсвэл Зохиогчийн зураг"
              onInvalid={(e) => e.target.setCustomValidity("Ковер зургийн эх сурвалжийг бичнэ үү")} onInput={(e) => e.target.setCustomValidity("")} /></label>
          <label><span>Эх сурвалжийн холбоос <em>заавал биш</em></span>
            <input name="cover_url" type="url" maxLength={300} defaultValue={init.cover_url} placeholder="https://..." /></label>
        </div>
      </section>

      <section className="wr-card">
        <div className="wr-sec-head">
          <div><h2>Гарчиг ба төрөл</h2><p>Уншигчийн анхаарлыг татах товч, тод гарчиг бичээрэй.</p></div>
        </div>
        <label className="wr-label">Үндсэн гарчиг <em>Заавал</em></label>
        <input className="wr-title" name="title" required maxLength={200} defaultValue={init.title} placeholder="Үндсэн гарчиг" />
        <label className="wr-label">Дэд гарчиг <span className="wr-hint">заавал биш · 250 хүртэл</span></label>
        <textarea className="wr-sub" name="subtitle" maxLength={250} rows={2} defaultValue={init.subtitle} placeholder="Дэд гарчиг" />
        <label className="wr-label">Төрөл сонгох <em>Заавал</em></label>
        <div className="wr-select">
          <select name="kind" defaultValue={init.kind} aria-label="Төрөл">
            {KINDS.map((k) => <option key={k} value={k} disabled={!kinds.includes(k)}>{k}{kinds.includes(k) ? "" : ` · Түвшин ${locked[k] || ""}-өөс`}</option>)}
          </select>
          <img src="/icons/chevdown.svg" width={20} height={20} alt="" />
        </div>
        <label className="wr-label">Ангилал сонгох <em>Заавал</em> <span className="wr-hint">Шинжлэх ухааны модны аль салбарт хамаарах вэ?</span></label>
        <CategoryPicker tree={tree} defaultValue={init.category} />
        <div className="wr-catadd">
          <span>Тохирох ангилал олдохгүй байна уу?</span>
          <CatTools tree={tree} only="add" loggedIn />
        </div>
      </section>

      <section className="wr-card">
        <div className="wr-sec-head">
          <div><h2>Нийтлэлийн агуулга</h2><p>Гарчиг, тод бичиг, ишлэл, зураг, холбоос, эх сурвалжийг хэрэгслийн мөрөөс нэмнэ. «Урьдчилж харах» дээр уншигчид хэрхэн харагдахыг шалгаарай.</p></div>
        </div>
        <div className="wr-editor">
          <RichEditor defaultValue={init.body} defaultSources={init.sources} />
        </div>
      </section>

      {panel}

      <section className="wr-card wr-foot">
        {rules && <RulesButton agreed={agreed} onOpen={() => setRulesOpen(true)} />}
        {extra}
        <span className="ss-grow" />
        <button type="submit" className="wr-go">
          {submit}
          <img src="/icons/arrowr.svg" width={19} height={19} alt="" />
        </button>
      </section>

      <WritingRules articleLevel={locked.Нийтлэл} newsLevel={locked.Мэдээ} open={rulesOpen} onClose={closeRules} onAgree={agree} />
    </form>
    <aside className="wr-side right">
      {savedAt && <p className="wo-saved">✓ Ноорог хадгалагдсан · {t(savedAt)}</p>}
    </aside>
    </div>
  );
}
