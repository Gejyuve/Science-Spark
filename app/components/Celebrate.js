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
  Нийтлэл: { ic: "📝", c: "#00a89b", noun: "Нийтлэл" },
  Мэдээ: { ic: "📰", c: "#0a84ff", noun: "Мэдээ" },
  Асуулт: { ic: "❓", c: "#9b3df0", noun: "Асуулт" },
  Бодрол: { ic: "💡", c: "#ff9500", noun: "Бодрол" },
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
          {d.k === "Профайл" ? <StarBadge /> : <span className="cel-badge"><span>{kind.ic}</span></span>}
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
            <Link href="/och" className="cel-rules" onClick={close}>Оч олох дүрэм →</Link>
          </div>

          {d.k === "Профайл" && <ReferralAsk />}
        </div>
      </div>
    </div>,
    document.body
  );
}
