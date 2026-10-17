"use client";

import { useEffect, useRef, useState } from "react";

const MAX_BYTES = 1_400_000;

async function loadBitmap(src) {
  try {
    return await createImageBitmap(src, { imageOrientation: "from-image" });
  } catch (e) {
    return await new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error("Зураг уншиж чадсангүй"));
      img.src = src instanceof Blob ? URL.createObjectURL(src) : src;
    });
  }
}

// Зургийг харьцаагаар нь тайрч (pos: x,y хувь — тайрах байрлал), жижигрүүлж, шахна
async function render(bmp, aspect, maxW, pos = { x: 50, y: 50 }) {
  const iw = bmp.width, ih = bmp.height;
  let sx = 0, sy = 0, sw = iw, sh = ih;
  if (aspect) {
    if (iw / ih > aspect) { sw = Math.round(ih * aspect); sx = Math.round(((iw - sw) * pos.x) / 100); }
    else { sh = Math.round(iw / aspect); sy = Math.round(((ih - sh) * pos.y) / 100); }
  }
  const scale = Math.min(1, maxW / sw, (maxW * 1.5) / sh);
  const w = Math.max(1, Math.round(sw * scale)), h = Math.max(1, Math.round(sh * scale));
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const ctx = cv.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, w, h);
  const toBlob = (type, q) => new Promise((res) => cv.toBlob(res, type, q));
  let q = 0.85, type = "image/webp";
  let blob = await toBlob(type, q);
  if (!blob || blob.type !== "image/webp") {
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    type = "image/jpeg";
    blob = await toBlob(type, q);
  }
  while (blob && blob.size > MAX_BYTES && q > 0.4) { q -= 0.12; blob = await toBlob(type, q); }
  if (!blob || blob.size > MAX_BYTES) throw new Error("Зураг хэт том байна. Өөр зураг сонгоно уу.");
  return { blob, w, h, type };
}

async function upload({ blob, w, h, type }) {
  const fd = new FormData();
  fd.append("file", blob, type === "image/webp" ? "image.webp" : "image.jpg");
  fd.append("w", w); fd.append("h", h);
  const r = await fetch("/api/upload", { method: "POST", body: fd });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Зураг оруулж чадсангүй");
  return String(j.id);
}

const parsePos = (s) => {
  const m = /^(\d{1,3})% (\d{1,3})%$/.exec(s || "");
  return m ? { x: Math.min(100, +m[1]), y: Math.min(100, +m[2]) } : { x: 50, y: 50 };
};

