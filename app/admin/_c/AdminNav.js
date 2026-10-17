"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminNav({ items }) {
  const path = usePathname();
  return (
    <nav className="adm-nav">
      {items.map((s) => {
        const on = s.exact || s.href === "/admin" ? path === s.href || (s.exact && /^\/review\/(\d+|exam)/.test(path)) : path.startsWith(s.href);
        return (
          <Link key={s.key} href={s.href} className={"adm-item" + (on ? " on" : "") + (s.soon ? " soon" : "")}>
            <i className="adm-ic" style={{ WebkitMaskImage: `url(/icons/${s.icon}.svg)`, maskImage: `url(/icons/${s.icon}.svg)` }} />
            <span>{s.label}</span>
            {s.badge ? <em>{s.badge}</em> : s.soon ? <small>удахгүй</small> : null}
          </Link>
        );
      })}
    </nav>
  );
}
