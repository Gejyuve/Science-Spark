"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import "leaflet/dist/leaflet.css";

const fmtK = (n) => (n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "K" : String(n || 0));
const MN = [[41.4, 87.6], [52.3, 120.1]];

// Клубын газрын зураг: OpenStreetMap (CARTO харанхуй загвар). Томруулж, чирж болно.
export default function ClubMap({ clubs, aimags }) {
  const box = useRef(null);
  const map = useRef(null);
  const [sel, setSel] = useState(null); // { c, x, y }
  const [full, setFull] = useState(false);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    let dead = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (dead || !box.current || map.current) return;
      const m = L.map(box.current, {
        zoomControl: false, attributionControl: true, scrollWheelZoom: false,
        minZoom: 4, maxZoom: 18, maxBounds: [[36, 78], [57, 130]], maxBoundsViscosity: 0.8, worldCopyJump: false,
      });
      m.fitBounds(MN, { padding: [10, 10] });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        subdomains: "abcd", maxZoom: 19,
        attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> · © <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>',
      }).addTo(m);
      m.attributionControl.setPrefix(false);
      const place = (c, ll) => { const p = m.latLngToContainerPoint(ll); setSel({ c, x: p.x, y: p.y, ll }); };
      for (const c of clubs) {
        if (c.lat == null || c.lng == null) continue;
        const ll = L.latLng(c.lat, c.lng);
        const icon = L.divIcon({ className: "cm-pin", iconSize: [44, 44], iconAnchor: [22, 22],
          html: `<span class="cm-glow"></span><img src="/club/marker.svg" width="44" height="44" alt=""><span class="cm-city">${(c.first_name || "").replace(/[<>&"]/g, "")}</span>` });
        const mk = L.marker(ll, { icon, keyboard: true, title: c.first_name, riseOnHover: true }).addTo(m);
        mk.on("mouseover click focus", () => place(c, ll));
      }
      m.on("move zoom", () => setSel((s) => (s ? { ...s, ...m.latLngToContainerPoint(s.ll) } : s)));
      m.on("click", () => { setSel(null); m.scrollWheelZoom.enable(); setArmed(true); });
      map.current = m;
    })();
    return () => { dead = true; map.current?.remove(); map.current = null; };
  }, [clubs]);

  useEffect(() => { setTimeout(() => map.current?.invalidateSize(), 50); }, [full]);
  useEffect(() => {
    if (!full) return;
    const esc = (e) => e.key === "Escape" && setFull(false);
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [full]);

  const total = clubs.length;
  const left = sel && box.current && sel.x > box.current.clientWidth - 300;
  return (
    <section className={"cm-card" + (full ? " full" : "")} onMouseLeave={() => !full && setSel(null)}>
      <div ref={box} className="cm-leaf" />
      <div className="cm-head">
        <h1>Клубын газрын зураг</h1>
        <p>{total ? `Манай вебд бүртгэлтэй ${total} клубын байршил` : "Манай вебд бүртгэлтэй клубын байршил"}</p>
      </div>
      <span className="cm-legend">✦ {total} клуб · {aimags} аймаг</span>
      <div className="cm-tools">
        <button type="button" onClick={() => map.current?.zoomIn()} aria-label="Томруулах" title="Томруулах">+</button>
        <button type="button" onClick={() => map.current?.zoomOut()} aria-label="Жижигрүүлэх" title="Жижигрүүлэх">−</button>
        <button type="button" onClick={() => { map.current?.fitBounds(MN, { padding: [10, 10] }); setSel(null); }} aria-label="Монголыг бүтнээр" title="Монголыг бүтнээр">⌂</button>
        <button type="button" onClick={() => setFull((f) => !f)} aria-label={full ? "Жижиг болгох" : "Бүтэн дэлгэц"} title={full ? "Жижиг болгох" : "Бүтэн дэлгэц"}>{full ? "×" : "⛶"}</button>
      </div>
      <span className="cm-hint">{!total ? "Клубууд бүртгүүлэхэд байршил нь энд гэрэлтэнэ" : armed ? "Хулганы дугуйгаар томруулж, чирж хөдөлгөнө" : "Оч дээр хулганаа аваачиж клубын мэдээллийг үзнэ үү · Томруулахын тулд зураг дээр дарна уу"}</span>
      {sel && (
        <div className={"cm-pop" + (left ? " left" : "")} style={{ left: sel.x, top: sel.y }} role="dialog" aria-label={sel.c.first_name}>
          <div className="cm-pop-top">
            <ClubAv c={sel.c} size={40} />
            <div><b>{sel.c.first_name}</b>{sel.c.aimag && <small><img className="ic" src="/icons/f_pin.svg" width={14} height={14} alt="" />{sel.c.aimag}</small>}</div>
            {sel.c.rank && <em>ТОП #{sel.c.rank}</em>}
          </div>
          <div className="cm-pop-stat">
            <span><img src="/icons/spark.svg" width={16} height={16} alt="" />{fmtK(sel.c.points)}</span>
            <span><img className="ic" src="/icons/followers.svg" width={14} height={14} alt="" />{sel.c.members} гишүүн</span>
          </div>
          {sel.c.about && <p>{sel.c.about}</p>}
          <div className="cm-pop-foot">
            <Link href={`/u/${sel.c.id}`} className="cm-join">Нэгдэх</Link>
            <Link href={`/u/${sel.c.id}`} className="cm-more">Дэлгэрэнгүй →</Link>
          </div>
        </div>
      )}
    </section>
  );
}

const COLORS = ["#37C3B3", "#5B8DEF", "#F59E0B", "#E5484D", "#8E6CEF", "#00A89B", "#EF6C9C"];
export function ClubAv({ c, size = 40 }) {
  if (c.avatar) return <img className="ss-avatar" src={`/img/${c.avatar}`} width={size} height={size} alt="" style={{ width: size, height: size, objectFit: "cover" }} />;
  return <span className="ss-avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.42), background: COLORS[(Number(c.id) || 0) % COLORS.length] }} aria-hidden="true">{(c.first_name || "?")[0]}</span>;
}
