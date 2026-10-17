"use client";

import { useRef, useState } from "react";

const MAX_BYTES = 1_400_000;

// Зургийг хөтөч дээрээ тайрч (харьцаагаар), жижигрүүлж, шахна
async function prepare(file, aspect, maxW) {
  let bmp;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch (e) {
    bmp = await new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error("Зураг уншиж чадсангүй"));
      img.src = URL.createObjectURL(file);
    });
  }
  const iw = bmp.width, ih = bmp.height;
  let sx = 0, sy = 0, sw = iw, sh = ih;
  if (aspect) {
    if (iw / ih > aspect) { sw = Math.round(ih * aspect); sx = Math.round((iw - sw) / 2); }
    else { sh = Math.round(iw / aspect); sy = Math.round((ih - sh) / 2); }
  }
  const scale = Math.min(1, maxW / sw, (maxW * 1.5) / sh);
  const w = Math.max(1, Math.round(sw * scale)), h = Math.max(1, Math.round(sh * scale));
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const ctx = cv.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, w, h);
  const toBlob = (type, q) => new Promise((res) => cv.toBlob(res, type, q));
  let q = 0.85;
  let blob = await toBlob("image/webp", q);
  let type = "image/webp";
  if (!blob || blob.type !== "image/webp") {
    // WebP дэмжихгүй хөтөч: цагаан дэвсгэртэй JPEG
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    type = "image/jpeg";
    blob = await toBlob(type, q);
  }
  while (blob && blob.size > MAX_BYTES && q > 0.4) {
    q -= 0.12;
    blob = await toBlob(type, q);
  }
  if (!blob || blob.size > MAX_BYTES) throw new Error("Зураг хэт том байна. Өөр зураг сонгоно уу.");
  return { blob, w, h, type };
}

// Зураг оруулах талбар. Сонгосон зургийн дугаарыг нуугдмал талбарт (name) хадгална.
export default function ImageInput({ name, aspect = null, maxW = 1600, initial = null, variant = "slot", title = "Зураг нэмэх", hint = "", children }) {
  const input = useRef(null);
  const [id, setId] = useState(initial || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const pick = () => !busy && input.current?.click();
  const onFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!/^image\//.test(f.type)) { setErr("Зөвхөн зураг сонгоно уу"); return; }
    if (f.size > 25_000_000) { setErr("Зураг хэт том байна (25MB-аас бага)"); return; }
    setErr(""); setBusy(true);
    try {
      const { blob, w, h, type } = await prepare(f, aspect, maxW);
      const fd = new FormData();
      fd.append("file", blob, type === "image/webp" ? "image.webp" : "image.jpg");
      fd.append("w", w); fd.append("h", h);
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Зураг оруулж чадсангүй");
      setId(String(j.id));
    } catch (e2) {
      setErr(e2.message || "Зураг оруулж чадсангүй");
    } finally {
      setBusy(false);
    }
  };
  const src = id ? `/img/${id}` : null;
  return (
    <div className={`ii ii-${variant}` + (src ? " has" : "") + (busy ? " busy" : "")} style={aspect ? { "--ar": aspect } : undefined}>
      <input type="hidden" name={name} value={id} />
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" hidden onChange={onFile} />
      <button type="button" className="ii-box" onClick={pick} aria-label={src ? "Зураг солих" : title}>
        {src ? (
          <img className="ii-img" src={src} alt="" />
        ) : children ? (
          children
        ) : (
          <>
            <img className="ic" src="/icons/sh_img.svg" width={22} height={22} alt="" />
            <b>{busy ? "Оруулж байна…" : title}</b>
            {hint && <small>{hint}</small>}
          </>
        )}
        {busy && <span className="ii-spin" aria-hidden="true" />}
      </button>
      {src && !busy && (
        <span className="ii-acts">
          <button type="button" onClick={pick}>Солих</button>
          <button type="button" onClick={() => setId("")}>Хасах</button>
        </span>
      )}
      {err && <small className="ii-err">{err}</small>}
    </div>
  );
}
