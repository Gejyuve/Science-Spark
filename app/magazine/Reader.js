"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Сэтгүүл уншигч: хуудсыг нэг нэгээр (том дэлгэцэнд хос хуудсаар) харуулна.
// Хуудас бүр зураг тул файл татах зүйл алга; баруун товч, чирэх, сонгохыг хааж, уншигчийн нэрийг усан тэмдэг болгон тавина.
// Эрхгүй хуудсанд хүрэхэд `locked` (худалдаж авах хэсэг) гарна.
export default function Reader({ issueId, pages, free, access, start = 1, ratio = 0.707, mark = "", locked = null, saveProgress = false }) {
  const last = access ? pages : Math.min(free, pages);
  const [page, setPage] = useState(Math.min(Math.max(1, start), pages));
  const [spread, setSpread] = useState(false);
  const [wide, setWide] = useState(false);
  const [full, setFull] = useState(false);
  const box = useRef(null);
  const touch = useRef(null);

  // Том дэлгэцэнд хос хуудсаар (1-р хуудас нүүр тул ганцаараа, дараа нь 2–3, 4–5 …)
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1100px)");
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const two = spread && wide;
  const left = two && page > 1 ? (page % 2 === 0 ? page : page - 1) : page;
  const shown = two && left > 1 ? [left, left + 1].filter((p) => p <= pages) : [left];
  const step = two && left > 1 ? 2 : 1;

  const go = useCallback((to) => setPage(Math.min(Math.max(1, to), pages)), [pages]);
  const next = useCallback(() => go(two ? (left === 1 ? 2 : left + 2) : page + 1), [go, two, left, page]);
  const prev = useCallback(() => go(two ? (left <= 2 ? 1 : left - 2) : page - 1), [go, two, left, page]);

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

  // Дараагийн хуудсуудыг урьдчилж ачаална
  useEffect(() => {
    for (let p = left + step; p <= Math.min(last, left + step + 1); p++) {
      const img = new Image();
      img.src = `/api/magazine/page?i=${issueId}&p=${p}`;
    }
  }, [issueId, left, step, last]);

  // Худалдаж авсан бол хаана хүртэл уншсаныг хадгална (хуудас эргүүлэхээ зогсоосны дараа)
  // Хуудаснаас гарахад хадгалаагүй үлдсэнийг тэр даруй илгээнэ
  const unsaved = useRef(null);
  const flush = useCallback(() => {
    if (unsaved.current == null) return;
    fetch("/api/magazine/page", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ i: issueId, p: unsaved.current }), keepalive: true }).catch(() => {});
    unsaved.current = null;
  }, [issueId]);
  const seen = shown[shown.length - 1];
  useEffect(() => {
    if (!saveProgress) return;
    unsaved.current = seen;
    const t = setTimeout(flush, 1200);
    return () => clearTimeout(t);
  }, [saveProgress, seen, flush]);
  useEffect(() => {
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [flush]);

  const block = (e) => e.preventDefault();
  const onTouchStart = (e) => { touch.current = e.touches[0]?.clientX ?? null; };
  const onTouchEnd = (e) => {
    const x0 = touch.current;
    const x1 = e.changedTouches[0]?.clientX;
    touch.current = null;
    if (x0 == null || x1 == null || Math.abs(x1 - x0) < 50) return;
    if (x1 < x0) next();
    else prev();
  };

  return (
    <div ref={box} className={"mz-reader" + (full ? " full" : "")} onContextMenu={block} onDragStart={block}>
      <div className="mz-bar">
        <button type="button" onClick={prev} disabled={left <= 1} aria-label="Өмнөх хуудас">‹</button>
        <label className="mz-jump">
          <input type="range" min={1} max={pages} value={page} onChange={(e) => go(Number(e.target.value))} aria-label="Хуудас сонгох" />
          <span>{shown.length > 1 ? `${shown[0]}–${shown[1]}` : shown[0]} / {pages}</span>
        </label>
        <button type="button" onClick={next} disabled={shown[shown.length - 1] >= pages} aria-label="Дараагийн хуудас">›</button>
        <span className="ss-grow" />
        {wide && <button type="button" className={"mz-tool" + (spread ? " on" : "")} onClick={() => setSpread((s) => !s)} title="Хос хуудсаар харах">{spread ? "▯" : "▯▯"}</button>}
        <button type="button" className="mz-tool" onClick={toggleFull} title={full ? "Жижигрүүлэх" : "Бүтэн дэлгэц"}>{full ? "⤡" : "⤢"}</button>
      </div>
      <div className={"mz-stage" + (shown.length > 1 ? " two" : "")} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <button type="button" className="mz-side l" onClick={prev} disabled={left <= 1} aria-label="Өмнөх хуудас" />
        {shown.map((p) => (
          <div key={p} className="mz-sheet" style={{ aspectRatio: String(ratio), "--r": ratio }}>
            {p <= last ? (
              <>
                <img src={`/api/magazine/page?i=${issueId}&p=${p}`} alt={`${p}-р хуудас`} draggable={false} />
                {mark && <span className="mz-mark" aria-hidden="true">{Array.from({ length: 6 }, (_, k) => <i key={k}>{mark}</i>)}</span>}
              </>
            ) : (
              <div className="mz-lock">{locked}</div>
            )}
          </div>
        ))}
        <button type="button" className="mz-side r" onClick={next} disabled={shown[shown.length - 1] >= pages} aria-label="Дараагийн хуудас" />
      </div>
    </div>
  );
}
