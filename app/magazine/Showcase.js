"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import Spark from "../components/Spark";
import { unlockIssue } from "./actions";
import { frontSrc, backSrc, thick, useSpineColor } from "./Mock";


// Нэг дугаарын 3D бие: нүүр, ар тал, нуруу, хуудасны ирмэг, дээд, доод ирмэг
function Book({ issue }) {
  const src = frontSrc(issue);
  const back = backSrc(issue);
  const spine = useSpineColor(src);
  return (
    <span className="mzs-book" style={{ "--t": `${thick(issue, 0.1, 4, 11)}px`, ...(spine ? { "--spine": spine } : {}) }}>
      <span className="mzs-f front">
        {src ? <img src={src} alt={`№${issue.number} дугаарын нүүр`} draggable={false} /> : <i>№{issue.number}</i>}
      </span>
      {back ? (
        <span className="mzs-f back img" aria-hidden="true"><img src={back} alt="" draggable={false} /></span>
      ) : (
        <span className="mzs-f back" aria-hidden="true">
          <b>Science Spark</b>
          <small>№{issue.number} · {issue.title}</small>
          <em>Сонирхлын очыг хамтдаа асаая!</em>
        </span>
      )}
      <span className="mzs-f spine" aria-hidden="true" />
      <span className="mzs-f edge" aria-hidden="true" />
      <span className="mzs-f top" aria-hidden="true" />
      <span className="mzs-f bottom" aria-hidden="true" />
    </span>
  );
}

// Сэтгүүлийн үзэсгэлэн: дугаарууд агаарт хөвнө. Голын дугаарыг чирж (хулгана, хуруу) бүх талаас нь эргүүлж харна,
// хажуугийн дугаар дээр дарахад голд гарч ирнэ.
const mnt = (n) => `${Math.round(n).toLocaleString("en-US")}₮`;

function PayButton({ price }) {
  const { pending } = useFormStatus();
  return <button className="mz-btn spk-btn" disabled={pending}>{pending && <Spark mono size={16} />}{pending ? "Төлж байна…" : `${mnt(price)} төлж унших`}</button>;
}

// «Онлайнаар унших» дээр дарахад: дугаарыг хэтэвчнээс төлж нээх цонх
function BuyPopup({ issue, loggedIn, wallet, onClose }) {
  useEffect(() => {
    const key = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose]);
  const enough = wallet >= issue.price_mnt;
  const free = Math.max(1, issue.preview_pages || 0);
  return (
    <div className="mzs-modal" role="dialog" aria-modal="true" aria-label="Онлайнаар унших" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mzs-pop">
        <button type="button" className="mzs-x" onClick={onClose} aria-label="Хаах">×</button>
        <small>Дугаар {issue.number}</small>
        <b>{issue.title}</b>
        <p className="mzs-price">{mnt(issue.price_mnt)}</p>
        <p>Нэг удаа төлөөд бүтэн дугаарыг хүссэн үедээ онлайнаар уншина. Шинжлэх ухааны сэтгүүлийг дэмжсэнд баярлалаа!</p>
        {!loggedIn ? (
          <Link href="/login" className="mz-btn">Нэвтэрч ороод унших</Link>
        ) : enough ? (
          <form action={unlockIssue}>
            <input type="hidden" name="iid" value={issue.id} />
            <PayButton price={issue.price_mnt} />
            <small className="mzs-wallet">Хэтэвчнээс төлнө · үлдэгдэл {mnt(wallet)}</small>
          </form>
        ) : (
          <>
            <Link href="/wallet?topup=1" className="mz-btn">Хэтэвч цэнэглэх</Link>
            <small className="mzs-wallet">Хэтэвчинд {mnt(wallet)} байна, {mnt(issue.price_mnt - wallet)} дутуу. QPay-ээр цэнэглэнэ</small>
          </>
        )}
        <Link href={`/magazine/${issue.id}#read`} className="mzs-free">Эхний {free} хуудсыг үнэгүй үзэх</Link>
      </div>
    </div>
  );
}

