"use client";

import { useEffect, useState } from "react";

const page = (issue, p) => `/api/magazine/page?i=${issue.id}&p=${p}`;
export const frontSrc = (issue) => (issue.pages > 0 ? page(issue, 1) : null);
// Арын хавтас = сүүлийн хуудас
export const backSrc = (issue) => (issue.pages > 1 ? page(issue, issue.pages) : null);
// Сэтгүүлийн зузаан (px): 3D дүрсэнд хуудасны тооноос хамаарна
export const thick = (issue, k, lo, hi) => Math.min(hi, Math.max(lo, Math.round((issue.pages || 40) * k)));

// Нүүрний нуруу талын (зүүн) ирмэгийн дундаж өнгө: нурууг тэр өнгөөр будна
const colors = new Map();
export function useSpineColor(src) {
  const [c, setC] = useState(() => (src && colors.get(src)) || null);
  useEffect(() => {
    if (!src) return setC(null);
    if (colors.has(src)) return setC(colors.get(src));
    let live = true;
    const img = new Image();
    img.onload = () => {
      try {
        const cv = document.createElement("canvas");
        cv.width = 4; cv.height = 48;
        const ctx = cv.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, Math.max(1, img.naturalWidth * 0.04), img.naturalHeight, 0, 0, 4, 48);
        const d = ctx.getImageData(0, 0, 4, 48).data;
        let r = 0, g = 0, b = 0;
        for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
        const n = d.length / 4;
        const v = `rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)})`;
        colors.set(src, v);
        if (live) setC(v);
      } catch {}
    };
    img.src = src;
    return () => { live = false; };
  }, [src]);
  return c;
}

// Дугаарын 3D дүрс: нүүр, нуруу, хуудасны ирмэг, ар тал, газрын сүүдэр. Зузаан нь хуудасны тооноос хамаарна.
export function IssueMock({ issue, eager = false, size = "" }) {
  const src = frontSrc(issue);
  const back = backSrc(issue);
  const spine = useSpineColor(src);
  return (
    <span className={"mz-3d" + (size ? ` ${size}` : "")} style={{ "--t": `${thick(issue, 0.07, 3, 9)}px`, ...(spine ? { "--spine": spine } : {}) }}>
      <span className="mz-book">
        <span className="mz-face">
          {src ? <img src={src} alt={`№${issue.number} дугаарын нүүр`} loading={eager ? "eager" : "lazy"} draggable={false} /> : <i aria-hidden="true">№{issue.number}</i>}
        </span>
        <span className="mz-spine" aria-hidden="true" />
        <span className="mz-edge" aria-hidden="true" />
        <span className="mz-back" aria-hidden="true">{back && <img src={back} alt="" loading="lazy" draggable={false} />}</span>
      </span>
    </span>
  );
}
