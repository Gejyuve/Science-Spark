"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const COL = 260; // түвшин хоорондын зай
const ROW = 44; // навч хоорондын зай
const PAD = 70;
const fmt = (n) => Number(n || 0).toLocaleString("en-US");

// Нээгдсэн салбаруудаар модны байрлалыг тооцоолно (зүүнээс баруун тийш)
function layout(tree, open) {
  const nodes = [];
  const links = [];
  let leaf = 0;
  (function place(n, depth, parent) {
    const node = { path: n.path, name: n.name, n: n.n, depth, has: n.kids.length > 0, open: open.has(n.path), x: depth * COL };
    nodes.push(node);
    if (parent) links.push({ from: parent, to: node });
    if (node.has && node.open) {
      const kids = n.kids.map((k) => place(k, depth + 1, node));
      node.y = (kids[0].y + kids[kids.length - 1].y) / 2;
    } else {
      node.y = leaf * ROW;
      leaf++;
    }
    return node;
  })(tree, 0, null);
  const w = Math.max(...nodes.map((n) => n.x)) + 220;
  const h = Math.max(ROW, (leaf - 1) * ROW);
  return { nodes, links, w, h };
}

// Figma 86:17 · Шинжлэх ухааны мод: салаа дээр дарж задлах, нэр дээр дарж салбарын хуудас нээх
export default function TreeGraph({ tree, initialOpen = ["", "nat", "nat/phys"], focus = null }) {
  const router = useRouter();
  const box = useRef(null);
  const drag = useRef(null);
  const [open, setOpen] = useState(() => new Set(initialOpen));
  const [sel, setSel] = useState(focus);
  const [view, setView] = useState({ x: 40, y: 40, k: 1 });
  const [full, setFull] = useState(false);
  // Бүтэн дэлгэц: Esc дарж гарна, хуудас гүйхгүй
  useEffect(() => {
    if (!full) return;
    const esc = (e) => e.key === "Escape" && setFull(false);
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [full]);
  const { nodes, links, w, h } = useMemo(() => layout(tree, open), [tree, open]);

  const fit = useCallback(() => {
    const el = box.current;
    if (!el) return;
    const cw = el.clientWidth, ch = el.clientHeight;
    // Хэт жижигрэхгүй: бичиг уншигдахуйц (0.75-аас доош биш), илүү хэсгийг чирж үзнэ
    const k = Math.min(1.1, Math.max(0.75, Math.min((cw - PAD) / (w + 40), (ch - PAD) / (h + 60))));
    const x = (w + 40) * k < cw ? (cw - (w - 140) * k) / 2 - 20 * k : 70;
    setView({ k, x, y: (ch - h * k) / 2 });
  }, [w, h]);
  // Нарийн дэлгэцэнд эхэндээ цөөн салаа нээнэ
  useEffect(() => {
    if (box.current && box.current.clientWidth < 760 && !focus) setOpen(new Set(["", "nat"]));
  }, [focus]);
  useEffect(() => { fit(); }, [fit, full]);
  useEffect(() => {
    const on = () => fit();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [fit]);

  const zoom = (f, cx, cy) => setView((v) => {
    const el = box.current;
    const px = cx ?? el.clientWidth / 2, py = cy ?? el.clientHeight / 2;
    const k = Math.min(2.5, Math.max(0.3, v.k * f));
    return { k, x: px - ((px - v.x) * k) / v.k, y: py - ((py - v.y) * k) / v.k };
  });
  const toggle = (n) => {
    setSel(n.path);
    if (!n.has) return;
    setOpen((s) => { const x = new Set(s); x.has(n.path) ? x.delete(n.path) : x.add(n.path); return x; });
  };

  const onDown = (e) => {
    if (e.button !== 0 || e.target.closest("[data-node]")) return;
    drag.current = { x: e.clientX, y: e.clientY, v: view };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    const d = drag.current;
    if (!d) return;
    setView({ ...d.v, x: d.v.x + e.clientX - d.x, y: d.v.y + e.clientY - d.y });
  };
  const onUp = () => { drag.current = null; };
  // Ctrl/⌘ + гүйлгээгээр томруулна (энгийн гүйлгээг саатуулахгүй)
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoom(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <section className={"tg-card" + (full ? " full" : "")}>
      <div ref={box} className={"tg-stage" + (drag.current ? " dragging" : "")} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <svg className="tg-svg" width="100%" height="100%" role="img" aria-label="Шинжлэх ухааны мод">
          <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
            {links.map(({ from, to }) => {
              const mx = (from.x + to.x) / 2;
              return <path key={to.path} className="tg-link" d={`M${from.x},${from.y} C${mx},${from.y} ${mx},${to.y} ${to.x},${to.y}`} />;
            })}
            {nodes.map((n) => {
              const hollow = n.open || !n.path;
              const on = sel === n.path;
              return (
                <g key={n.path || "root"} className={"tg-node" + (on ? " on" : "")} style={{ transform: `translate(${n.x}px, ${n.y}px)` }} data-node>
                  <text className="tg-label" y={-15} textAnchor="middle" onClick={() => router.push(n.path ? `/tree/${n.path}` : "/tree")}>
                    {n.name} ({fmt(n.n)})
                  </text>
                  <circle r={9} className={hollow ? "hollow" : n.has ? "full" : "leaf"} onClick={() => toggle(n)}>
                    <title>{n.has ? (n.open ? "Хураах" : "Дэлгэх") : n.name}</title>
                  </circle>
                  {n.has && !n.open && <text className="tg-plus" y={3.5} textAnchor="middle" onClick={() => toggle(n)}>+</text>}
                </g>
              );
            })}
          </g>
        </svg>
        <div className="tg-zoom">
          <button type="button" onClick={() => zoom(1.2)} aria-label="Томруулах">+</button>
          <button type="button" onClick={() => zoom(1 / 1.2)} aria-label="Жижигрүүлэх">−</button>
          <button type="button" onClick={() => setFull((f) => !f)} aria-label={full ? "Бүтэн дэлгэцээс гарах" : "Бүтэн дэлгэцээр харах"} title={full ? "Бүтэн дэлгэцээс гарах (Esc)" : "Бүтэн дэлгэцээр харах"}>
            {full
              ? <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M5 1v4H1M13 5H9V1M9 13V9h4M1 9h4v4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              : <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M1 5V1h4M9 1h4v4M13 9v4H9M5 13H1V9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>}
          </button>
        </div>
        <p className="tg-hint">Тойрог дээр дарж задлах · нэр дээр дарж салбарын нийтлэлүүдийг үзэх · чирж хөдөлгөх</p>
      </div>
    </section>
  );
}
