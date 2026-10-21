"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CatTools from "./CatTools";

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
    const node = { path: n.path, pp: parent ? parent.path : null, name: n.name, en: n.en, n: n.n, depth, has: n.kids.length > 0, open: open.has(n.path), x: depth * COL };
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

const DUR = 480;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const mix = (a, b, t) => a + (b - a) * t;
const calm = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
// Байгаа хамгийн ойрын өвөг салааг олно (шинэ салаа түүнээс ургаж, хаагдсан нь түүн рүү шингэнэ)
function anchor(node, map, byPath) {
  let p = node.pp;
  while (p != null && !map.has(p)) p = byPath.get(p)?.pp ?? null;
  return map.get(p ?? "");
}

// Figma 86:17 · Шинжлэх ухааны мод: салаа дээр дарж задлах, нэр дээр дарж салбарын хуудас нээх
export default function TreeGraph({ tree, initialOpen = [""], focus = null, loggedIn = false }) {
  const router = useRouter();
  const box = useRef(null);
  const drag = useRef(null);
  const [open, setOpen] = useState(() => new Set(initialOpen));
  const [sel, setSel] = useState(focus);
  const [view, setView] = useState({ x: 40, y: 40, k: 1 });
  const [full, setFull] = useState(false);
  const [hoverPath, setHover] = useState(null); // англи нэрийн тайлбар
  // Бүтэн дэлгэц: Esc дарж гарна, хуудас гүйхгүй
  useEffect(() => {
    if (!full) return;
    const esc = (e) => e.key === "Escape" && setFull(false);
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [full]);
  const { nodes: goal, w, h } = useMemo(() => layout(tree, open), [tree, open]);
  // Салаалах хөдөлгөөн: шинэ салаа эцгээсээ ургаж гарна, хаагдсан нь эцэг рүүгээ буцаж шингэнэ
  const [nodes, setNodes] = useState(() => goal.map((n) => ({ ...n, o: 1 })));
  const shown = useRef(nodes);
  const known = useRef(new Map()); // path -> node (хаагдаж буй салааны өвгийг олоход)
  const raf = useRef(0);
  useEffect(() => {
    for (const n of goal) known.current.set(n.path, n);
    const from = new Map(shown.current.map((n) => [n.path, n]));
    const to = new Map(goal.map((n) => [n.path, n]));
    const same = shown.current.length === goal.length && goal.every((n) => { const a = from.get(n.path); return a && a.x === n.x && a.y === n.y && a.o === 1; });
    if (same || calm()) { shown.current = goal.map((n) => ({ ...n, o: 1 })); setNodes(shown.current); return; }
    const tracks = goal.map((n) => {
      const a = from.get(n.path) || { ...(anchor(n, from, known.current) || n), o: 0 };
      return { n, ax: a.x, ay: a.y, ao: a.o, bx: n.x, by: n.y, bo: 1 };
    });
    for (const n of shown.current) {
      if (to.has(n.path)) continue;
      const b = anchor(n, to, known.current) || n;
      tracks.push({ n, ax: n.x, ay: n.y, ao: n.o, bx: b.x, by: b.y, bo: 0, gone: true });
    }
    // Эцгүүд нь хүүхдүүдээсээ өмнө зурагдана (хаагдаж буй салааг ч оруулаад)
    tracks.sort((p, q) => p.n.depth - q.n.depth);
    cancelAnimationFrame(raf.current);
    const t0 = performance.now();
    const step = (now) => {
      const t = ease(Math.min(1, (now - t0) / DUR));
      const done = t >= 1;
      shown.current = tracks
        .filter((k) => !(done && k.gone))
        .map((k) => ({ ...k.n, x: mix(k.ax, k.bx, t), y: mix(k.ay, k.by, t), o: mix(k.ao, k.bo, t), gone: k.gone }));
      setNodes(shown.current);
      if (!done) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [goal]);
  const links = useMemo(() => {
    const at = new Map(nodes.map((n) => [n.path, n]));
    return nodes.filter((n) => n.pp != null && at.has(n.pp)).map((n) => ({ from: at.get(n.pp), to: n }));
  }, [nodes]);

  // Харагдах хэсгийг зөөлөн шилжүүлнэ (чирэх, гүйлгэхэд шууд)
  const viewRaf = useRef(0);
  const viewNow = useRef(view);
  viewNow.current = view;
  const glide = useCallback((next) => {
    cancelAnimationFrame(viewRaf.current);
    if (calm()) return setView(next);
    const start = viewNow.current;
    const t0 = performance.now();
    const step = (now) => {
      const t = ease(Math.min(1, (now - t0) / DUR));
      setView({ x: mix(start.x, next.x, t), y: mix(start.y, next.y, t), k: mix(start.k, next.k, t) });
      if (t < 1) viewRaf.current = requestAnimationFrame(step);
    };
    viewRaf.current = requestAnimationFrame(step);
  }, []);
  const first = useRef(true);
  const fit = useCallback(() => {
    const el = box.current;
    if (!el) return;
    const cw = el.clientWidth, ch = el.clientHeight;
    // Хэт жижигрэхгүй: бичиг уншигдахуйц (0.75-аас доош биш), илүү хэсгийг чирж үзнэ
    const k = Math.min(1.1, Math.max(0.75, Math.min((cw - PAD) / (w + 40), (ch - PAD) / (h + 60))));
    const x = (w + 40) * k < cw ? (cw - (w - 140) * k) / 2 - 20 * k : 70;
    const next = { k, x, y: (ch - h * k) / 2 };
    if (first.current) { first.current = false; setView(next); } else glide(next);
  }, [w, h, glide]);
  useEffect(() => { fit(); }, [fit, full]);
  useEffect(() => {
    const on = () => fit();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [fit]);

  const zoom = (f, cx, cy) => { cancelAnimationFrame(viewRaf.current); setView((v) => {
    const el = box.current;
    const px = cx ?? el.clientWidth / 2, py = cy ?? el.clientHeight / 2;
    const k = Math.min(2.5, Math.max(0.3, v.k * f));
    return { k, x: px - ((px - v.x) * k) / v.k, y: py - ((py - v.y) * k) / v.k };
  }); };
  const toggle = (n) => {
    setSel(n.path);
    if (!n.has) return;
    setOpen((s) => { const x = new Set(s); x.has(n.path) ? x.delete(n.path) : x.add(n.path); return x; });
  };

  const onDown = (e) => {
    if (e.button !== 0 || e.target.closest("[data-node], .tg-zoom, .tg-tools, button, a")) return;
    cancelAnimationFrame(viewRaf.current);
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

  const hover = hoverPath == null ? null : nodes.find((n) => n.path === hoverPath && !n.gone);
  return (
    <section className={"tg-card" + (full ? " full" : "")}>
      <div ref={box} className={"tg-stage" + (drag.current ? " dragging" : "")} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <svg className="tg-svg" width="100%" height="100%" role="img" aria-label="Шинжлэх ухааны мод">
          <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
            {links.map(({ from, to }) => {
              const mx = (from.x + to.x) / 2;
              return <path key={to.path} className="tg-link" style={to.o < 1 ? { opacity: 0.9 * to.o } : undefined} d={`M${from.x},${from.y} C${mx},${from.y} ${mx},${to.y} ${to.x},${to.y}`} />;
            })}
            {nodes.map((n) => {
              const hollow = n.open || !n.path;
              const on = sel === n.path;
              return (
                <g key={n.path || "root"} className={"tg-node" + (on ? " on" : "")} style={{ transform: `translate(${n.x}px, ${n.y}px) scale(${0.5 + 0.5 * n.o})`, opacity: n.o, pointerEvents: n.gone ? "none" : undefined }} data-node
                  onMouseEnter={() => setHover(n.path)} onMouseLeave={() => setHover((h) => (h === n.path ? null : h))}>
                  <text className="tg-label" y={-15} textAnchor="middle" onClick={() => router.push(n.path ? `/tree/${n.path}` : "/tree")}>
                    {n.name} ({fmt(n.n)})
                  </text>
                  <circle r={9} className={hollow ? "hollow" : n.has ? "full" : "leaf"} onClick={() => toggle(n)} />
                  {n.has && !n.open && <text className="tg-plus" y={3.5} textAnchor="middle" onClick={() => toggle(n)}>+</text>}
                </g>
              );
            })}
          </g>
        </svg>
        {hover && hover.en && (
          <span className="tg-tip" style={{ left: view.x + hover.x * view.k, top: view.y + hover.y * view.k - 15 * view.k - 12 }}>
            {hover.en}
          </span>
        )}
        <div className="tg-tools" data-node><CatTools tree={tree} loggedIn={loggedIn} compact /></div>
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
