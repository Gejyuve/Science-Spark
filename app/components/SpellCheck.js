"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { tokens, needsDict } from "@/lib/spell";
import DictAdd from "./DictAdd";
import Spark from "./Spark";

// Бичих самбарын зөв бичгийн шалгагч. «Зөв бичиг шалгах» товч дарахад л толийг ачаална.
// Толинд байхгүй үгийн доор зураас татаж, самбарын доор зөв хувилбаруудыг санал болгоно.

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

const MAX_ROWS = 30;

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
  // Ижил үгийг нэг мөрөнд: { word, n }
  const rows = useMemo(() => {
    const m = new Map();
    for (const x of issues) m.set(x.word, (m.get(x.word) || 0) + 1);
    return [...m].map(([word, n]) => ({ word, n }));
  }, [issues]);

  // Харагдаж буй үгсийн санал (нэг нэгээр нь, толь завгүй болохгүйн тулд)
  const [, bump] = useState(0);
  useEffect(() => {
    let stop = false;
    (async () => {
      for (const r of rows.slice(0, MAX_ROWS)) {
        if (stop) return;
        if (suggests.has(r.word)) continue;
        try { suggests.set(r.word, (await ask({ type: "suggest", word: r.word })).list); } catch { suggests.set(r.word, []); }
        if (!stop) bump((x) => x + 1);
      }
    })();
    return () => { stop = true; };
  }, [rows]);

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
    const onScroll = () => { if (box.current) box.current.scrollTop = el.scrollTop; };
    el.addEventListener("scroll", onScroll);
    return () => { ro.disconnect(); el.removeEventListener("scroll", onScroll); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, hidden]);

  // Тухайн үгийг текстэд сонгож харуулна
  const show = (word) => {
    const el = ta.current, o = box.current;
    if (!el) return;
    let i = issues.findIndex((x) => x.word === word && x.from >= el.selectionEnd);
    if (i < 0) i = issues.findIndex((x) => x.word === word);
    if (i < 0) return;
    el.focus();
    el.setSelectionRange(issues[i].from, issues[i].to);
    const m = o?.querySelectorAll(".sp-m")[i];
    if (m) el.scrollTop = Math.max(0, m.offsetTop - 80);
  };
  // Тухайн үгийг текст дэх бүх газарт нь засна (арагшаа, байрлал хөдлөхгүйн тулд)
  const fix = (word, to) => {
    issues.filter((x) => x.word === word).reverse().forEach((x) => replace(x.from, x.to, to));
  };

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
      <section className="sp-panel" aria-label="Зөв бичгийн шалгалт">
        <div className="sp-head">
          <b>Зөв бичгийн шалгалт</b>
          {status === "ready" && <small>{rows.length ? `Толинд олдоогүй ${rows.length} үг` : "✓ Алдаа олдсонгүй"}</small>}
          <span className="ss-grow" />
          <button type="button" className="sp-x" onClick={onClose} aria-label="Хаах">×</button>
        </div>

        {status === "loading" && (
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
        {status === "error" && <p className="sp-err">Толийг ачаалж чадсангүй. Хуудсаа дахин ачаалаад оролдоно уу.</p>}

        {status === "ready" && rows.length > 0 && (
          <ul className="sp-rows">
            {rows.slice(0, MAX_ROWS).map(({ word, n }) => {
              const list = suggests.get(word);
              return (
                <li key={word}>
                  <button type="button" className="sp-word" onClick={() => show(word)} title="Текстээс харах">{word}{n > 1 && <small> ×{n}</small>}</button>
                  <span className="sp-arrow">→</span>
                  <span className="sp-sug">
                    {list === undefined ? <Spark mono size={14} />
                      : list.length ? list.map((s) => <button type="button" key={s} onClick={() => fix(word, s)}>{s}</button>)
                      : <><em>санал олдсонгүй</em><DictAdd className="sp-dict-sm" label="Тольд нэмэх" word={word} loggedIn={loggedIn} /></>}
                  </span>
                  <button type="button" className="sp-skip" onClick={() => setSkip((x) => new Set(x).add(word))}>Алгасах</button>
                </li>
              );
            })}
            {rows.length > MAX_ROWS && <li className="sp-more">…бас {rows.length - MAX_ROWS} үг. Эхнийхийг засахад дараагийнх гарч ирнэ.</li>}
          </ul>
        )}

        {status === "ready" && (
          <div className="sp-foot">
            <p>Шинэ нэр томьёо, хүний болон газрын нэр толинд байхгүй байж болно. Ийм үгийн тайлбарыг манай <b>Тольд</b> нэмж, бусад уншигчдад тусалаарай.</p>
            <DictAdd className="sp-dict" label="Тольд үг нэмэх" loggedIn={loggedIn} icon={<img src="/icons/book18.svg" width={16} height={16} alt="" />} />
          </div>
        )}
      </section>
    </>
  );
}
