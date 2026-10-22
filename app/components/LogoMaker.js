"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Spark from "./Spark";
import { SYMBOLS, PALETTES, STYLES, LAYOUTS, TEXT_MAX, RING_MAX, RING_BOTTOM_MAX, initials, drawLogo } from "@/lib/logo-maker";

// Сайтын фонт (Inter) — canvas дээр текстийг үүгээр зурна
const siteFont = () => (typeof window === "undefined" ? "sans-serif" : getComputedStyle(document.body).fontFamily || "sans-serif");

async function fontsReady(o, font) {
  const sample = `${o.text || ""}${o.ring || ""}${o.ringBottom || ""}` || "А";
  try { await document.fonts.load(`800 40px ${font}`, sample); } catch (e) {}
}

// Логог 512×512 зураг болгож сайтад оруулна. Зургийн id буцаана.
async function renderAndUpload(o) {
  const font = siteFont();
  await fontsReady(o, font);
  const cv = await drawLogo(o, font);
  // WEBP жижиг; дэмждэггүй хөтөч PNG болгоно
  let blob = await new Promise((res) => cv.toBlob(res, "image/webp", 0.92));
  if (!blob || blob.type !== "image/webp") blob = await new Promise((res) => cv.toBlob(res, "image/png"));
  if (!blob) throw new Error("Лого зурж чадсангүй");
  const fd = new FormData();
  fd.append("file", blob, blob.type === "image/webp" ? "logo.webp" : "logo.png");
  fd.append("w", 512); fd.append("h", 512);
  const r = await fetch("/api/upload", { method: "POST", body: fd });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Лого хадгалж чадсангүй");
  return String(j.id);
}

// Урьдчилан харах: хадгалах зурагтай яг ижил canvas зураг
function usePreview(o, on) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    if (!on) return;
    let off = false;
    (async () => {
      const font = siteFont();
      await fontsReady(o, font);
      try { const cv = await drawLogo(o, font); if (!off) setSrc(cv.toDataURL("image/png")); } catch (e) {}
    })();
    return () => { off = true; };
  }, [o, on]);
  return src;
}

const Preview = ({ src, size }) => (
  <span className="lm-prev" style={{ width: size, height: size }}>{src && <img src={src} alt="" width={size} height={size} />}</span>
);

