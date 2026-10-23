"use client";

import { useEffect, useRef } from "react";

const SDK = "https://embed.cloudflarestream.com/embed/sdk.latest.js";
let sdk = null;
const loadSdk = () =>
  (sdk ||= new Promise((res, rej) => {
    if (window.Stream) return res(window.Stream);
    const s = document.createElement("script");
    s.src = SDK;
    s.async = true;
    s.onload = () => res(window.Stream);
    s.onerror = () => { sdk = null; rej(new Error("sdk")); };
    document.head.appendChild(s);
  }));

// Cloudflare-ийн тоглуулагч (зогсоох, үргэлжлүүлэх, хурд, бүтэн дэлгэц; татах товчгүй).
// Үзсэн хэсгийг 10 секунд тутам, зогсоох, дуусах, хуудас хаахад хадгална. Дараа нь тэндээсээ үргэлжилнэ.
export default function Player({ src, title, videoId, track = true }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!track || !ref.current) return;
    let player = null, last = -1, alive = true;
    const send = (ended = false, beacon = false) => {
      const t = player ? Math.floor(player.currentTime || 0) : 0;
      if (!ended && (t < 1 || t === last)) return;
      last = t;
      const body = JSON.stringify({ id: videoId, t, ended });
      if (beacon && navigator.sendBeacon) navigator.sendBeacon("/api/video/progress", new Blob([body], { type: "text/plain" }));
      else fetch("/api/video/progress", { method: "POST", body, keepalive: true }).catch(() => {});
    };
    let timer = null;
    const hide = () => document.visibilityState === "hidden" && send(false, true);
    loadSdk().then((Stream) => {
      if (!alive || !ref.current) return;
      player = Stream(ref.current);
      player.addEventListener("play", () => { if (!timer) timer = setInterval(() => send(), 10000); });
      player.addEventListener("pause", () => send());
      player.addEventListener("ended", () => send(true));
    }).catch(() => {});
    document.addEventListener("visibilitychange", hide);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", hide);
      send(false, true);
    };
  }, [videoId, track]);
  return (
    <iframe ref={ref} src={src} title={title}
      allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture" allowFullScreen />
  );
}
