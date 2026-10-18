"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const set = (v) => { if (v) document.documentElement.dataset.drawer = v; else delete document.documentElement.dataset.drawer; };

// Гар утсанд: зүүн цэс (☰) болон баруун самбар (профайл зураг) гулсаж нээгдэнэ
export function DrawerBtn({ side, className = "", label, children }) {
  return (
    <button type="button" className={className} aria-label={label} title={label}
      onClick={() => set(document.documentElement.dataset.drawer === side ? null : side)}>
      {children}
    </button>
  );
}

export function DrawerClose({ className = "ss-dclose" }) {
  return <button type="button" className={className} aria-label="Хаах" onClick={() => set(null)}>×</button>;
}

// Хуудас солигдох, Esc дарах, бүдэг дэвсгэр дээр дарахад хаана
export function DrawerHost() {
  const path = usePathname();
  useEffect(() => { set(null); }, [path]);
  useEffect(() => {
    const k = (e) => e.key === "Escape" && set(null);
    document.addEventListener("keydown", k);
    return () => { document.removeEventListener("keydown", k); set(null); };
  }, []);
  return <div className="ss-scrim" onClick={() => set(null)} aria-hidden="true" />;
}
