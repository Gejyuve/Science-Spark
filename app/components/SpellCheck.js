"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { tokens, needsDict } from "@/lib/spell";
import DictAdd from "./DictAdd";
import Spark from "./Spark";

// Бичих самбарын зөв бичгийн шалгагч. «Зөв бичиг шалгах» товч дарахад л толийг ачаална.
// Толинд байхгүй үгийн доор зураас татна; тэр үг дээр дарахад зөв хувилбарууд гарч ирнэ.

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

export default function SpellCheck({ on, onClose, ta, text, hidden, replace, loggedIn }) {
  const [skip, setSkip] = useState(() => new Set());
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [ver, setVer] = useState(0);
  const cache = useRef(new Map()); // үг → толинд байгаа эсэх
  const box = useRef(null);

  useEffect(() => { if (ta.current) ta.current.spellcheck = !on; }, [on, ta]);

  const toks = useMemo(() => (on ? tokens(text) : []), [text, on]);

  // Анх нээхэд шууд, дараа нь бичиж дуусахыг хүлээгээд шинэ үгсийг шалгана
  const first = useRef(true);
  useEffect(() => { if (!on) first.current = true; }, [on]);
  useEffect(() => {
    if (!on) return;
    const t = setTimeout(() => {
      const fresh = [...new Set(toks.filter((x) => needsDict(x.word) && !cache.current.has(x.word)).map((x) => x.word))];
      if (!fresh.length) { setStatus((s) => (s === "error" ? s : "ready")); return; }
      ask({ type: "check", words: fresh }).then(({ bad }) => {
        const b = new Set(bad);
        for (const w of fresh) cache.current.set(w, !b.has(w));
        setStatus("ready");
        setVer((v) => v + 1);
      }).catch(() => setStatus("error"));
    }, first.current ? 0 : 500);
    first.current = false;
    return () => clearTimeout(t);
  }, [toks, on]);

  const issues = useMemo(
    () => toks.filter((t) => !skip.has(t.word) && needsDict(t.word) && cache.current.get(t.word) === false),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toks, skip, ver]
  );
  const [pop, setPop] = useState(null); // { i, word, top, left, list }
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
    const o = box.current, m = o?.querySelectorAll(".sp-m")[i];
    if (!m) return;
    const r = m.getBoundingClientRect(), p = o.parentElement.getBoundingClientRect();
    const word = issues[i].word;
    const list = suggests.get(word) ?? null;
    setPop({ i, word, top: r.bottom - p.top + 6, left: Math.max(0, Math.min(r.left - p.left, p.width - 300)), list });
    if (list === null) ask({ type: "suggest", word }).then(({ list }) => {
      suggests.set(word, list);
      setPop((x) => (x && x.word === word ? { ...x, list } : x));
    }).catch(() => setPop((x) => (x && x.word === word ? { ...x, list: [] } : x)));
  };

  // Зураастай үг дээр дарахад хувилбаруудыг гаргана
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
  useEffect(() => setPop(null), [text, hidden, on]);
  useEffect(() => {
    if (!pop) return;
    const esc = (e) => e.key === "Escape" && !document.querySelector(".tm-overlay") && setPop(null);
    // «Тольд нэмэх» цонх нээлттэй үед санал хаагдахгүй
    const out = (e) => !e.target.closest?.(".sp-pop, .tm-overlay") && e.target !== ta.current && setPop(null);
    document.addEventListener("keydown", esc);
    document.addEventListener("mousedown", out);
    return () => { document.removeEventListener("keydown", esc); document.removeEventListener("mousedown", out); };
  }, [pop, ta]);

  const fix = (s) => { const it = issues[pop.i]; setPop(null); replace(it.from, it.to, s); };
  const ignore = () => { const w = pop.word; setPop(null); setSkip((x) => new Set(x).add(w)); };

  if (!on || hidden) return null;
  const marks = [];
  let at = 0;
  issues.forEach((x, i) => {
    marks.push(text.slice(at, x.from), <mark key={i} className="sp-m">{text.slice(x.from, x.to)}</mark>);
    at = x.to;
  });
  marks.push(text.slice(at) + "\n ");

  return (
    <>
      <div ref={box} className="sp-layer" aria-hidden="true">{marks}</div>
      {pop && (
        <div className="sp-pop" style={{ top: pop.top, left: pop.left }} onMouseDown={(e) => e.target.closest(".tm-overlay") || e.preventDefault()} role="dialog" aria-label="Зөв бичгийн санал">
          <div className="sp-sug">
            {pop.list === null ? <span className="spk-btn"><Spark mono size={14} />Хайж байна…</span>
              : pop.list.length ? pop.list.map((s) => <button type="button" key={s} onClick={() => fix(s)}>{s}</button>)
              : <span>«{pop.word}» толинд алга, санал олдсонгүй.</span>}
          </div>
          <p>Шинэ нэр томьёо бол манай Тольд тайлбарыг нь нэмээрэй.</p>
          <div className="sp-act">
            <button type="button" onClick={ignore}>Алгасах</button>
            <DictAdd className="sp-act-dict" label="Тольд нэмэх" word={pop.word} loggedIn={loggedIn} />
          </div>
        </div>
      )}
      {status !== "ready" ? (
        <section className="sp-panel" aria-label="Зөв бичгийн шалгалт">
          {status === "error" ? <p className="sp-err">Толийг ачаалж чадсангүй. Хуудсаа дахин ачаалаад оролдоно уу.</p> : (
            <div className="sp-about">
              <p className="spk-btn"><Spark mono size={16} />Монгол хэлний зөв бичгийн толийг ачаалж байна… <small>(≈1.8 MB, зөвхөн эхний удаа)</small></p>
              <p>
                Энэ толийг <a href="https://zuv.bichig.dev" target="_blank" rel="noopener noreferrer">zuv.bichig.dev</a> төслийн
                хүрээнд Д. Батмөнх бүтээсэн. Академич Ц. Дамдинсүрэн нарын «Монгол үсгийн дүрмийн толь»-д тулгуурласан бөгөөд
                60 мянга орчим үг, тэдгээрийн 2 тэрбум гаруй хувилбарыг агуулдаг. Үнэгүй, нээлттэй толь.
              </p>
              <p>Шалгалт таны хөтөч дотор явагдах тул бичсэн зүйл тань хаашаа ч илгээгдэхгүй.</p>
            </div>
          )}
        </section>
      ) : (
        <p className="sp-line">
          {issues.length ? <>Зураастай <b>{issues.length}</b> үг байна. Үг дээр дарахад зөв хувилбарууд гарч ирнэ.</> : <span className="ok">✓ Зөв бичгийн алдаа олдсонгүй</span>}
          <span className="ss-grow" />
          <button type="button" onClick={onClose}>Шалгалтыг хаах</button>
        </p>
      )}
    </>
  );
}
