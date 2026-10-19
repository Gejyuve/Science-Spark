"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import "maplibre-gl/dist/maplibre-gl.css";
import { MN_BORDER } from "@/lib/mn-border";
import { MAP_STYLE, siteColors } from "@/lib/map-style";

const fmtK = (n) => (n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "K" : String(n || 0));
const MN = [[87.6, 41.4], [120.1, 52.3]];
const MN_POLY = { type: "Polygon", coordinates: [MN_BORDER] };
const esc = (s) => String(s || "").replace(/[<>&"]/g, "");

// Харанхуй загварыг сайтын өнгөнд тааруулж, зөвхөн Монгол доторх аймгийн нэрийг үлдээнэ
function tune(m) {
  const style = m.getStyle();
  for (const l of style.layers) {
    if (l.type === "symbol") {
      if (l.id === "place_state") {
        m.setFilter(l.id, ["all", ["==", ["get", "class"], "state"], ["within", MN_POLY]]);
        // Нэрийн монгол бичгийн хэсгийг (мөр эсвэл зайны дараах) хасаж, зөвхөн кирилл нэрийг үлдээнэ
        m.setLayoutProperty(l.id, "text-field", ["let", "n", ["coalesce", ["get", "name:mn"], ["get", "name"]],
          ["let", "i", ["index-of", "\n", ["var", "n"]], "j", ["index-of", " ", ["var", "n"]],
            ["case", [">", ["var", "i"], 0], ["slice", ["var", "n"], 0, ["var", "i"]],
              [">", ["var", "j"], 0], ["slice", ["var", "n"], 0, ["var", "j"]], ["var", "n"]]]]);
        m.setLayoutProperty(l.id, "text-transform", "none");
        m.setPaintProperty(l.id, "text-color", "rgba(207,250,243,0.78)");
        m.setPaintProperty(l.id, "text-halo-color", "rgba(3,12,16,0.9)");
        m.setPaintProperty(l.id, "text-halo-width", 1.2);
      } else m.setLayoutProperty(l.id, "visibility", "none");
    }
  }
  siteColors(m);
  m.addSource("mn", { type: "geojson", data: { type: "Feature", properties: {}, geometry: MN_POLY } });
  m.addLayer({ id: "mn-glow", type: "line", source: "mn", paint: { "line-color": "#37E6D0", "line-opacity": 0.18, "line-width": 7, "line-blur": 5 } });
  m.addLayer({ id: "mn-line", type: "line", source: "mn", paint: { "line-color": "#5BF0DC", "line-opacity": 0.45, "line-width": 1.2 } });
}

// Клубын газрын зураг: OpenStreetMap (OpenFreeMap). Томруулж, чирж болно.
export default function ClubMap({ clubs, aimags }) {
  const box = useRef(null);
  const map = useRef(null);
  const [sel, setSel] = useState(null); // { c, x, y, ll }
  const [full, setFull] = useState(false);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    let dead = false;
    (async () => {
      const ml = (await import("maplibre-gl")).default;
      if (dead || !box.current || map.current) return;
      const m = new ml.Map({
        container: box.current, style: MAP_STYLE, bounds: MN, fitBoundsOptions: { padding: 16 },
        minZoom: 3, maxZoom: 17, maxBounds: [[70, 33], [138, 60]], attributionControl: false,
        scrollZoom: false, dragRotate: false, pitchWithRotate: false, touchPitch: false,
      });
      m.touchZoomRotate.disableRotation();
      map.current = m;
      m.on("load", () => {
        try { tune(m); } catch (e) {}
        for (const c of clubs) {
          if (c.lat == null || c.lng == null) continue;
          const el = document.createElement("button");
          el.type = "button";
          el.className = "cm-pin";
          el.setAttribute("aria-label", c.name);
          el.innerHTML = `<span class="cm-glow"></span><img src="/club/marker.svg" width="44" height="44" alt=""><span class="cm-city">${esc(c.name)}</span>`;
          const ll = [c.lng, c.lat];
          const show = (e) => { e?.stopPropagation?.(); const p = m.project(ll); setSel({ c, x: p.x, y: p.y, ll }); };
          el.addEventListener("mouseenter", show);
          el.addEventListener("focus", show);
          el.addEventListener("click", show);
          new ml.Marker({ element: el, anchor: "center" }).setLngLat(ll).addTo(m);
        }
      });
      m.on("move", () => setSel((s) => (s ? { ...s, ...m.project(s.ll) } : s)));
      m.on("click", () => { setSel(null); m.scrollZoom.enable(); setArmed(true); });
    })();
    return () => { dead = true; map.current?.remove(); map.current = null; };
  }, [clubs]);

  useEffect(() => { setTimeout(() => map.current?.resize(), 60); }, [full]);
  useEffect(() => {
    if (!full) return;
    const k = (e) => e.key === "Escape" && setFull(false);
    document.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [full]);

  const total = clubs.length;
  const left = sel && box.current && sel.x > box.current.clientWidth - 300;
  return (
    <section className={"cm-card" + (full ? " full" : "")} onMouseLeave={() => !full && setSel(null)}>
      <div ref={box} className="cm-leaf" />
      <h1 className="cm-sr">Клубын газрын зураг</h1>
      <span className="cm-legend">✦ {total} клуб · {aimags} аймаг</span>
      <div className="cm-tools">
        <button type="button" onClick={() => map.current?.zoomIn()} aria-label="Томруулах" title="Томруулах">+</button>
        <button type="button" onClick={() => map.current?.zoomOut()} aria-label="Жижигрүүлэх" title="Жижигрүүлэх">−</button>
        <button type="button" onClick={() => { map.current?.fitBounds(MN, { padding: 16 }); setSel(null); }} aria-label="Монголыг бүтнээр" title="Монголыг бүтнээр">⌂</button>
        <button type="button" onClick={() => setFull((f) => !f)} aria-label={full ? "Жижиг болгох" : "Бүтэн дэлгэц"} title={full ? "Жижиг болгох" : "Бүтэн дэлгэц"}>{full ? "×" : "⛶"}</button>
      </div>
      <span className="cm-hint">{!total ? "Клубууд бүртгүүлэхэд байршил нь энд гэрэлтэнэ" : armed ? "Хулганы дугуйгаар томруулж, чирж хөдөлгөнө" : "Оч дээр хулганаа аваачиж клубын мэдээллийг үзнэ үү · Томруулахын тулд зураг дээр дарна уу"}</span>
      <span className="cm-attr">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> · <a href="https://openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a></span>
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