// Зураг оруулах талбар.
// adjust=true: эх зургийг хадгалж, чирж байрлалыг нь тохируулна (профайлын зураг, ковер).
export default function ImageInput({
  name, aspect = null, maxW = 1600, initial = null, initialSrc = null, initialPos = null,
  variant = "slot", title = "Зураг нэмэх", hint = "", adjust = false, badge = null, children,
}) {
  const input = useRef(null);
  const box = useRef(null);
  const bmp = useRef(null);
  const drag = useRef(null);
  const [id, setId] = useState(initial ? String(initial) : "");
  const [srcId, setSrcId] = useState(initialSrc ? String(initialSrc) : "");
  const [preview, setPreview] = useState(null); // эх зургийн URL (чирэх үед)
  const [pos, setPos] = useState(parsePos(initialPos));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [moved, setMoved] = useState(false);

  // Хадгалсан эх зураг байвал чирэх боломжтой болгоно
  useEffect(() => {
    if (!adjust || !initialSrc) return;
    let off = false;
    (async () => {
      try {
        const res = await fetch(`/img/${initialSrc}`);
        const b = await loadBitmap(await res.blob());
        if (!off) { bmp.current = b; setPreview(`/img/${initialSrc}`); }
      } catch (e) {}
    })();
    return () => { off = true; };
  }, [adjust, initialSrc]);

  const pick = () => !busy && input.current?.click();
  const onFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!/^image\//.test(f.type)) { setErr("Зөвхөн зураг сонгоно уу"); return; }
    if (f.size > 25_000_000) { setErr("Зураг хэт том байна (25MB-аас бага)"); return; }
    setErr(""); setBusy(true);
    try {
      const b = await loadBitmap(f);
      const start = { x: 50, y: 50 };
      if (adjust) {
        // Эх зургийг (тайралгүй) хадгална — дараа нь дахин чирж болно
        const src = await upload(await render(b, null, Math.max(maxW, 1600)));
        bmp.current = b;
        setSrcId(src);
        setPreview(`/img/${src}`);
        setPos(start);
      }
      setId(await upload(await render(b, aspect, maxW, start)));
    } catch (e2) {
      setErr(e2.message || "Зураг оруулж чадсангүй");
    } finally {
      setBusy(false);
    }
  };

  // Чирэх: хулгана/хуруугаар зургийг хөдөлгөж тайрах байрлалыг сонгоно
  const canDrag = adjust && preview && bmp.current && !busy;
  const onDown = (e) => {
    if (!canDrag) return;
    e.preventDefault();
    const r = box.current.getBoundingClientRect();
    const b = bmp.current;
    const sc = Math.max(r.width / b.width, r.height / b.height);
    drag.current = { x0: e.clientX, y0: e.clientY, p0: pos, ox: b.width * sc - r.width, oy: b.height * sc - r.height, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));
    setPos({ x: d.ox > 1 ? clamp(d.p0.x - (dx / d.ox) * 100) : 50, y: d.oy > 1 ? clamp(d.p0.y - (dy / d.oy) * 100) : 50 });
  };
  const onUp = async () => {
    const d = drag.current;
    drag.current = null;
    if (!d || !d.moved) return;
    setMoved(true);
  };
  // Чирж дууссаны дараа (0.6 сек) тайралтыг шинэчилж хадгална
  useEffect(() => {
    if (!moved) return;
    const t = setTimeout(async () => {
      setMoved(false);
      if (!bmp.current) return;
      setBusy(true);
      try { setId(await upload(await render(bmp.current, aspect, maxW, pos))); }
      catch (e) { setErr(e.message || "Зураг хадгалж чадсангүй"); }
      finally { setBusy(false); }
    }, 600);
    return () => clearTimeout(t);
  }, [moved, pos, aspect, maxW]);

  const remove = () => { setId(""); setSrcId(""); setPreview(null); bmp.current = null; };
  const shown = preview || (id ? `/img/${id}` : null);
  const hasImg = !!(id || preview);
  return (
    <div className={`ii ii-${variant}` + (hasImg ? " has" : "") + (busy ? " busy" : "") + (canDrag ? " drag" : "")} style={aspect ? { "--ar": aspect } : undefined}>
      <input type="hidden" name={name} value={id} />
      {adjust && <input type="hidden" name={`${name}_src`} value={srcId} />}
      {adjust && <input type="hidden" name={`${name}_pos`} value={`${pos.x}% ${pos.y}%`} />}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" hidden onChange={onFile} />
      <div
        ref={box}
        className="ii-box"
        role="button"
        tabIndex={0}
        aria-label={hasImg ? "Зураг" : title}
        onClick={() => !hasImg && pick()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !hasImg && (e.preventDefault(), pick())}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        {shown ? (
          <img className="ii-img" src={shown} alt="" draggable={false} style={preview ? { objectPosition: `${pos.x}% ${pos.y}%` } : undefined} />
        ) : children ? (
          children
        ) : (
          <>
            <img className="ic" src="/icons/sh_img.svg" width={22} height={22} alt="" />
            <b>{busy ? "Оруулж байна…" : title}</b>
            {hint && <small>{hint}</small>}
          </>
        )}
        {canDrag && <span className="ii-hint">✥ Чирж байрлалыг тохируулна</span>}
        {busy && <span className="ii-spin" aria-hidden="true" />}
        {hasImg && !busy && (
          <span className="ii-acts" onPointerDown={(e) => e.stopPropagation()}>
            <button type="button" onClick={pick}>Солих</button>
            <button type="button" onClick={remove}>Хасах</button>
          </span>
        )}
      </div>
      {badge && <button type="button" className="ii-badge" onClick={pick} aria-label="Зураг сонгох">{badge}</button>}
      {err && <small className="ii-err">{err}</small>}
    </div>
  );
}
