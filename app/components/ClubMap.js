"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import "leaflet/dist/leaflet.css";

const fmtK = (n) => (n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "K" : String(n || 0));
const MN = [[41.4, 87.6], [52.3, 120.1]];
// Монгол Улсын хил (ойролцоо, [уртраг, өргөрөг]) — Natural Earth / world.geo.json
const BORDER = [[87.751264,49.297198],[88.805567,49.470521],[90.713667,50.331812],[92.234712,50.802171],[93.104219,50.49529],[94.147566,50.480537],[94.815949,50.013433],[95.814028,49.977467],[97.259728,49.726061],[98.231762,50.422401],[97.82574,51.010995],[98.861491,52.047366],[99.981732,51.634006],[100.88948,51.516856],[102.065223,51.259921],[102.255909,50.510561],[103.676545,50.089966],[104.621552,50.275329],[105.886591,50.406019],[106.888804,50.274296],[107.868176,49.793705],[108.475167,49.282548],[109.402449,49.292961],[110.662011,49.130128],[111.581231,49.377968],[112.89774,49.543565],[114.362456,50.248303],[114.96211,50.140247],[115.485695,49.805177],[116.678801,49.888531],[116.191802,49.134598],[115.485282,48.135383],[115.742837,47.726545],[116.308953,47.85341],[117.295507,47.697709],[118.064143,48.06673],[118.866574,47.74706],[119.772824,47.048059],[119.66327,46.69268],[118.874326,46.805412],[117.421701,46.672733],[116.717868,46.388202],[115.985096,45.727235],[114.460332,45.339817],[113.463907,44.808893],[112.436062,45.011646],[111.873306,45.102079],[111.348377,44.457442],[111.667737,44.073176],[111.829588,43.743118],[111.129682,43.406834],[110.412103,42.871234],[109.243596,42.519446],[107.744773,42.481516],[106.129316,42.134328],[104.964994,41.59741],[104.522282,41.908347],[103.312278,41.907468],[101.83304,42.514873],[100.845866,42.663804],[99.515817,42.524691],[97.451757,42.74889],[96.349396,42.725635],[95.762455,43.319449],[95.306875,44.241331],[94.688929,44.352332],[93.480734,44.975472],[92.133891,45.115076],[90.94554,45.286073],[90.585768,45.719716],[90.970809,46.888146],[90.280826,47.693549],[88.854298,48.069082],[88.013832,48.599463],[87.751264,49.297198]];

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
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>-ийн оролцогчид',
      }).addTo(m);
      // Монголоос гадна талыг бүдгэрүүлж, хилийг гэрэлтүүлнэ
      const mn = BORDER.map(([x, y]) => [y, x]);
      L.polygon([[[85, -180], [85, 180], [-85, 180], [-85, -180]], mn], { stroke: false, fillColor: "#020a0d", fillOpacity: 0.55, interactive: false }).addTo(m);
      L.polygon(mn, { color: "#5BF0DC", weight: 1.6, opacity: 0.95, fillColor: "#37C3B3", fillOpacity: 0.08, interactive: false, className: "cm-border" }).addTo(m);
      m.attributionControl.setPrefix(false);
      const place = (c, ll) => { const p = m.latLngToContainerPoint(ll); setSel({ c, x: p.x, y: p.y, ll }); };
      for (const c of clubs) {
        if (c.lat == null || c.lng == null) continue;
        const ll = L.latLng(c.lat, c.lng);
        const icon = L.divIcon({ className: "cm-pin", iconSize: [44, 44], iconAnchor: [22, 22],
          html: `<span class="cm-glow"></span><img src="/club/marker.svg" width="44" height="44" alt=""><span class="cm-city">${(c.name || "").replace(/[<>&"]/g, "")}</span>` });
        const mk = L.marker(ll, { icon, keyboard: true, title: c.name, riseOnHover: true }).addTo(m);
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
        <div className={"cm-pop" + (left ? " left" : "")} style={{ left: sel.x, top: sel.y }} role="dialog" aria-label={sel.c.name}>
          <div className="cm-pop-top">
            <ClubAv c={sel.c} size={40} />
            <div><b>{sel.c.name}</b>{sel.c.city && <small><img className="ic" src="/icons/f_pin.svg" width={14} height={14} alt="" />{sel.c.city}</small>}</div>
            {sel.c.rank && <em>ТОП #{sel.c.rank}</em>}
          </div>
          <div className="cm-pop-stat">
            <span><img src="/icons/spark.svg" width={16} height={16} alt="" />{fmtK(sel.c.points)}</span>
            <span><img className="ic" src="/icons/followers.svg" width={14} height={14} alt="" />{sel.c.members} гишүүн</span>
          </div>
          {sel.c.about && <p>{sel.c.about}</p>}
          <div className="cm-pop-foot">
            <Link href={`/club/${sel.c.id}`} className="cm-join">Нэгдэх</Link>
            <Link href={`/club/${sel.c.id}`} className="cm-more">Дэлгэрэнгүй →</Link>
          </div>
        </div>
      )}
    </section>
  );
}

const COLORS = ["#37C3B3", "#5B8DEF", "#F59E0B", "#E5484D", "#8E6CEF", "#00A89B", "#EF6C9C"];
function ClubAv({ c, size = 40 }) {
  if (c.logo) return <img className="ss-avatar" src={`/img/${c.logo}`} width={size} height={size} alt="" style={{ width: size, height: size, objectFit: "cover" }} />;
  return <span className="ss-avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.42), background: COLORS[(Number(c.id) || 0) % COLORS.length] }} aria-hidden="true">{(c.name || "?")[0]}</span>;
}
