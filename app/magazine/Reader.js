"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const FLIP_MS = 700;
const SLIDE_MS = 520;
const MAX_ZOOM = 3;

// Аль хуудсууд зэрэг харагдах вэ: хос хуудастай үед 1-р хуудас (нүүр) ганцаараа, дараа нь 2–3, 4–5 …
const spreadOf = (p, two, pages) => {
  if (!two || p <= 1) return [p];
  const l = p % 2 === 0 ? p : p - 1;
  return [l, l + 1].filter((q) => q <= pages);
};

// Сэтгүүл уншигч: хуудсыг нэг нэгээр (компьютер дээр хос хуудсаар) харуулна.
// Хуудас бүр зураг тул файл татах зүйл алга; баруун товч, чирэх, сонгохыг хааж, уншигчийн нэрийг усан тэмдэг болгон тавина.
// Эрхгүй хуудсанд хүрэхэд `locked` (худалдаж авах хэсэг) гарна.
// Хуудас солиход цаас эргэх мэт эргэнэ; нүүр, сүүлийн ганц хуудас руу (эсвэл тэндээс) шилжихэд зөөлөн гулсана.
// Томруулах товч, хулганы дугуй, давхар дарахаар ойртуулж, чирж харна.
export default function Reader({ issueId, pages, free, access, start = 1, ratio = 0.707, mark = "", locked = null, saveProgress = false }) {
  const last = access ? pages : Math.min(free, pages);
  const [page, setPage] = useState(Math.min(Math.max(1, start), pages));
  const [wide, setWide] = useState(false);
  const [full, setFull] = useState(false);
  const [anim, setAnim] = useState(null);
  const [zoom, setZoom] = useState({ z: 1, x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const box = useRef(null);
  const stage = useRef(null);
  const touch = useRef(null);
  const pan = useRef(null);
  const timer = useRef(0);

  // Компьютер дээр хос хуудсаар (утсан дээр нэг хуудсаар)
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)");
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const shown = spreadOf(page, wide, pages);
  const left = shown[0];
  const end = shown[shown.length - 1];

  const go = useCallback((to) => {
    const next = Math.min(Math.max(1, to), pages);
    const from = spreadOf(page, wide, pages);
    const dest = spreadOf(next, wide, pages);
    if (dest[0] === from[0]) return;
    setZoom({ z: 1, x: 0, y: 0 });
    clearTimeout(timer.current);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fwd = dest[0] > from[0];
    // Ганц хуудас (нүүр, сүүлийн хуудас, утсан дээрх эхний/сүүлийн) оролцвол гулсана, бусад үед цаас эргэнэ
    const edge = (wide && (from.length === 1 || dest.length === 1)) || (!wide && (Math.min(from[0], dest[0]) === 1 || Math.max(from[0], dest[0]) === pages));
    const far = Math.abs(dest[0] - from[0]) > (wide ? 2 : 1);
    if (!reduce) {
      const kind = edge || far ? "slide" : "flip";
      setAnim({ kind, fwd, from, to: dest, key: Date.now() });
      timer.current = setTimeout(() => setAnim(null), kind === "flip" ? FLIP_MS : SLIDE_MS);
    }
    setPage(next);
  }, [page, wide, pages]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const next = useCallback(() => go(end + 1), [go, end]);
  const prev = useCallback(() => go(left - 1), [go, left]);

  useEffect(() => {
    const key = (e) => {
      if (e.target.closest?.("input, textarea, select")) return;
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [next, prev]);

  useEffect(() => {
    const fs = () => setFull(document.fullscreenElement === box.current);
    document.addEventListener("fullscreenchange", fs);
    return () => document.removeEventListener("fullscreenchange", fs);
  }, []);
  const toggleFull = () => {
    const p = document.fullscreenElement ? document.exitFullscreen() : box.current?.requestFullscreen?.();
    p?.catch?.(() => {});
  };

  // Томруулалт: (cx, cy) цэг (stage дотор) байрнаасаа хөдлөхгүйгээр z болгоно; хүрээнээс гаргахгүй
  const zoomAt = useCallback((z, cx, cy) => {
    const el = stage.current;
    if (!el) return;
    const w = el.clientWidth, h = el.clientHeight;
    setZoom((o) => {
      const nz = Math.min(MAX_ZOOM, Math.max(1, z(o.z)));
      if (nz === 1) return { z: 1, x: 0, y: 0 };
      const px = cx ?? w / 2, py = cy ?? h / 2;
      const x = px - ((px - o.x) * nz) / o.z, y = py - ((py - o.y) * nz) / o.z;
      return { z: nz, x: Math.min(0, Math.max(w - w * nz, x)), y: Math.min(0, Math.max(h - h * nz, y)) };
    });
  }, []);
  const rel = (e) => {
    const r = stage.current.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  // Хулганы дугуй: дээш эргүүлэхэд ойртуулна. Томруулаагүй үед доош эргүүлбэл хуудас ердийнхөөрөө гүйлгэгдэнэ.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const wheel = (e) => {
      const zoomed = el.dataset.z !== "1";
      if (!zoomed && e.deltaY >= 0) return;
      e.preventDefault();
      const [cx, cy] = rel(e);
      zoomAt((z) => z * Math.exp(-e.deltaY * 0.0022), cx, cy);
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [zoomAt]);
  const toggleZoom = (e) => {
    if (e?.target?.closest?.(".mz-side")) return;
    const [cx, cy] = e?.clientX != null ? rel(e) : [];
    zoomAt((z) => (z > 1 ? 1 : 2), cx, cy);
  };
  const panDown = (e) => {
    if (zoom.z === 1 || (e.button !== undefined && e.button !== 0)) return;
    pan.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setPanning(true);
  };
  const panMove = (e) => {
    const p = pan.current;
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    pan.current = { x: e.clientX, y: e.clientY };
    const el = stage.current, w = el.clientWidth, h = el.clientHeight;
    setZoom((o) => ({ ...o, x: Math.min(0, Math.max(w - w * o.z, o.x + dx)), y: Math.min(0, Math.max(h - h * o.z, o.y + dy)) }));
  };
  const panUp = () => { pan.current = null; setPanning(false); };

  // Дараагийн хуудсуудыг урьдчилж ачаална
  useEffect(() => {
    for (let p = end + 1; p <= Math.min(last, end + 2); p++) {
      const img = new Image();
      img.src = `/api/magazine/page?i=${issueId}&p=${p}`;
    }
  }, [issueId, end, last]);

  // Худалдаж авсан бол хаана хүртэл уншсаныг хадгална (хуудас эргүүлэхээ зогсоосны дараа)
  // Хуудаснаас гарахад хадгалаагүй үлдсэнийг тэр даруй илгээнэ
  const unsaved = useRef(null);
  const flush = useCallback(() => {
    if (unsaved.current == null) return;
    fetch("/api/magazine/page", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ i: issueId, p: unsaved.current }), keepalive: true }).catch(() => {});
    unsaved.current = null;
  }, [issueId]);
  useEffect(() => {
    if (!saveProgress) return;
    unsaved.current = end;
    const t = setTimeout(flush, 1200);
    return () => clearTimeout(t);
  }, [saveProgress, end, flush]);
  useEffect(() => {
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [flush]);

  const block = (e) => e.preventDefault();
  const onTouchStart = (e) => { touch.current = zoom.z === 1 ? e.touches[0]?.clientX ?? null : null; };
  const onTouchEnd = (e) => {
    const x0 = touch.current;
    const x1 = e.changedTouches[0]?.clientX;
    touch.current = null;
    if (x0 == null || x1 == null || Math.abs(x1 - x0) < 50) return;
    if (x1 < x0) next();
    else prev();
  };

  // Нэг хуудасны агуулга (зураг + усан тэмдэг, эсвэл түгжээ)
  const content = (p, locks) => (p <= last || p === pages ? (
    <>
      <img src={`/api/magazine/page?i=${issueId}&p=${p}`} alt={`${p}-р хуудас`} draggable={false} />
      {mark && <span className="mz-mark" aria-hidden="true">{Array.from({ length: 6 }, (_, k) => <i key={k}>{mark}</i>)}</span>}
    </>
  ) : (
    // Хос хуудас хоёулаа түгжээтэй бол худалдаж авах хэсгийг нэг л удаа харуулна
    <div className="mz-lock">{p === locks.find((q) => q > last && q !== pages) && locked}</div>
  ));

  // Цаас эргэх үед: доор нь хуучин, шинэ хуудсуудын хольц, дээр нь эргэж буй хуудас (урд нь хуучин, ар нь шинэ)
  const flip = anim?.kind === "flip" ? anim : null;
  let base = shown;
  let flipAt = -1, front = 0, back = 0;
  if (flip) {
    if (wide) {
      base = flip.fwd ? [flip.from[0], flip.to[1]] : [flip.to[0], flip.from[1]];
      flipAt = flip.fwd ? 1 : 0;
      front = flip.fwd ? flip.from[1] : flip.from[0];
      back = flip.fwd ? flip.to[0] : flip.to[1];
    } else {
      base = flip.fwd ? flip.to : flip.from;
      flipAt = 0;
      front = flip.fwd ? flip.from[0] : flip.to[0];
    }
  }
  const slide = anim?.kind === "slide" ? anim : null;

  return (
    <div ref={box} className={"mz-reader" + (full ? " full" : "")} onContextMenu={block} onDragStart={block}>
      <div className="mz-bar">
        <button type="button" onClick={prev} disabled={left <= 1} aria-label="Өмнөх хуудас">‹</button>
        <label className="mz-jump">
          <input type="range" min={1} max={pages} value={page} onChange={(e) => go(Number(e.target.value))} aria-label="Хуудас сонгох" />
          <span>{shown.length > 1 ? `${shown[0]}–${shown[1]}` : shown[0]} / {pages}</span>
        </label>
        <button type="button" onClick={next} disabled={end >= pages} aria-label="Дараагийн хуудас">›</button>
        <span className="ss-grow" />
        <button type="button" className={"mz-tool" + (zoom.z > 1 ? " on" : "")} onClick={() => toggleZoom()} title={zoom.z > 1 ? "Жижигрүүлэх" : "Томруулах"} aria-label={zoom.z > 1 ? "Жижигрүүлэх" : "Томруулах"}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5 21 21M7.5 10.5h6" />{zoom.z === 1 && <path d="M10.5 7.5v6" />}
          </svg>
        </button>
        <button type="button" className="mz-tool" onClick={toggleFull} title={full ? "Жижигрүүлэх" : "Бүтэн дэлгэц"}>{full ? "⤡" : "⤢"}</button>
      </div>
      <div ref={stage} data-z={zoom.z === 1 ? "1" : "n"} className={"mz-stage" + (zoom.z > 1 ? " zoomed" : "") + (panning ? " panning" : "")}
        onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onDoubleClick={toggleZoom}
        onPointerDown={panDown} onPointerMove={panMove} onPointerUp={panUp} onPointerCancel={panUp}>
        {zoom.z === 1 && <button type="button" className="mz-side l" onClick={prev} disabled={left <= 1} aria-label="Өмнөх хуудас" />}
        <div className={"mz-zoom" + (base.length > 1 ? " two" : "")} style={{ transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.z})` }}>
          <div key={slide ? slide.key : "s"} className={"mz-pages" + (slide ? (slide.fwd ? " in-f" : " in-b") : "")}>
            {base.map((p, i) => (
              <div key={i} className={"mz-sheet" + (i === flipAt ? " flipping" : "")} style={{ aspectRatio: String(ratio), "--r": ratio }}>
                {content(p, base)}
                {i === flipAt && (
                  <span key={flip.key} className={"mz-flip " + (wide ? (flip.fwd ? "fw" : "bw") : flip.fwd ? "sf" : "sb")} aria-hidden="true">
                    <span className="mz-pf f">{content(front, [front])}</span>
                    {wide && <span className="mz-pf b">{content(back, [back])}</span>}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
        {zoom.z === 1 && <button type="button" className="mz-side r" onClick={next} disabled={end >= pages} aria-label="Дараагийн хуудас" />}
      </div>
    </div>
  );
}
