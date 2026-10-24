"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { tokens, ruleIssue, needsDict } from "@/lib/spell";
import Spark from "./Spark";

// Бичих самбарын зөв бичгийн шалгагч: textarea-гийн дээр тунгалаг давхарга тавьж
// сэжигтэй үгийн доор долгионтой зураас татна. Үг дээр дарахад засах санал гарна.

let worker = null, seq = 0;
const waits = new Map();
const suggests = new Map();
function ask(msg) {
  if (!worker) {
    worker = new Worker(new URL("./spell.worker.js", import.meta.url));
    worker.onmessage = (e) => {
      const w = waits.get(e.data.id);
      if (!w) return;
      waits.delete(e.data.id);
      e.data.error ? w.rej(new Error(e.data.error)) : w.res(e.data);
    };
    worker.onerror = () => { for (const w of waits.values()) w.rej(new Error("worker")); waits.clear(); };
  }
  const id = ++seq;
  return new Promise((res, rej) => { waits.set(id, { res, rej }); worker.postMessage({ ...msg, id }); });
}

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

const KIND = { spell: "Толинд байхгүй үг", rule: "Сайтын дүрэм", mix: "Латин үсэг орсон" };

export default function SpellCheck({ ta, text, hidden, replace }) {
  const [on, setOn] = useState(true);
  const [mine, setMine] = useState(() => new Set());
  const [skip, setSkip] = useState(() => new Set());
  const [status, setStatus] = useState("idle"); // idle | loading | ready | error
  const [ver, setVer] = useState(0);
  const cache = useRef(new Map()); // үг → толинд байгаа эсэх
  const box = useRef(null);
  const [pop, setPop] = useState(null); // { i, top, left, list }

  useEffect(() => {
    setOn(!store.get("ss-spell-off", false));
    setMine(new Set(store.get("ss-spell-mine", [])));
  }, []);
  useEffect(() => { if (ta.current) ta.current.spellcheck = !on; }, [on, ta]);

  const toks = useMemo(() => tokens(text), [text]);

  // Шинэ үгсийг бичиж дуусахыг хүлээгээд толиор шалгана
  useEffect(() => {
    if (!on) return;
    const t = setTimeout(() => {
      const fresh = [...new Set(toks.filter((x) => needsDict(x.word) && !ruleIssue(x.word) && !cache.current.has(x.word)).map((x) => x.word))];
      if (!fresh.length) { setStatus((s) => (s === "idle" ? "ready" : s)); return; }
      setStatus((s) => (s === "ready" ? s : "loading"));
      ask({ type: "check", words: fresh }).then(({ bad }) => {
        const b = new Set(bad);
        for (const w of fresh) cache.current.set(w, !b.has(w));
        setStatus("ready");
        setVer((v) => v + 1);
      }).catch(() => setStatus("error"));
    }, 500);
    return () => clearTimeout(t);
  }, [toks, on]);

  const issues = useMemo(() => {
    if (!on) return [];
    const out = [];
    for (const t of toks) {
      if (skip.has(t.word)) continue;
      const r = ruleIssue(t.word);
      if (r) out.push({ ...t, ...r });
      else if (needsDict(t.word) && cache.current.get(t.word) === false && !mine.has(t.word.toLowerCase())) out.push({ ...t, kind: "spell" });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toks, on, skip, mine, ver]);

  // Давхаргыг textarea-тай яг ижил байрлал, үсэг, мөр хоорондын зайтай болгоно
  const sync = () => {
    const el = ta.current, o = box.current;
    if (!el || !o) return;
    const cs = getComputedStyle(el);
    Object.assign(o.style, {
      top: el.offsetTop + parseFloat(cs.borderTopWidth) + "px",
      left: el.offsetLeft + parseFloat(cs.borderLeftWidth) + "px",
      width: el.clientWidth + "px",
      height: el.clientHeight + "px",
      padding: cs.padding,
      fontFamily: cs.fontFamily, fontSize: cs.fontSize, fontWeight: cs.fontWeight, lineHeight: cs.lineHeight,
      letterSpacing: cs.letterSpacing, wordSpacing: cs.wordSpacing, tabSize: cs.tabSize,
    });
    o.scrollTop = el.scrollTop;
  };
  useLayoutEffect(sync);
  useEffect(() => {
    const el = ta.current;
    if (!el || !on) return;
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    const onScroll = () => { if (box.current) box.current.scrollTop = el.scrollTop; setPop(null); };
    el.addEventListener("scroll", onScroll);
    return () => { ro.disconnect(); el.removeEventListener("scroll", onScroll); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, hidden]);

  const open = (i) => {
    const o = box.current, m = o?.querySelector(`[data-i="${i}"]`);
    if (!m) return;
    const r = m.getBoundingClientRect(), p = o.parentElement.getBoundingClientRect();
    const it = issues[i];
    const list = it.kind === "spell" ? suggests.get(it.word) ?? null : it.fix ? [it.fix] : [];
    setPop({ i, word: it.word, top: r.bottom - p.top + 6, left: Math.max(0, Math.min(r.left - p.left, p.width - 280)), list });
    if (list === null) ask({ type: "suggest", word: it.word }).then(({ list }) => {
      suggests.set(it.word, list);
      setPop((x) => (x && x.word === it.word ? { ...x, list } : x));
    }).catch(() => setPop((x) => (x && x.word === it.word ? { ...x, list: [] } : x)));
  };

  // Сэжигтэй үг дээр дарахад санал гаргана
  useEffect(() => {
    const el = ta.current;
    if (!el || !on) return;
    const up = () => {
      if (el.selectionStart !== el.selectionEnd) return setPop(null);
      const c = el.selectionStart;
      const i = issues.findIndex((x) => x.from <= c && c <= x.to);
      i < 0 ? setPop(null) : open(i);
    };
    el.addEventListener("mouseup", up);
    return () => el.removeEventListener("mouseup", up);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issues, on]);
  useEffect(() => setPop(null), [text, hidden]);
  useEffect(() => {
    if (!pop) return;
    const esc = (e) => e.key === "Escape" && setPop(null);
    const out = (e) => !e.target.closest?.(".sp-pop") && e.target !== ta.current && setPop(null);
    document.addEventListener("keydown", esc);
    document.addEventListener("mousedown", out);
    return () => { document.removeEventListener("keydown", esc); document.removeEventListener("mousedown", out); };
  }, [pop, ta]);

  // Курсорын дараах эхний сэжигтэй үг рүү очно
  const next = () => {
    const el = ta.current, o = box.current;
    if (!el || !o || !issues.length) return;
    let i = issues.findIndex((x) => x.from > el.selectionEnd);
    if (i < 0) i = 0;
    const it = issues[i];
    el.focus();
    el.setSelectionRange(it.from, it.to);
    const m = o.querySelector(`[data-i="${i}"]`);
    if (m) el.scrollTop = Math.max(0, m.offsetTop - 80);
    o.scrollTop = el.scrollTop;
    requestAnimationFrame(() => open(i));
  };

  const fix = (s) => { const it = issues[pop.i]; setPop(null); replace(it.from, it.to, s); };
  const ignore = () => { const w = issues[pop.i].word; setPop(null); setSkip((x) => new Set(x).add(w)); };
  const learn = () => {
    const w = issues[pop.i].word.toLowerCase();
    setPop(null);
    setMine((x) => { const n = new Set(x).add(w); store.set("ss-spell-mine", [...n].slice(-2000)); return n; });
  };
  const toggle = () => { store.set("ss-spell-off", on); setOn(!on); setPop(null); };

  const marks = [];
  let at = 0;
  issues.forEach((x, i) => {
    marks.push(text.slice(at, x.from), <mark key={i} data-i={i} className={"sp-m " + x.kind}>{text.slice(x.from, x.to)}</mark>);
    at = x.to;
  });
  marks.push(text.slice(at) + "\n ");

  const it = pop && issues[pop.i];
  return (
    <>
      {on && !hidden && <div ref={box} className="sp-layer" aria-hidden="true">{marks}</div>}
      {it && !hidden && (
        <div className="sp-pop" style={{ top: pop.top, left: pop.left }} onMouseDown={(e) => e.preventDefault()} role="dialog" aria-label="Зөв бичгийн санал">
          <small className={"sp-kind " + it.kind}>{KIND[it.kind]}</small>
          {it.note && <p>{it.note}</p>}
          {it.kind === "spell" && <p>«{it.word}» гэсэн үг толинд алга. Дараах хувилбаруудаас сонгож болно:</p>}
          <div className="sp-sug">
            {pop.list === null ? <span className="spk-btn"><Spark mono size={14} />Хайж байна…</span>
              : pop.list.length ? pop.list.map((s) => <button type="button" key={s} onClick={() => fix(s)}>{s}</button>)
              : <span>Санал олдсонгүй</span>}
          </div>
          <div className="sp-act">
            <button type="button" onClick={ignore}>Алгасах</button>
            {it.kind === "spell" && <button type="button" onClick={learn}>Миний толинд нэмэх</button>}
          </div>
        </div>
      )}
      {!hidden && (
        <div className="sp-bar">
          {!on ? <span>Зөв бичгийн шалгалт унтраастай.</span>
            : status === "error" ? <span className="bad">Монгол толийг ачаалж чадсангүй. Хуудсаа дахин ачаална уу.</span>
            : status !== "ready" ? <span className="spk-btn"><Spark mono size={14} />Монгол толь ачаалж байна…</span>
            : issues.length ? <>
                <span><i className="sp-dot" />Шалгах үг: <b>{issues.length}</b></span>
                <button type="button" onClick={next}>Дараагийнх →</button>
              </>
            : <span className="ok">✓ Зөв бичгийн алдаа олдсонгүй</span>}
          <span className="ss-grow" />
          {on && <small className="sp-legend"><i className="sp-dot" />толинд алга <i className="sp-dot rule" />сайтын дүрэм</small>}
          <button type="button" onClick={toggle}>{on ? "Унтраах" : "Зөв бичиг шалгах"}</button>
        </div>
      )}
    </>
  );
}
