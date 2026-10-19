"use client";

import { useEffect, useState } from "react";

const pad = (n) => String(n).padStart(2, "0");

// Шагнал олгох хүртэл үлдсэн хугацаа: хоног, цаг, минут, секунд
export default function Countdown({ end, initial }) {
  const [left, setLeft] = useState(initial);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, end - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [end]);
  const s = Math.floor(left / 1000);
  const parts = [[Math.floor(s / 86400), "хоног"], [pad(Math.floor(s / 3600) % 24), "цаг"], [pad(Math.floor(s / 60) % 60), "минут"], [pad(s % 60), "секунд"]];
  return (
    <div className="san-count" role="timer" aria-label="Шагнал олгох хүртэл">
      <small>Шагнал олгох хүртэл</small>
      <div>
        {parts.map(([v, l]) => <span key={l}><b>{v}</b><i>{l}</i></span>)}
      </div>
    </div>
  );
}
