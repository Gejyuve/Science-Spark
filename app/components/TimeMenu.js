"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

// Нүүрний цагийн шүүлтүүр: дарахад хугацааны сонголтууд гарна
export default function TimeMenu({ label, options }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    if (!open) return;
    const off = (e) => box.current && !box.current.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", off);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", off); document.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div className="ss-time" ref={box}>
      <button type="button" className={"ss-time-btn" + (open ? " open" : "")} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <img className="ic" src="/icons/f_clock.svg" width={15} height={15} alt="" />
        {label}
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && (
        <div className="ss-time-menu" role="menu">
          {options.map((o) => (
            <Link key={o.name} href={o.href} role="menuitem" className={o.on ? "on" : ""} onClick={() => setOpen(false)}>
              {o.name}{o.on && <span aria-hidden="true">✓</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