// Клубийн лого бүтээгч: дүрс, өнгө, загвар, үсэг сонгоод лого зураг болгоно
export default function LogoMaker({ name = "", onDone, label = "Лого бүтээх" }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [o, setO] = useState({ symbol: "atom", palette: 0, style: "grad", layout: "both", text: "", ring: "", ringBottom: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const esc = (e) => e.key === "Escape" && !busy && setOpen(false);
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [open, busy]);

  const src = usePreview(o, open);
  const start = () => { setO((x) => ({ ...x, text: x.text || initials(name) })); setErr(""); setOpen(true); };
  const set = (k, v) => setO((x) => ({ ...x, [k]: v }));
  const use = async () => {
    setBusy(true); setErr("");
    try { onDone(await renderAndUpload(o)); setOpen(false); }
    catch (e) { setErr(e.message || "Лого хадгалж чадсангүй"); }
    finally { setBusy(false); }
  };
  const fg = (i) => PALETTES[i][2];

  const modal = open && (
    <div className="tm-overlay" onMouseDown={(e) => e.target === e.currentTarget && !busy && setOpen(false)}>
      <div className="tm-modal lm-modal" role="dialog" aria-modal="true" aria-labelledby="lm-h">
        <div className="tm-head">
          <div>
            <b id="lm-h">Лого бүтээх</b>
            <small>Дүрс, өнгө, загвараа сонгоод «Ашиглах» дарна. Лого сайт даяар дугуй хэлбэрээр харагдана.</small>
          </div>
          <button type="button" className="tm-x" onClick={() => !busy && setOpen(false)} aria-label="Хаах">×</button>
        </div>
        <div className="lm-body">
          <div className="lm-stage">
            <Preview src={src} size={180} />
            <div className="lm-minis" aria-hidden="true">
              <Preview src={src} size={56} />
              <Preview src={src} size={36} />
              <Preview src={src} size={24} />
            </div>
          </div>
          <div className="lm-opts">
            <div className="lm-label">Дүрс</div>
            <div className="lm-syms" role="radiogroup" aria-label="Дүрс">
              {SYMBOLS.map((s) => (
                <button key={s.key} type="button" role="radio" aria-checked={o.symbol === s.key} title={s.label}
                  className={"lm-sym" + (o.symbol === s.key ? " on" : "")} onClick={() => set("symbol", s.key)}>
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: s.svg }} />
                </button>
              ))}
            </div>

            <div className="lm-label">Өнгө</div>
            <div className="lm-pals" role="radiogroup" aria-label="Өнгө">
              {PALETTES.map((p, i) => (
                <button key={i} type="button" role="radio" aria-checked={o.palette === i} aria-label={`Өнгө ${i + 1}`}
                  className={"lm-pal" + (o.palette === i ? " on" : "")} style={{ background: `linear-gradient(135deg, ${p[0]}, ${p[1]})`, color: fg(i) }}
                  onClick={() => set("palette", i)}>●</button>
              ))}
            </div>

            <div className="lm-label">Загвар</div>
            <div className="lm-chips">
              {STYLES.map((s) => <button key={s.key} type="button" className={"lm-chip" + (o.style === s.key ? " on" : "")} onClick={() => set("style", s.key)}>{s.label}</button>)}
            </div>

            <div className="lm-label">Бүтэц</div>
            <div className="lm-chips">
              {LAYOUTS.map((s) => <button key={s.key} type="button" className={"lm-chip" + (o.layout === s.key ? " on" : "")} onClick={() => set("layout", s.key)}>{s.label}</button>)}
            </div>

            {o.layout !== "icon" && (
              <>
                <div className="lm-label">Голын текст <small>{TEXT_MAX} хүртэл тэмдэгт</small></div>
                <div className="pf-input lm-text">
                  <input value={o.text} maxLength={TEXT_MAX} placeholder="Жишээ: СС эсвэл Сансар"
                    onChange={(e) => set("text", [...e.target.value].slice(0, TEXT_MAX).join(""))} />
                  <span>{[...o.text].length} / {TEXT_MAX}</span>
                </div>
              </>
            )}

            <div className="lm-label">Тойрог текст <small>заавал биш</small></div>
            <div className="lm-ring">
              <div className="pf-input"><input value={o.ring} maxLength={RING_MAX} placeholder="Дээд нум: Сансрын судлаачид" onChange={(e) => set("ring", e.target.value)} /><span>{o.ring.length} / {RING_MAX}</span></div>
              <div className="pf-input"><input value={o.ringBottom} maxLength={RING_BOTTOM_MAX} placeholder="Доод нум: 2026 эсвэл хот" onChange={(e) => set("ringBottom", e.target.value)} /><span>{o.ringBottom.length} / {RING_BOTTOM_MAX}</span></div>
              {!o.ring && <button type="button" className="lm-chip" onClick={() => set("ring", name.slice(0, RING_MAX))} disabled={!name.trim()}>Нэрийг тавих</button>}
            </div>
          </div>
        </div>
        {err && <p className="tm-err">{err}</p>}
        <div className="tm-foot">
          <small>Дараа нь «Солих» дарж өөр зураг оруулж ч болно.</small>
          <span className="ss-grow" />
          <button type="button" className="tm-btn ghost" onClick={() => setOpen(false)} disabled={busy}>Болих</button>
          <button type="button" className="tm-btn" onClick={use} disabled={busy || (o.layout === "text" && !o.text.trim())}>
            {busy ? <span className="spk-btn"><Spark mono size={16} />Хадгалж байна…</span> : "Ашиглах"}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button type="button" className="lm-open" onClick={start}>
        <img src="/icons/sparkle.svg" width={14} height={14} alt="" />{label}
      </button>
      {mounted && modal && createPortal(modal, document.body)}
    </>
  );
}
