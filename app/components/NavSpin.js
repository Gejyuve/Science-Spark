"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LIVE_NAV } from "./navItems";

const SLOTS = 4; // логоны зүүн талд 2, баруун талд 2
const EVERY = 4500; // мс тутам икон солигдоно
const FADE = 260; // гарах хөдөлгөөний урт (globals.css .ss-spin.out-тэй ижил)

// Харагдах 4 байрын ядаж нэг нь өөрчлөгдсөн санамсаргүй дараалал (идэвхтэй товч 4-өөс олон бол нуугдсан нь ч орж ирнэ)
function reshuffle(cur) {
  for (let t = 0; t < 20; t++) {
    const a = [...cur];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    if (a.slice(0, SLOTS).some((v, i) => v !== cur[i])) return a;
  }
  return [...cur.slice(1), cur[0]];
}

// Логоны нэг талын 2 товч. Хоёр тал нэг дарааллыг хуваалцана (side 0 → 0-1, side 1 → 2-3).
export default function NavSpin({ side, active }) {
  const { order, out } = useSpin();
  return order.slice(side * 2, side * 2 + 2).map((i, k) => {
    const n = LIVE_NAV[i];
    const slot = side * 2 + k;
    return (
      <span key={slot} className="ss-spin-slot">
        <Link key={n.href} href={n.href} title={n.label} aria-label={n.label}
          className={"ss-round ss-spin" + (out.has(slot) ? " out" : "") + (active === n.href ? " on" : "")}>
          <img className="ic" src={`/icons/${n.icon}.svg`} width={24} height={24} alt="" />
        </Link>
      </span>
    );
  });
}

// Хоёр NavSpin нэг цагийг хуваалцана
const subs = new Set();
let state = { order: LIVE_NAV.map((_, i) => i), out: new Set() };
let timer = null;
const emit = () => subs.forEach((f) => f(state));

function tick() {
  // Хулгана/фокус дээд цэс дээр байвал товч алга болохгүйн тулд түр зогсооно
  if (document.hidden || document.querySelector(".ss-topnav:hover, .ss-topnav:focus-within")) return;
  const next = reshuffle(state.order);
  state = { order: state.order, out: new Set(next.slice(0, SLOTS).flatMap((v, k) => (v !== state.order[k] ? [k] : []))) };
  emit();
  setTimeout(() => { state = { order: next, out: new Set() }; emit(); }, FADE);
}

function useSpin() {
  const [s, set] = useState(state);
  useEffect(() => {
    subs.add(set);
    set(state);
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!still && !timer && LIVE_NAV.length > 1) timer = setInterval(tick, EVERY);
    return () => {
      subs.delete(set);
      if (subs.size === 0 && timer) { clearInterval(timer); timer = null; }
    };
  }, []);
  return s;
}
