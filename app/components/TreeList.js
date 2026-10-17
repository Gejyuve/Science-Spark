"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

const fmt = (n) => Number(n || 0).toLocaleString("en-US");

function Row({ n, depth, open, toggle }) {
  const isOpen = open.has(n.path);
  const has = n.kids.length > 0;
  return (
    <li>
      <div className={"tr-row" + (isOpen ? " open" : "")} style={{ paddingLeft: depth * 22 }}>
        <button type="button" className="tr-tog" onClick={() => has && toggle(n.path)} aria-expanded={has ? isOpen : undefined} disabled={!has} title={has ? (isOpen ? "Хураах" : "Дэд ангилал нээх") : ""}>
          <svg className="tr-folder" width="22" height="18" viewBox="0 0 22 18" aria-hidden="true">
            {isOpen
              ? <path d="M2 4a2 2 0 0 1 2-2h4.2l2 2H18a2 2 0 0 1 2 2v1H6.6a2 2 0 0 0-1.9 1.4L2.6 16H2Zm2.6 6.4A2 2 0 0 1 6.5 9H21l-2.2 7.2A2 2 0 0 1 16.9 17H3.3Z" fill="currentColor" />
              : <path d="M2 4a2 2 0 0 1 2-2h4.2l2 2H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2Z" fill="currentColor" />}
          </svg>
          <span className="tr-name">{n.name}</span>
          <span className="tr-n">({fmt(n.n)})</span>
          {has && <svg className="tr-chev" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M4 2.5 7.5 6 4 9.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        </button>
        <Link href={`/tree/${n.path}`} className="tr-go" title={`${n.name} · бүх нийтлэл`}>Нээх →</Link>
      </div>
      {has && isOpen && (
        <ul>{n.kids.map((k) => <Row key={k.path} n={k} depth={depth + 1} open={open} toggle={toggle} />)}</ul>
      )}
    </li>
  );
}

// Figma 86:17 · «Ангилал»: салбар бүрийг дарж дэд ангиллыг нээнэ, хайлттай
export default function TreeList({ tree }) {
  const [open, setOpen] = useState(() => new Set());
  const [q, setQ] = useState("");
  const toggle = (p) => setOpen((s) => { const n = new Set(s); n.has(p) ? n.delete(p) : n.add(p); return n; });
  const flat = useMemo(() => {
    const out = [];
    (function go(n, trail) { if (n.path) out.push({ ...n, trail }); n.kids.forEach((k) => go(k, n.path ? [...trail, n.name] : trail)); })(tree, []);
    return out;
  }, [tree]);
  const term = q.trim().toLowerCase();
  const hits = term ? flat.filter((n) => n.name.toLowerCase().includes(term)) : [];
  return (
    <section className="tr-card">
      <div className="tr-head">
        <div>
          <b>Ангилал</b>
          <small>Салбар бүрийг дарж дэд ангиллуудыг нээнэ үү</small>
        </div>
        <label className="tr-search">
          <img className="ic" src="/icons/search.svg" width={16} height={16} alt="" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Салбар хайх…" aria-label="Салбар хайх" />
        </label>
      </div>
      {term ? (
        hits.length ? (
          <ul className="tr-hits">
            {hits.map((n) => (
              <li key={n.path}>
                <Link href={`/tree/${n.path}`}>
                  <span className="tr-name">{n.name}</span> <span className="tr-n">({fmt(n.n)})</span>
                  {n.trail.length > 0 && <small>{n.trail.join(" › ")}</small>}
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="tr-empty">«{q}» нэртэй салбар олдсонгүй.</p>
      ) : (
        <ul className="tr-list">{tree.kids.map((k) => <Row key={k.path} n={k} depth={0} open={open} toggle={toggle} />)}</ul>
      )}
    </section>
  );
}
