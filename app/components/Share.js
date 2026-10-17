"use client";

import { useEffect, useRef, useState } from "react";

// Хуваалцах: хулгана тавихад (эсвэл дарахад) сошиал сүлжээ, холбоос хуулах цонх гарна
export default function Share({ path, title, size = 20, icon = "share20" }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState(path);
  const box = useRef(null);
  const timer = useRef(null);
  useEffect(() => setUrl(new URL(path, window.location.origin).toString()), [path]);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  const enter = (e) => { if (e.pointerType === "mouse") { clearTimeout(timer.current); setOpen(true); } };
  const leave = (e) => { if (e.pointerType === "mouse") timer.current = setTimeout(() => setOpen(false), 250); };
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title || "Science Spark");
  const links = [
    ["sh_fb", "Facebook", `https://www.facebook.com/sharer/sharer.php?u=${u}`],
    ["sh_x", "X", `https://twitter.com/intent/tweet?url=${u}&text=${t}`],
    ["sh_li", "LinkedIn", `https://www.linkedin.com/sharing/share-offsite/?url=${u}`],
    ["tg", "Telegram", `https://t.me/share/url?url=${u}&text=${t}`],
    ["sh_mail", "И-мэйл", `mailto:?subject=${t}&body=${u}`],
  ];
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = url; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (_) {}
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <span className="sh-wrap" ref={box} onPointerEnter={enter} onPointerLeave={leave}>
      <button type="button" className="ar-iconbtn" aria-label="Хуваалцах" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <img className="ic" src={`/icons/${icon}.svg`} width={size} height={size} alt="" />
      </button>
      {open && (
        <span className="sh-pop" role="menu">
          <b>Хуваалцах</b>
          <span className="sh-row">
            {links.map(([ic, label, href]) => (
              <a key={label} href={href} target={ic === "sh_mail" ? undefined : "_blank"} rel="noopener noreferrer" className="sh-item" title={label}>
                <img className="ic" src={`/icons/${ic}.svg`} width={18} height={18} alt="" />
                <small>{label}</small>
              </a>
            ))}
          </span>
          <span className="sh-link">
            <input readOnly value={url} aria-label="Холбоос" onFocus={(e) => e.target.select()} />
            <button type="button" onClick={copy}>{copied ? "Хуулсан ✓" : "Хуулах"}</button>
          </span>
          {typeof navigator !== "undefined" && navigator.share && (
            <button type="button" className="sh-native" onClick={() => navigator.share({ title, url }).catch(() => {})}>Бусад апп-аар…</button>
          )}
        </span>
      )}
    </span>
  );
}
