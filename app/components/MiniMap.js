"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

// Нэг цэгийг харуулах жижиг газрын зураг (OpenStreetMap)
export default function MiniMap({ lat, lng, zoom = 13, className = "mm" }) {
  const box = useRef(null);
  const st = useRef({});
  useEffect(() => {
    let dead = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (dead || !box.current) return;
      if (!st.current.map) {
        const m = L.map(box.current, { zoomControl: true, scrollWheelZoom: false, attributionControl: true });
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' }).addTo(m);
        m.attributionControl.setPrefix(false);
        st.current.map = m;
        st.current.L = L;
      }
      const m = st.current.map;
      const ll = [lat, lng];
      if (st.current.mk) st.current.mk.setLatLng(ll);
      else st.current.mk = L.marker(ll, { icon: L.divIcon({ className: "cm-pin sm", iconSize: [34, 34], iconAnchor: [17, 17], html: '<img src="/club/marker.svg" width="34" height="34" alt="">' }) }).addTo(m);
      m.setView(ll, zoom);
    })();
    return () => { dead = true; };
  }, [lat, lng, zoom]);
  useEffect(() => () => { st.current.map?.remove(); st.current = {}; }, []);
  return <div ref={box} className={className} />;
}
