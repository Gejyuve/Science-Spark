"use client";

import { useEffect, useRef, useState } from "react";

// Баруун талын "Мэдэгдэл" мөр: хулгана тавих эсвэл дарахад жагсаалт гарна
export default function NotifMenu({ trigger, children }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const t = useRef(null);
  const pinned = useRef(false);
  useEffect(() => {
    if (!open) { pinned.current = false; return; }
    const close = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div
      className="nf-menu"
      ref={box}
      onPointerEnter={(e) => { if (e.pointerType === "mouse") { clearTimeout(t.current); t.current = setTimeout(() => setOpen(true), 150); } }}
      onPointerLeave={(e) => { if (e.pointerType === "mouse" && !pinned.current) { clearTimeout(t.current); t.current = setTimeout(() => setOpen(false), 300); } }}
    >
      <button type="button" className="ss-action nf-trigger" aria-expanded={open} onClick={() => { if (open && !pinned.current) { pinned.current = true; return; } pinned.current = !open; setOpen(!open); }}>
        {trigger}
      </button>
      {open && <div className="nf-pop" role="dialog" aria-label="Мэдэгдэл">{children}</div>}
    </div>
  );
}
