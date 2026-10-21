"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import ReferralAsk from "./ReferralAsk";

// Контент илгээсний дараах баярын цонх. Сервер үйлдэл (lib/celebrate.js) «ss_yay» күүки тавина,
// энд уншаад цонхоо гаргаж, күүкийг устгана. Сервер үйлдлийн дараах шилжилт хуудсыг дахин ачаалдаггүй тул байн байн шалгана.
const COOKIE = "ss_yay";
const n = (x) => Number(x || 0).toLocaleString("en-US");

// Төрөл бүрийн дүрс, өнгө, гарчиг, урам өгөх үг
const KIND = {
  Нийтлэл: { art: Lighthouse, ic: "📝", c: "#00a89b", noun: "Нийтлэл" },
  Мэдээ: { art: Lighthouse, ic: "📰", c: "#0a84ff", noun: "Мэдээ" },
  Асуулт: { art: Diamond, ic: "❓", c: "#9b3df0", noun: "Асуулт" },
  Бодрол: { art: Torch, ic: "💡", c: "#ff9500", noun: "Бодрол" },
  Эвент: { ic: "🎪", c: "#e5243b", noun: "Эвент" },
  Зарлал: { ic: "📣", c: "#ff2d7a", noun: "Зарлал" },
  Үг: { ic: "📖", c: "#16c25a", noun: "Шинэ үг" },
  Даалгавар: { ic: "🧪", c: "#0a84ff", noun: "Даалгавар" },
  Тайлан: { ic: "🏅", c: "#f5a700", noun: "Тайлан" },
  Хариулт: { ic: "🤝", c: "#9b3df0", noun: "Хариулт" },
  Профайл: { ic: "🚀", c: "#00a89b", noun: "Профайл" },
};
const WHY = {
  Нийтлэл: "Таны бичсэн мэдлэг дараагийн үеийнхний замыг гэрэлтүүлнэ. Монгол хэл дээрх шинжлэх ухааны уран зохиолд хувь нэмэр орууллаа.",
  Мэдээ: "Шинжлэх ухааны мэдээг цагт нь хүргэж, олон хүний сонирхлыг асаахад тусаллаа.",
  Асуулт: "Агуу нээлт асуухаас эхэлдэг.",
  Бодрол: "Санаа бүр хэн нэгний сонирхлыг асааж магадгүй. Бодлоо хуваалцсанд баярлалаа!",
  Эвент: "Шинжлэх ухааны арга хэмжээг олон түмэнд хүргэхэд тусалж байна. Редакц хянаад нийтэлнэ.",
  Зарлал: "Боломжийг хэрэгтэй хүнд нь хүргэж байна. Редакц хянаад нийтэлнэ.",
  Үг: "Монгол хэлээр шинжлэх ухаан ярихад хувь нэмэр орууллаа. 7 хоног санал авч, дэмжлэг авбал Толь-д орно.",
  Даалгавар: "Клубүүд туршиж, бүтээж, хамтдаа суралцах шинэ сорилт нэмэгдлээ. Редакц хянаад нийтэлнэ.",
  Тайлан: "Клубийнхаа хөдөлмөрийг бусдад үлгэр болгон хуваалцлаа. Редакц хянаад нийтэлнэ.",
  Хариулт: "Мэдлэгээ хуваалцаж, хэн нэгний асуултад гэрэл тусгалаа. Анхны хариултын урамшуулал танд олгогдлоо!",
  Профайл: "Science Spark гэр бүлд тавтай морил. Монголд шинжлэх ухааны очыг хамтдаа түгээж, мэдлэгээ дараагийн үедээ өвлүүлцгээе!",
};
const head = (d) => {
  const noun = KIND[d.k]?.noun || "Бүтээл";
  if (d.k === "Хариулт") return "Анхны хариулт тань нийтлэгдлээ!";
  if (d.k === "Профайл") return "Таны профайл үүслээ!";
  if (d.s === "published") return `${noun} тань нийтлэгдлээ!`;
  if (d.s === "discussion") return `${noun} хэлэлцүүлэгт орлоо!`;
  return `${noun} тань редакц руу илгээгдлээ!`;
};

// Баярын цацраг
const BITS = Array.from({ length: 34 }, (_, i) => ({
  c: ["#37c3b3", "#ffb547", "#ff7aa8", "#7fd6ff", "#9be15d", "#c13bff"][i % 6],
  x: (i * 29) % 100, d: (i % 7) * 0.12, s: 6 + (i % 4) * 2, r: (i % 2 ? 1 : -1) * (180 + (i % 5) * 90),
}));

