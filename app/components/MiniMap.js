"use client";

import { useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAP_STYLE, siteColors } from "@/lib/map-style";

// Нэрийн монгол бичгийн мөрийг хасаж, зөвхөн кирилл нэрийг үлдээнэ
const NAME = ["let", "n", ["coalesce", ["get", "name:mn"], ["get", "name"]],
  ["let", "i", ["index-of", "\n", ["var", "n"]],
    ["case", [">", ["var", "i"], 0], ["slice", ["var", "n"], 0, ["var", "i"]], ["var", "n"]]]];

function tune(m) {
  siteColors(m);
  for (const l of m.getStyle().layers) {
    if (l.type === "symbol" && JSON.stringify(l.layout?.["text-field"] || "").includes("name")) m.setLayoutProperty(l.id, "text-field", NAME);
  }
}

// Нэг цэгийг харуулах жижиг газрын зураг (клубын газрын зурагтай ижил бараан загвар)
export default function MiniMap({ lat, lng, zoom = 13, className = "mm" }) {
  const box = useRef(null);
  const st = useRef({});
  useEffect(() => {
    let dead = false;
    (async () => {
      const ml = (await import("maplibre-gl")).default;
      if (dead || !box.current) return;
      const ll = [lng, lat];
      if (!st.current.map) {
        const m = new ml.Map({
          container: box.current, style: MAP_STYLE, center: ll, zoom, maxZoom: 18, attributionControl: false,
          scrollZoom: false, dragRotate: false, pitchWithRotate: false, touchPitch: false,
        });
        m.touchZoomRotate.disableRotation();
        m.addControl(new ml.NavigationControl({ showCompass: false }), "top-left");
        m.on("load", () => { try { tune(m); } catch (e) {} });
        const el = document.createElement("div");
        el.className = "cm-pin sm";
        el.innerHTML = '<img src="/club/marker.svg" width="34" height="34" alt="">';
        st.current = { map: m, mk: new ml.Marker({ element: el, anchor: "center" }).setLngLat(ll).addTo(m) };
      } else {
        st.current.mk.setLngLat(ll);
        st.current.map.jumpTo({ center: ll, zoom });
      }
    })();
    return () => { dead = true; };
  }, [lat, lng, zoom]);
  useEffect(() => () => { st.current.map?.remove(); st.current = {}; }, []);
  return (
    <div className={className}>
      <div ref={box} className="mm-map" />
      <span className="cm-attr">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> · <a href="https://openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a></span>
    </div>
  );
}
