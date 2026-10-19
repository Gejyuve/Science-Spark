"use client";

import { useEffect } from "react";

// Сайтад өнгөрөөсөн хугацааг хэмжинэ: хуудас харагдаж байх үед минут тутам дохио өгнө. Хувийн мэдээлэл илгээхгүй.
export default function Ping() {
  useEffect(() => {
    let v = "";
    try {
      v = localStorage.getItem("ss-vid") || "";
      if (!v) {
        v = Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
        localStorage.setItem("ss-vid", v);
      }
    } catch (e) {
      v = Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
    }
    const send = () => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/ping", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ v }), keepalive: true }).catch(() => {});
    };
    send();
    const t = setInterval(send, 60000);
    const onVis = () => document.visibilityState === "visible" && send();
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, []);
  return null;
}
