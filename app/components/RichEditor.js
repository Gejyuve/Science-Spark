"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { render, strip, SOURCE_TYPES, SOURCE_LANGS, formatSource } from "@/lib/md";
import { uploadImageFile } from "./ImageInput";
import DictAdd from "./DictAdd";

// Нийтлэлийн агуулгын засварлагч: хэрэгслийн мөр, урьдчилж харах, зураг, холбоос, ишлэл, эх сурвалж.
// Агуулга нь энгийн тэмдэглэгээгээр (lib/md.js) хадгалагдана.

function Modal({ title, sub, onClose, children }) {
  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [onClose]);
  return createPortal(
    <div className="tm-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="tm-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="tm-head">
          <div><b>{title}</b>{sub && <small>{sub}</small>}</div>
          <button type="button" className="tm-x" onClick={onClose} aria-label="Хаах">×</button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

const Tool = ({ label, title, onClick, children, wide }) => (
  <button type="button" className={"re-tool" + (wide ? " wide" : "")} title={title} aria-label={title} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
    {children || label}
  </button>
);

const I = {
  bold: <b>B</b>,
  italic: <i style={{ fontFamily: "Georgia, serif" }}>I</i>,
  hl: <span className="re-hl">ab</span>,
  link: <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>,
  quote: <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11h5v8H3v-6c0-4 2-6 5-7M15 11h5v8h-6v-6c0-4 2-6 5-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>,
  ul: <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="4" cy="6" r="1.5" fill="currentColor" /><circle cx="4" cy="12" r="1.5" fill="currentColor" /><circle cx="4" cy="18" r="1.5" fill="currentColor" /></svg>,
  ol: <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 6h10M10 12h10M10 18h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><text x="1" y="8" fontSize="7" fill="currentColor" fontWeight="700">1</text><text x="1" y="14.5" fontSize="7" fill="currentColor" fontWeight="700">2</text><text x="1" y="21" fontSize="7" fill="currentColor" fontWeight="700">3</text></svg>,
  note: <span aria-hidden="true">💡</span>,
  hr: <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>,
  img: <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="9" cy="10" r="2" fill="currentColor" /><path d="m4 18 5-5 4 4 3-3 4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>,
  cite: <span aria-hidden="true">[1]</span>,
};

export default function RichEditor({ defaultValue = "", defaultSources = [], loggedIn = true }) {
  const ta = useRef(null);
  const [text, setText] = useState(defaultValue);
  const [tab, setTab] = useState("write");
  const [sources, setSources] = useState(Array.isArray(defaultSources) ? defaultSources : []);
  const [dlg, setDlg] = useState(null); // "link" | "img" | "src" | {edit: i}
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const words = strip(text).trim() ? strip(text).trim().split(/\s+/).length : 0;
  const minutes = Math.max(1, Math.round(words / 180));

  // Сонгосон хэсгийг солих (Ctrl+Z ажиллахын тулд execCommand ашиглана)
  const replace = (start, end, insert, selFrom = null, selTo = null) => {
    const el = ta.current;
    el.focus();
    el.setSelectionRange(start, end);
    const ok = document.execCommand && document.execCommand("insertText", false, insert);
    if (!ok) {
      const v = el.value.slice(0, start) + insert + el.value.slice(end);
      el.value = v;
      setText(v);
    }
    const a = selFrom ?? start + insert.length, b = selTo ?? a;
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a, b); setText(el.value); });
  };
  const sel = () => {
    const el = ta.current;
    return { s: el.selectionStart, e: el.selectionEnd, v: el.value, t: el.value.slice(el.selectionStart, el.selectionEnd) };
  };
  const wrap = (before, after = before, placeholder = "текст") => {
    const { s, e, t } = sel();
    const inner = t || placeholder;
    replace(s, e, before + inner + after, s + before.length, s + before.length + inner.length);
  };
  // Мөрийн эхэнд тэмдэг нэмэх / арилгах (гарчиг, ишлэл, жагсаалт)
  const prefix = (p, numbered = false) => {
    const { s, e, v } = sel();
    const ls = v.lastIndexOf("\n", s - 1) + 1;
    let le = v.indexOf("\n", e);
    if (le === -1) le = v.length;
    const lines = v.slice(ls, le).split("\n");
    const strip1 = (l) => l.replace(/^(#{1,3}\s+|>\s?|!>\s?|[-*•]\s+|\d{1,3}[.)]\s+)/, "");
    const all = lines.every((l) => (numbered ? /^\d{1,3}[.)]\s+/.test(l) : l.startsWith(p)));
    const out = lines.map((l, k) => (all ? strip1(l) : (numbered ? `${k + 1}. ` : p) + strip1(l))).join("\n");
    replace(ls, le, out, ls, ls + out.length);
  };
  const block = (snippet) => {
    const { s, e, v } = sel();
    const pre = s > 0 && v[s - 1] !== "\n" ? "\n\n" : s > 1 && v[s - 2] !== "\n" ? "\n" : "";
    const post = v[e] && v[e] !== "\n" ? "\n\n" : "\n";
    replace(s, e, pre + snippet + post);
  };
  // Онцлох хайрцаг: гарчиг сонгогдсон байдлаар орно, шууд солих эсвэл мөрийг устгаж гарчиггүй болгоно
  const noteBox = () => {
    const { s, e, v, t } = sel();
    const body = (t || "Энд онцлох баримтаа бичнэ үү").split("\n").map((l) => `!> ${l.replace(/^!>\s?/, "")}`).join("\n");
    const pre = s > 0 && v[s - 1] !== "\n" ? "\n\n" : s > 1 && v[s - 2] !== "\n" ? "\n" : "";
    const head = "!> # Сонирхолтой нь\n";
    const from = s + pre.length + 5;
    replace(s, e, pre + head + body + "\n", from, from + "Сонирхолтой нь".length);
  };
  const cite = (n) => {
    const { s, e } = sel();
    replace(s, e, `[${n}]`);
  };
  const onKey = (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === "b") { e.preventDefault(); wrap("**"); }
    else if (k === "i") { e.preventDefault(); wrap("*"); }
    else if (k === "k") { e.preventDefault(); setDlg("link"); }
  };

  return (
    <div className="re">
      <div className="re-bar" role="toolbar" aria-label="Засварлах хэрэгсэл">
        <div className="re-tabs">
          <button type="button" className={tab === "write" ? "on" : ""} onClick={() => setTab("write")}>Бичих</button>
          <button type="button" className={tab === "preview" ? "on" : ""} onClick={() => setTab("preview")}>Урьдчилж харах</button>
        </div>
        {tab === "write" && (
          <div className="re-tools">
            <Tool label="H1" title="Том гарчиг" onClick={() => prefix("# ")} />
            <Tool label="H2" title="Дунд гарчиг" onClick={() => prefix("## ")} />
            <Tool label="H3" title="Жижиг гарчиг" onClick={() => prefix("### ")} />
            <i className="re-sep" />
            <Tool title="Тод (Ctrl+B)" onClick={() => wrap("**")}>{I.bold}</Tool>
            <Tool title="Налуу (Ctrl+I)" onClick={() => wrap("*")}>{I.italic}</Tool>
            <Tool title="Тодруулга (маркер)" onClick={() => wrap("==")}>{I.hl}</Tool>
            <Tool title="Холбоос (Ctrl+K)" onClick={() => setDlg("link")}>{I.link}</Tool>
            <i className="re-sep" />
            <Tool title="Ишлэл" onClick={() => prefix("> ")}>{I.quote}</Tool>
            <Tool title="Жагсаалт" onClick={() => prefix("- ")}>{I.ul}</Tool>
            <Tool title="Дугаартай жагсаалт" onClick={() => prefix("", true)}>{I.ol}</Tool>
            <Tool title="Онцлох хайрцаг (гарчгийг нь сольж эсвэл устгаж болно)" onClick={noteBox}>{I.note}</Tool>
            <Tool title="Хуваах зураас" onClick={() => block("---")}>{I.hr}</Tool>
            <i className="re-sep" />
            <Tool title="Зураг оруулах" onClick={() => setDlg("img")}>{I.img}</Tool>
            <Tool title="Эх сурвалжийн ишлэл [1] оруулах" onClick={() => (sources.length ? setDlg("cite") : setDlg("src"))}>{I.cite}</Tool>
          </div>
        )}
        <span className="wr-count">{words} үг · {minutes} мин унших</span>
      </div>

      <textarea
        ref={ta}
        name="body"
        required
        rows={18}
        maxLength={40000}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKey}
        placeholder={"Энд бичнэ үү…\n\nДогол мөр хооронд хоосон мөр үлдээнэ. Дээрх хэрэгслээр гарчиг, тод, налуу, ишлэл, зураг, холбоос нэмнэ."}
        aria-label="Агуулга"
        className="re-area"
        hidden={tab !== "write"}
      />
      {tab === "preview" && (
        <div className="re-preview ar-body">
          {text.trim() ? render(text) : <p className="re-empty">Урьдчилж харах зүйл алга. «Бичих» таб дээр агуулгаа бичнэ үү.</p>}
          {sources.length > 0 && <Sources sources={sources} />}
        </div>
      )}
      <details className="re-help">
        <summary>Тэмдэглэгээний заавар</summary>
        <ul>
          <li><code># Гарчиг</code> · <code>## Дэд гарчиг</code> · <code>### Жижиг гарчиг</code></li>
          <li><code>**тод**</code> · <code>*налуу*</code> · <code>==тодруулга==</code> · <code>[текст](https://холбоос)</code></li>
          <li><code>&gt; ишлэл</code> (сүүлийн мөрөнд <code>— Нэр</code>) · <code>!&gt; онцлох хайрцаг</code> (эхний мөр <code>!&gt; # Гарчиг</code> бол гарчигтай)</li>
          <li><code>- жагсаалт</code> · <code>1. дугаартай</code> · <code>---</code> зураас · <code>[1]</code> эх сурвалжийн ишлэл</li>
        </ul>
      </details>

      <input type="hidden" name="sources" value={JSON.stringify(sources)} />
      {sources.length > 0 && (
        <div className="re-sources">
          <b>Эх сурвалж · {sources.length}</b>
          <ol>
            {sources.map((s, i) => {
              const f = formatSource(s);
              return (
                <li key={i}>
                  <span className="re-src-t">{f.lead && <>{f.lead}. </>}<i>{s.title}</i>{f.tail && <small> · {f.tail}</small>}</span>
                  <span className="re-src-a">
                    <button type="button" onClick={() => { setTab("write"); requestAnimationFrame(() => cite(i + 1)); }} title="Курсорын байрлалд ишлэл оруулах">[{i + 1}] оруулах</button>
                    <button type="button" onClick={() => setDlg({ edit: i })}>Засах</button>
                    <button type="button" onClick={() => setSources((a) => a.filter((_, k) => k !== i))}>Хасах</button>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <div className="wr-inserts">
        <DictAdd className="wr-insert" label="Шинэ үгийн тайлбар нэмэх" loggedIn={loggedIn} icon={<img src="/icons/book18.svg" width={18} height={18} alt="" />} inEditor />
        <button type="button" className="wr-insert" onClick={() => setDlg("src")}><img src="/icons/link18.svg" width={18} height={18} alt="" />Эх сурвалж нэмэх</button>
      </div>

      {mounted && dlg === "link" && <LinkDialog sel={ta.current ? sel().t : ""} onClose={() => setDlg(null)}
        onInsert={(label, url) => { const { s, e } = sel(); replace(s, e, `[${label}](${url})`); setDlg(null); }} />}
      {mounted && dlg === "img" && <ImageDialog onClose={() => setDlg(null)}
        onInsert={(md) => { setDlg(null); requestAnimationFrame(() => block(md)); }} />}
      {mounted && dlg === "cite" && (
        <Modal title="Эх сурвалжийн ишлэл оруулах" sub="Курсорын байрлалд [дугаар] орно. Нийтлэлд дарахад доорх эх сурвалж руу шилжинэ." onClose={() => setDlg(null)}>
          <div className="re-cite">
            {sources.map((s, i) => (
              <button key={i} type="button" onClick={() => { setDlg(null); requestAnimationFrame(() => cite(i + 1)); }}>
                <b>[{i + 1}]</b> {s.title}
              </button>
            ))}
            <button type="button" className="re-cite-new" onClick={() => setDlg("src")}>＋ Шинэ эх сурвалж нэмэх</button>
          </div>
        </Modal>
      )}
      {mounted && (dlg === "src" || dlg?.edit !== undefined) && (
        <SourceDialog initial={dlg?.edit !== undefined ? sources[dlg.edit] : null} n={dlg?.edit !== undefined ? dlg.edit + 1 : sources.length + 1}
          onClose={() => setDlg(null)}
          onSave={(src, insert) => {
            if (dlg?.edit !== undefined) setSources((a) => a.map((x, k) => (k === dlg.edit ? src : x)));
            else {
              const n = sources.length + 1;
              setSources((a) => [...a, src]);
              if (insert) { setTab("write"); requestAnimationFrame(() => cite(n)); }
            }
            setDlg(null);
          }} />
      )}
    </div>
  );
}

// Нийтлэлийн төгсгөлийн эх сурвалж (Figma 454:272)
const SRC_TAG = { "Вэб хуудас": "Вэб", "Сэтгүүлийн өгүүлэл": "Өгүүлэл", "Судалгааны тайлан": "Тайлан" };
export function Sources({ sources }) {
  return (
    <section className="md-sources" id="sources">
      <h3><img className="ic" src="/icons/f_link.svg" width={15} height={15} alt="" />Эх сурвалж</h3>
      <ol>
        {sources.map((s, i) => {
          const host = s.url ? String(s.url).replace(/^https?:\/\/(www\.)?/, "").split("/")[0] : null;
          const meta = [s.author, host && s.type === "Вэб хуудас" ? host : null, s.type === "Вэб хуудас" ? null : s.type,
            s.date && String(s.date).replace(/-/g, "."), s.pages && `${s.pages} х.`, s.lang && `${s.lang} хэл`].filter(Boolean).join(" · ");
          return (
            <li key={i} id={`src-${i + 1}`}>
              <span className="md-src-l">
                <em className={"md-src-tag t" + (SOURCE_TYPES.indexOf(s.type) % 4)}>{SRC_TAG[s.type] || s.type}</em>
                {s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer nofollow">{s.title} ↗</a> : <b>{s.title}</b>}
              </span>
              {meta && <small>{meta}</small>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function LinkDialog({ sel, onClose, onInsert }) {
  const [label, setLabel] = useState(sel || "");
  const [url, setUrl] = useState("https://");
  const ok = label.trim() && /^https?:\/\/\S+\.\S+/.test(url.trim());
  return (
    <Modal title="Холбоос нэмэх" sub="Сонгосон текстийг вэб хуудас руу холбоно." onClose={onClose}>
      <div className="tm-form">
        <div className="tm-grid">
          <label className="wide"><span>Харагдах текст <i>*</i></span><input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Жишээ: НАСА-гийн мэдээ" autoFocus={!sel} /></label>
          <label className="wide"><span>Холбоос (URL) <i>*</i></span>
            <span className="tm-link"><img className="ic" src="/icons/f_link.svg" width={16} height={16} alt="" />
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." autoFocus={!!sel} /></span></label>
        </div>
        <div className="tm-foot">
          <span className="ss-grow" />
          <button type="button" className="tm-btn ghost" onClick={onClose}>Болих</button>
          <button type="button" className="tm-btn" disabled={!ok} onClick={() => onInsert(label.trim().replace(/[[\]]/g, ""), url.trim())}>Оруулах</button>
        </div>
      </div>
    </Modal>
  );
}

function ImageDialog({ onClose, onInsert }) {
  const file = useRef(null);
  const [id, setId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [caption, setCaption] = useState("");
  const [source, setSource] = useState("");
  const [url, setUrl] = useState("");
  const pick = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setErr(""); setBusy(true);
    try { setId(await uploadImageFile(f, { maxW: 1600 })); } catch (x) { setErr(x.message || "Зураг оруулж чадсангүй"); } finally { setBusy(false); }
  };
  const clean = (s) => s.replace(/["|]/g, "'").trim();
  const ok = id && source.trim();
  return (
    <Modal title="Нийтлэлд зураг оруулах" sub="Зураг бүрийн эх сурвалжийг заавал дурдана. Тайлбар нь зургийн доор харагдана." onClose={onClose}>
      <div className="tm-form">
        {err && <p className="tm-err">{err}</p>}
        <input ref={file} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" hidden onChange={pick} />
        <button type="button" className={"re-drop" + (id ? " has" : "")} onClick={() => !busy && file.current?.click()}>
          {id ? <img src={`/img/${id}`} alt="" /> : <span>{busy ? "Оруулж байна…" : "＋ Зураг сонгох"}<small>JPG, PNG, WEBP · автоматаар жижигрүүлнэ</small></span>}
        </button>
        <div className="tm-grid">
          <label className="wide"><span>Зургийн тайлбар <em>заавал биш</em></span>
            <input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={200} placeholder="Жишээ: Хаббл дурангаар авсан Андромеда галактик" /></label>
          <label><span>Эх сурвалж <i>*</i></span>
            <input value={source} onChange={(e) => setSource(e.target.value)} maxLength={150} placeholder="Жишээ: NASA/ESA, Хаббл" /></label>
          <label><span>Эх сурвалжийн холбоос <em>заавал биш</em></span>
            <span className="tm-link"><img className="ic" src="/icons/f_link.svg" width={16} height={16} alt="" />
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." /></span></label>
        </div>
        <div className="tm-foot">
          <small>{!id ? "Эхлээд зургаа сонгоно уу." : !source.trim() ? "Зургийн эх сурвалжийг бичнэ үү." : ""}</small>
          <span className="ss-grow" />
          <button type="button" className="tm-btn ghost" onClick={onClose}>Болих</button>
          <button type="button" className="tm-btn" disabled={!ok}
            onClick={() => onInsert(`![${caption.replace(/[\][]/g, "").trim()}](img:${id} "${clean(source)}${/^https?:\/\/\S+$/.test(url.trim()) ? `|${clean(url)}` : ""}")`)}>
            Оруулах
          </button>
        </div>
      </div>
    </Modal>
  );
}

// Figma 550:394 · Эх сурвалж нэмэх
function SourceDialog({ initial, n, onClose, onSave }) {
  const [s, setS] = useState(initial || { type: "", title: "", author: "", date: "", pages: "", lang: "", url: "" });
  const [insert, setInsert] = useState(true);
  const set = (k) => (e) => setS((x) => ({ ...x, [k]: e.target.value }));
  const urlBad = s.url && !/^https?:\/\/\S+$/.test(s.url.trim());
  const ok = s.type && s.title.trim() && !urlBad;
  return (
    <Modal title={initial ? `Эх сурвалж [${n}] засах` : "Эх сурвалж нэмэх"} sub="Нэмсэн эх сурвалж нийтлэлийн төгсгөлд «Эх сурвалж» хэсэгт жагсана." onClose={onClose}>
      <div className="tm-form">
        <div className="tm-grid">
          <label className="wide"><span>Төрөл <i>*</i></span>
            <span className="cat-box"><select value={s.type} onChange={set("type")}><option value="">Сонгох</option>{SOURCE_TYPES.map((t) => <option key={t}>{t}</option>)}</select><img src="/icons/chevdown.svg" width={18} height={18} alt="" /></span></label>
          <label className="wide"><span>Гарчиг <i>*</i></span><input value={s.title} onChange={set("title")} maxLength={300} placeholder="Номын, өгүүллийн эсвэл хуудасны нэр" /></label>
          <label><span>Зохиогч / байгууллага <em>заавал биш</em></span><input value={s.author || ""} onChange={set("author")} maxLength={200} placeholder="Жишээ: Карл Саган" /></label>
          <label><span>Нийтлэгдсэн огноо <em>заавал биш</em></span><input type="date" value={s.date || ""} onChange={set("date")} /></label>
          <label><span>Хуудасны тоо <em>заавал биш</em></span><input value={s.pages || ""} onChange={set("pages")} inputMode="numeric" maxLength={5} placeholder="Жишээ: 120" /></label>
          <label><span>Хэл <em>заавал биш</em></span>
            <span className="cat-box"><select value={s.lang || ""} onChange={set("lang")}><option value="">Сонгох</option>{SOURCE_LANGS.map((t) => <option key={t}>{t}</option>)}</select><img src="/icons/chevdown.svg" width={18} height={18} alt="" /></span></label>
          <label className="wide"><span>Эх сурвалжийн холбоос (URL) <em>заавал биш</em></span>
            <span className="tm-link"><img className="ic" src="/icons/f_link.svg" width={16} height={16} alt="" /><input value={s.url || ""} onChange={set("url")} placeholder="https://..." /></span>
            {urlBad && <small className="re-bad">Холбоос https:// -ээр эхэлнэ</small>}</label>
          {!initial && (
            <label className="wide re-check"><input type="checkbox" checked={insert} onChange={(e) => setInsert(e.target.checked)} /> Курсорын байрлалд [{n}] ишлэл оруулах</label>
          )}
        </div>
        <div className="tm-foot">
          <small>* Заавал бөглөх талбар</small>
          <span className="ss-grow" />
          <button type="button" className="tm-btn ghost" onClick={onClose}>Болих</button>
          <button type="button" className="tm-btn" disabled={!ok} onClick={() => onSave({ ...s, title: s.title.trim(), url: (s.url || "").trim() }, insert)}>Хадгалах</button>
        </div>
      </div>
    </Modal>
  );
}