export default function Showcase({ issues, loggedIn = false, wallet = 0 }) {
  const [sel, setSel] = useState(Math.max(0, issues.findLastIndex((i) => i.status === "published")));
  const [rot, setRot] = useState({ x: -6, y: 22 });
  const [drag, setDrag] = useState(false);
  const [buy, setBuy] = useState(null);
  const closeBuy = useCallback(() => setBuy(null), []);
  // Эргүүлсэн бүтэн тойргийг дугаар бүрээр хадгална: голоос гарах, буцаж орохдоо олон эргэхгүй
  const turns = useRef({});
  const st = useRef({ on: false, x: 0, y: 0, vx: 0, vy: 0, t: 0, raf: 0, moved: false });
  const box = useRef(null);
  const cur = issues[sel];

  const stop = () => cancelAnimationFrame(st.current.raf);
  // Сонгосон дугаараа солиход нүүрээр нь эргүүлнэ
  const pick = useCallback((i) => {
    stop();
    const n = issues.length;
    const next = ((i % n) + n) % n;
    if (next === sel) return;
    const t = turns.current;
    t[issues[sel].id] = 360 * Math.round((rot.y - (next > sel ? -32 : 32)) / 360);
    setSel(next);
    setRot({ x: -6, y: 22 + (t[issues[next].id] || 0) });
  }, [issues, sel, rot.y]);

  useEffect(() => {
    const key = (e) => {
      if (e.target.closest?.("input, textarea, select")) return;
      if (e.key === "ArrowRight") pick(sel + 1);
      else if (e.key === "ArrowLeft") pick(sel - 1);
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [sel, pick]);
  useEffect(() => stop, []);

  const down = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    stop();
    Object.assign(st.current, { on: true, x: e.clientX, y: e.clientY, vx: 0, vy: 0, t: performance.now(), moved: false });
    box.current?.setPointerCapture?.(e.pointerId);
    setDrag(true);
  };
  const move = (e) => {
    const s = st.current;
    if (!s.on) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) s.moved = true;
    const now = performance.now(), dt = Math.max(1, now - s.t);
    s.vx = (dx * 0.5) / dt; s.vy = (dy * 0.35) / dt;
    Object.assign(s, { x: e.clientX, y: e.clientY, t: now });
    setRot((r) => ({ x: Math.max(-60, Math.min(60, r.x - dy * 0.35)), y: r.y + dx * 0.5 }));
  };
  // Суллахад эргэлт аажмаар зогсоно
  const up = () => {
    const s = st.current;
    if (!s.on) return;
    s.on = false;
    setDrag(false);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    let vx = s.vx * 16, vy = s.vy * 16;
    const tick = () => {
      vx *= 0.94; vy *= 0.94;
      if (Math.abs(vx) < 0.05 && Math.abs(vy) < 0.05) return;
      setRot((r) => ({ x: Math.max(-60, Math.min(60, r.x - vy)), y: r.y + vx }));
      s.raf = requestAnimationFrame(tick);
    };
    s.raf = requestAnimationFrame(tick);
  };

  if (!cur) return null;
  const n = issues.length;
  // Голоос хэдэн байр зайтай вэ (3-аас олон бол тойрог)
  const dist = (i) => {
    let d = i - sel;
    if (n >= 3) { d = ((d % n) + n) % n; if (d > n / 2) d -= n; }
    return d;
  };
  const live = cur.status === "published";

  return (
    <section className="mzs" aria-label="Сэтгүүлийн дугаарууд">
      <div className="mzs-sky" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /></div>
      <div ref={box} className={"mzs-stage" + (drag ? " drag" : "")} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onContextMenu={(e) => e.preventDefault()}>
        {issues.map((it, i) => {
          const d = dist(i);
          if (Math.abs(d) > 3) return null;
          const main = d === 0;
          const side = d < 0 ? 32 : -32;
          const spin = turns.current[it.id] || 0;
          const tf = main ? `rotateX(${rot.x}deg) rotateY(${rot.y}deg)` : `rotateX(0deg) rotateY(${spin + side}deg)`;
          // Нэг л элемент байрлалаа сольж гулсана (дугаар солиход шинээр зурагдахгүй)
          return (
            <div key={it.id} className={"mzs-slot" + (main ? " main" : Math.abs(d) === 1 ? " near" : Math.abs(d) === 2 ? " far" : " out")}
              style={{ "--d": d }} {...(main ? {} : {
                role: "button", tabIndex: Math.abs(d) <= 2 ? 0 : -1, "aria-label": `№${it.number} дугаарыг харах`,
                onPointerDown: (e) => e.stopPropagation(), onClick: () => pick(i),
                onKeyDown: (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), pick(i)),
              })}>
              <span className="mzs-float" style={{ animationDelay: `${-Math.abs(d) * 1.7}s` }}>
                <span className={"mzs-obj" + (main && drag ? "" : " ease")} style={{ transform: tf }}><Book issue={it} /></span>
              </span>
            </div>
          );
        })}
        <span className="mzs-floor" aria-hidden="true" />
        {issues.length > 1 && (
          <>
            <button type="button" className="mzs-arrow l" onPointerDown={(e) => e.stopPropagation()} onClick={() => pick(sel - 1)} aria-label="Өмнөх дугаар">‹</button>
            <button type="button" className="mzs-arrow r" onPointerDown={(e) => e.stopPropagation()} onClick={() => pick(sel + 1)} aria-label="Дараагийн дугаар">›</button>
          </>
        )}
      </div>

      <div className="mzs-info" key={cur.id}>
        {cur.status !== "published" && <span className="mzs-badge">{cur.status === "draft" ? "Бэлтгэж байна · зөвхөн танд" : "Удахгүй гарна"}</span>}
        <h1>Дугаар {cur.number} · {cur.title}</h1>
        <span className="mzs-acts">
          {live && (cur.own
            ? <Link href={`/magazine/${cur.id}#read`} className="mz-btn">Онлайнаар унших</Link>
            : <button type="button" className="mz-btn" onClick={() => setBuy(cur)}>Онлайнаар унших</button>)}
          {live && cur.print_price > 0 && <Link href={`/magazine/${cur.id}/order`} className="mz-btn ghost">Хүргүүлж авах</Link>}
          {!live && <Link href="/magazine/request" className="mz-btn">Энэ дугаарт нийтлэл, зар байршуулах</Link>}
          {!live && cur.pages > 0 && <Link href={`/magazine/${cur.id}`} className="mz-btn ghost">Урьдчилж харах</Link>}
        </span>
        <span className="mzs-links">
          <Link href="/magazine/request">Сэтгүүлд оролцох</Link>
        </span>
      </div>
      {buy && <BuyPopup issue={buy} loggedIn={loggedIn} wallet={wallet} onClose={closeBuy} />}
    </section>
  );
}