function readCookie() {
  const m = document.cookie.match(/(?:^|;\s*)ss_yay=([^;]+)/);
  if (!m) return null;
  document.cookie = `${COOKIE}=; Max-Age=0; path=/`;
  try {
    const b64 = decodeURIComponent(m[1]).replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64 + "===".slice((b64.length + 3) % 4));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0))));
  } catch (e) {
    return null;
  }
}

// Шинэ профайлын дүрс: харанхуй сансарт анивчих цэнхэр од
const DOTS = [[18, 26, 0], [74, 20, .6], [82, 64, 1.2], [26, 74, .3], [50, 12, .9], [12, 52, 1.5], [66, 84, .45]];
function StarBadge() {
  return (
    <span className="cel-badge cel-space" aria-hidden="true">
      <span>
        {DOTS.map(([x, y, dl], i) => <i key={i} style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${dl}s` }} />)}
        <svg viewBox="0 0 48 48" className="cel-star">
          <defs>
            <radialGradient id="cel-star-g" cx="50%" cy="45%" r="60%">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset=".18" stopColor="#d6f0ff" />
              <stop offset=".5" stopColor="#5cb8ff" />
              <stop offset="1" stopColor="#1f6fff" />
            </radialGradient>
          </defs>
          <path d="M24 2 C26 17 31 22 46 24 C31 26 26 31 24 46 C22 31 17 26 2 24 C17 22 22 17 24 2 Z" fill="url(#cel-star-g)" />
        </svg>
      </span>
    </span>
  );
}

// Нийтлэл, мэдээний дүрс: мэдлэгийн гэрлийг цацруулагч гэрэлт цамхаг (lib/og-assets/lighthouse.svg-ийн жижиг хувилбар)
function Lighthouse() {
  return (
    <svg viewBox="90 46 260 432" className="cel-lh" aria-hidden="true">
      <defs>
        <linearGradient id="cel-lh-bl" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stopColor="#9ff0e6" stopOpacity=".7" /><stop offset="1" stopColor="#37c3b3" stopOpacity="0" /></linearGradient>
        <linearGradient id="cel-lh-br" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#9ff0e6" stopOpacity=".7" /><stop offset="1" stopColor="#37c3b3" stopOpacity="0" /></linearGradient>
        <radialGradient id="cel-lh-g" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#fff" /><stop offset=".35" stopColor="#bff7ef" stopOpacity=".85" /><stop offset="1" stopColor="#37c3b3" stopOpacity="0" /></radialGradient>
        <linearGradient id="cel-lh-t" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#2fc4b4" /><stop offset="1" stopColor="#00877c" /></linearGradient>
        <clipPath id="cel-lh-c"><polygon points="188,178 252,178 280,440 160,440" /></clipPath>
      </defs>
      <polygon points="220,128 40,60 40,196" fill="url(#cel-lh-bl)" />
      <polygon points="220,128 400,66 400,190" fill="url(#cel-lh-br)" />
      <circle cx="220" cy="128" r="84" fill="url(#cel-lh-g)" />
      <polygon points="220,62 186,96 254,96" fill="#00877c" />
      <circle cx="220" cy="58" r="6" fill="#37c3b3" />
      <rect x="180" y="96" width="80" height="8" rx="3" fill="#0a5e57" />
      <rect x="192" y="104" width="56" height="48" rx="4" fill="#fffbe0" stroke="#0a5e57" strokeWidth="5" />
      <line x1="220" y1="104" x2="220" y2="152" stroke="#0a5e57" strokeWidth="4" />
      <rect x="172" y="152" width="96" height="10" rx="3" fill="#0a5e57" />
      <rect x="180" y="162" width="80" height="16" fill="#0d6f66" />
      <polygon points="188,178 252,178 280,440 160,440" fill="url(#cel-lh-t)" />
      <g clipPath="url(#cel-lh-c)" fill="#e9fbf8">
        <rect x="140" y="222" width="160" height="34" />
        <rect x="140" y="310" width="160" height="34" />
        <rect x="140" y="398" width="160" height="34" />
      </g>
      <path d="M208,440 V414 a12,12 0 0 1 24,0 V440 Z" fill="#0a5e57" />
      <path d="M120,452 Q150,430 196,440 L248,438 Q296,428 324,452 Q330,470 300,474 L140,474 Q112,470 120,452 Z" fill="#1d3e3a" />
    </svg>
  );
}

// Асуултын дүрс: зүсэлттэй алмаз (асуулт бүр үнэ цэнэтэй)
function Diamond() {
  return (
    <svg viewBox="0 0 64 64" className="cel-art" aria-hidden="true">
      <defs>
        <linearGradient id="cel-dm-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e6fbff" /><stop offset="1" stopColor="#7fd6ff" /></linearGradient>
        <linearGradient id="cel-dm-b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5cb8ff" /><stop offset="1" stopColor="#1f6fff" /></linearGradient>
        <linearGradient id="cel-dm-c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9fe3ff" /><stop offset="1" stopColor="#3b8cff" /></linearGradient>
      </defs>
      <polygon points="18,12 46,12 58,25 32,56 6,25" fill="url(#cel-dm-b)" />
      <polygon points="6,25 18,12 24,25" fill="#bfefff" />
      <polygon points="18,12 32,12 24,25" fill="url(#cel-dm-a)" />
      <polygon points="32,12 46,12 40,25" fill="#d4f6ff" />
      <polygon points="46,12 58,25 40,25" fill="#8fdcff" />
      <polygon points="24,25 32,12 40,25" fill="#f4fdff" />
      <polygon points="6,25 24,25 32,56" fill="url(#cel-dm-c)" />
      <polygon points="24,25 40,25 32,56" fill="#6fc4ff" />
      <polygon points="40,25 58,25 32,56" fill="#2f7dff" />
      <path d="M52 4 l1.6 4.4 4.4 1.6 -4.4 1.6 -1.6 4.4 -1.6 -4.4 -4.4 -1.6 4.4 -1.6 z" fill="#ffd36b" />
      <path d="M10 44 l1 2.8 2.8 1 -2.8 1 -1 2.8 -1 -2.8 -2.8 -1 2.8 -1 z" fill="#7fd6ff" />
    </svg>
  );
}

// Бодролын дүрс: галт бамбар (санаа бүр очоос эхэлнэ)
function Torch() {
  return (
    <svg viewBox="0 0 64 64" className="cel-art" aria-hidden="true">
      <defs>
        <radialGradient id="cel-tc-g" cx=".5" cy=".55" r=".5"><stop offset="0" stopColor="#ffe9a8" stopOpacity=".9" /><stop offset="1" stopColor="#ff9500" stopOpacity="0" /></radialGradient>
        <linearGradient id="cel-tc-f" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#ff5a1f" /><stop offset=".55" stopColor="#ff9500" /><stop offset="1" stopColor="#ffcf3f" /></linearGradient>
        <linearGradient id="cel-tc-i" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#ffd84a" /><stop offset="1" stopColor="#fff6c9" /></linearGradient>
        <linearGradient id="cel-tc-h" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#a8643a" /><stop offset="1" stopColor="#6b3a1e" /></linearGradient>
      </defs>
      <circle cx="32" cy="20" r="18" fill="url(#cel-tc-g)" />
      <path d="M32 2 C35 10 44 13 43 23 C42.5 30 37.5 34 32 34 C26.5 34 21.5 30 21 23 C20.5 17 25 14 26 9 C28 13 29 15 30.5 16 C31 11 30 6 32 2 Z" fill="url(#cel-tc-f)" />
      <path d="M32 14 C34 19 38 21 37.5 26 C37 30 35 32 32 32 C29 32 27 30 26.5 26.5 C26.3 23.5 28.5 22 29.5 19 C30.5 21 31 22 32 22.5 C32.5 20 31.5 17 32 14 Z" fill="url(#cel-tc-i)" />
      <path d="M20 33 H44 L41 40 H23 Z" fill="#00877c" />
      <rect x="21" y="31" width="22" height="4" rx="2" fill="#0a5e57" />
      <path d="M26 40 H38 L34.5 62 H29.5 Z" fill="url(#cel-tc-h)" />
      <rect x="26.5" y="46" width="11" height="3" rx="1" fill="#0a5e57" opacity=".7" />
      <circle cx="47" cy="10" r="1.6" fill="#ffcf3f" />
      <circle cx="16" cy="14" r="1.2" fill="#ff9500" />
    </svg>
  );
}

// Тоо 0-ээс өсөж гарна
function CountUp({ to, ms = 900 }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf, t0;
    const step = (t) => {
      t0 ??= t;
      const k = Math.min(1, (t - t0) / ms);
      setV(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return n(v);
}

export default function Celebrate() {
  const [d, setD] = useState(null);
  const [copied, setCopied] = useState(false);
  const [grow, setGrow] = useState(false);

  useEffect(() => {
    const check = () => {
      if (!document.cookie.includes(COOKIE + "=")) return;
      const x = readCookie();
      if (x) { setCopied(false); setGrow(false); setD(x); }
    };
    check();
    const t = setInterval(check, 700);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!d) return;
    const esc = (e) => e.key === "Escape" && setD(null);
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    const g = setTimeout(() => setGrow(true), 350);
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = ""; clearTimeout(g); };
  }, [d]);

  if (!d) return null;
  const kind = KIND[d.k] || { ic: "✦", c: "#00a89b" };
  const close = () => setD(null);
  const span = d.nx ? d.nx.min - d.lv.min : 1;
  const pctAfter = d.nx ? Math.min(100, ((d.p - d.lv.min) / span) * 100) : 100;
  const pctBefore = d.nx && !d.up ? Math.max(0, Math.min(100, ((d.p - d.g - d.lv.min) / span) * 100)) : 0;
  const share = async () => {
    try { await navigator.clipboard.writeText(new URL(d.h, window.location.origin).href); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch (e) {}
  };

  return createPortal(
    <div className="tm-overlay cel-ov" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className={"cel" + (d.k === "Профайл" ? " tall" : "")} role="dialog" aria-modal="true" aria-labelledby="cel-h" style={{ "--k": kind.c }}>
        <div className="cel-hero">
          <span className="cel-rays" aria-hidden="true" />
          <span className="cel-confetti" aria-hidden="true">
            {BITS.map((b, i) => <i key={i} style={{ "--c": b.c, "--x": `${b.x}%`, "--d": `${b.d}s`, "--s": `${b.s}px`, "--r": `${b.r}deg` }} />)}
          </span>
          <button type="button" className="tm-x cel-x" onClick={close} aria-label="Хаах">×</button>
          {d.k === "Профайл" ? <StarBadge /> : <span className="cel-badge"><span>{kind.art ? <kind.art /> : kind.ic}</span></span>}
          <small className="cel-kicker">Баяр хүргэе!</small>
          <b id="cel-h">{head(d)}</b>
          {d.t && <em className="cel-title">«{d.t}»</em>}
          <p>{WHY[d.k] || "Шинжлэх ухааныг хамтдаа асааж байгаад баярлалаа!"}</p>
        </div>

        <div className="cel-body">
          {d.e?.length > 0 && (
            <div className="cel-earn">
              {d.e.map(([label, v]) => (
                <div key={label} className="cel-chip got">
                  <span className="cel-spark">✦</span>
                  <span><b>+<CountUp to={v} /> оч</b><small>{label}</small></span>
                </div>
              ))}
            </div>
          )}
          {d.l?.length > 0 && (
            <div className="cel-later">
              <span className="cel-lt">{d.s === "pending" || d.s === "discussion" ? "Батлагдвал хүлээж буй оч" : "Цааш олох оч"}</span>
              <div>
                {d.l.map(([label, v]) => (
                  <span key={label} className="cel-chip"><b>+{n(v)}</b><small>{label}</small></span>
                ))}
              </div>
            </div>
          )}

          <div className={"cel-lv" + (d.up ? " up" : "")}>
            <div className="cel-lv-row">
              <b style={{ color: d.lv.c }}>{d.up ? `🎉 Түвшин ахилаа: ${d.lv.name}!` : d.lv.n ? `Түвшин ${d.lv.n} · ${d.lv.name}` : "Шинэ гишүүн"}</b>
              <span>✦ {d.g ? <CountUp to={d.p} ms={1200} /> : n(d.p)}{d.nx ? ` / ${n(d.nx.min)}` : ""}</span>
            </div>
            <span className="cel-bar">
              <span className="cel-bar-old" style={{ width: `${pctBefore}%` }} />
              <span className="cel-bar-new" style={{ width: `${grow ? pctAfter : pctBefore}%`, backgroundColor: d.lv.n ? d.lv.c : undefined }} />
            </span>
            {d.up && d.lv.perk && <span className="cel-perk">🔓 Шинэ эрх нээгдлээ: <b>{d.lv.perk}</b></span>}
            <small>{d.nx ? `Дараагийн түвшин хүртэл ${n(d.nx.min - d.p)} оч үлдлээ. Үйлдэл бүхэн тань таныг улам тод асаана.` : "Та хамгийн дээд түвшинд хүрсэн байна ✦"}</small>
          </div>

          <div className="cel-foot">
            <button type="button" className="cel-go" onClick={close}>Үргэлжлүүлэх</button>
            {d.h && d.s !== "pending" && (
              <button type="button" className={"cel-share" + (copied ? " ok" : "")} onClick={share}>{copied ? "✓ Холбоос хуулагдлаа" : d.k === "Профайл" ? "🔗 Найзаа урих" : "🔗 Найздаа хуваалцах"}</button>
            )}
            {d.k !== "Профайл" && <Link href="/och" className="cel-rules" onClick={close}>Оч олох дүрэм →</Link>}
          </div>

          {d.k === "Профайл" && <ReferralAsk />}
        </div>
      </div>
    </div>,
    document.body
  );
}
