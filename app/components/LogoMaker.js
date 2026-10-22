"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import Spark from "./Spark";
import { SYMBOLS, PALETTES, STYLES, LAYOUTS, TEXT_MAX, initials, logoSvg, textBox } from "@/lib/logo-maker";

const svgUrl = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

// Сайтын фонт (Inter) — canvas дээр үсгийг үүгээр зурна
const siteFont = () => (typeof window === "undefined" ? "sans-serif" : getComputedStyle(document.body).fontFamily || "sans-serif");

// Логог 512×512 зураг болгож сайтад оруулна. Зургийн id буцаана.
async function renderAndUpload(o) {
  const font = siteFont();
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error("Лого зурж чадсангүй")); img.src = svgUrl(logoSvg(o, { withText: false })); });
  const cv = document.createElement("canvas");
  cv.width = 512; cv.height = 512;
  const ctx = cv.getContext("2d");
  ctx.drawImage(img, 0, 0, 512, 512);
  if (o.layout !== "icon" && o.text) {
    const t = textBox(o);
    const spec = `800 ${t.size}px ${font}`;
    try { await document.fonts.load(spec, o.text); } catch (e) {}
    ctx.font = spec;
    if ("letterSpacing" in ctx) ctx.letterSpacing = "2px";
    ctx.fillStyle = PALETTES[o.palette][2];
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(o.text, 256, t.y, 440);
  }
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

function Preview({ o, size, font }) {
  const uid = "lm" + useId().replace(/[^a-zA-Z0-9]/g, "");
  return <span className="lm-prev" style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: logoSvg(o, { font, uid }) }} />;
}

// Клубийн лого бүтээгч: дүрс, өнгө, загвар, үсэг сонгоод лого зураг болгоно
export default function LogoMaker({ name = "", onDone, label = "Лого бүтээх" }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [font, setFont] = useState("sans-serif");
  const [o, setO] = useState({ symbol: "atom", palette: 0, style: "grad", layout: "both", text: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { setMounted(true); setFont(siteFont()); }, []);
  useEffect(() => {
    if (!open) return;
    const esc = (e) => e.key === "Escape" && !busy && setOpen(false);
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [open, busy]);

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
            <Preview o={o} size={180} font={font} />
            <div className="lm-minis" aria-hidden="true">
              <Preview o={o} size={56} font={font} />
              <Preview o={o} size={36} font={font} />
              <Preview o={o} size={24} font={font} />
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
                <div className="lm-label">Үсэг <small>{TEXT_MAX} хүртэл тэмдэгт</small></div>
                <div className="pf-input lm-text">
                  <input value={o.text} maxLength={TEXT_MAX} placeholder="Жишээ: СС"
                    onChange={(e) => set("text", [...e.target.value.toLocaleUpperCase("mn")].slice(0, TEXT_MAX).join(""))} />
                </div>
              </>
            )}
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
