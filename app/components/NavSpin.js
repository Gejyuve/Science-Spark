"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LIVE_NAV } from "./navItems";

const SLOTS = 4; // логоны зүүн талд 2, баруун талд 2
const EVERY = 7000; // мс тутам нэг солигдолт
const FADE = 260; // гарах хөдөлгөөний урт (globals.css .ss-spin.out-тэй ижил)
const GAP = 600; // хоёр товч байраа солих үед хоёр дахь нь хэр хойно солигдох

const pick = (n, not = -1) => { let i; do i = Math.floor(Math.random() * n); while (i === not); return i; };

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

// Нэг товч гарч, шинэ нь орж ирнэ. Нуугдсан идэвхтэй товч байвал (4-өөс олон) түүнийг оруулна,
// үгүй бол хоёр товч байраа сольно: эхлээд нэг нь, GAP-ийн дараа нөгөө нь — нэг нэгээрээ.
function swapSlot(k, item, then) {
  state = { ...state, out: new Set([k]) };
  emit();
  setTimeout(() => {
    const order = [...state.order];
    order[k] = item;
    state = { order, out: new Set() };
    emit();
    then && setTimeout(then, GAP);
  }, FADE);
}

function tick() {
  // Хулгана/фокус дээд цэс дээр байвал товч алга болохгүйн тулд түр зогсооно
  if (document.hidden || document.querySelector(".ss-topnav:hover, .ss-topnav:focus-within")) return;
  const cur = state.order;
  const a = pick(SLOTS);
  if (cur.length > SLOTS) {
    const h = SLOTS + pick(cur.length - SLOTS);
    const order = [...cur];
    order[h] = cur[a]; // гарах товч нуугдсан жагсаалт руу
    state = { ...state, order };
    return swapSlot(a, cur[h]);
  }
  const b = pick(SLOTS, a);
  swapSlot(a, cur[b], () => swapSlot(b, cur[a]));
}

function useSpin() {
  const [s, set] = useState(state);
  useEffect(() => {
    subs.add(set);
    set(state);
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!still && !timer && LIVE_NAV.length > 1 && SLOTS > 1) timer = setInterval(tick, EVERY);
    return () => {
      subs.delete(set);
      if (subs.size === 0 && timer) { clearInterval(timer); timer = null; }
    };
  }, []);
  return s;
}
