// Клубийн лого бүтээгчийн дүрс, өнгө, загвар (24×24 сүлжээн дээрх зураасан дүрсүүд)

const teeth = Array.from({ length: 8 }, (_, i) => {
  const a = (i * Math.PI) / 4, c = Math.cos(a), s = Math.sin(a);
  const f = (r) => `${(12 + r * c).toFixed(2)} ${(12 + r * s).toFixed(2)}`;
  return `M${f(6.5)}L${f(9.5)}`;
}).join("");

const rays = (n, r1, r2, off = 0) => Array.from({ length: n }, (_, i) => {
  const a = off + (i * 2 * Math.PI) / n, c = Math.cos(a), s = Math.sin(a);
  return `M${(12 + r1 * c).toFixed(2)} ${(12 + r1 * s).toFixed(2)}L${(12 + r2 * c).toFixed(2)} ${(12 + r2 * s).toFixed(2)}`;
}).join("");
const flake = Array.from({ length: 6 }, (_, i) => {
  const a = (i * Math.PI) / 3, p = (r, d) => `${(12 + r * Math.cos(a + d)).toFixed(2)} ${(12 + r * Math.sin(a + d)).toFixed(2)}`;
  return `M12 12L${p(9.5, 0)}M${p(6.5, 0)}L${p(8.6, 0.32)}M${p(6.5, 0)}L${p(8.6, -0.32)}`;
}).join("");

export const SYMBOLS = [
  { key: "atom", label: "Атом", svg: '<circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><ellipse cx="12" cy="12" rx="10" ry="4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)"/>' },
  { key: "rocket", label: "Пуужин", svg: '<path d="M12 2c3 2.2 5 6 5 10l-1.6 4.5H8.6L7 12c0-4 2-7.8 5-10z"/><circle cx="12" cy="10" r="2"/><path d="M7.3 13.5 4.5 17l3.3.8M16.7 13.5l2.8 3.5-3.3.8M10.5 19.5 12 22l1.5-2.5"/>' },
  { key: "planet", label: "Гариг", svg: '<circle cx="12" cy="12" r="5.5"/><ellipse cx="12" cy="12" rx="10.5" ry="3.2" transform="rotate(-20 12 12)"/>' },
  { key: "dna", label: "ДНХ", svg: '<path d="M7 2c0 5 10 5 10 10S7 17 7 22M17 2c0 5-10 5-10 10s10 5 10 10M8.6 5.2h6.8M8.6 18.8h6.8M10.2 9.4h3.6M10.2 14.6h3.6"/>' },
  { key: "telescope", label: "Дуран", svg: '<path d="M3.5 12.8 15.7 7.2l1.9 4.1-12.2 5.6z"/><path d="m17.6 7.4 2.9-1.3 1.2 2.6-2.9 1.3M10.6 14.6 7.8 22M10.6 14.6l3 7.4"/>' },
  { key: "microscope", label: "Микроскоп", svg: '<path d="M5 21h14M9 21a7 7 0 0 1 7.5-7M9.5 3.5l3-1 3 8-3 1z"/><path d="M13.5 11.5 15 15M7 17h5"/>' },
  { key: "flask", label: "Колба", svg: '<path d="M9 2.5h6M10 2.5V8.5L4.6 18.2A2 2 0 0 0 6.3 21h11.4a2 2 0 0 0 1.7-2.8L14 8.5V2.5M7 15h10"/><circle cx="10.5" cy="17.8" r=".6" fill="currentColor"/><circle cx="13.8" cy="18.4" r=".6" fill="currentColor"/>' },
  { key: "brain", label: "Тархи", svg: '<path d="M12 4.5a3 3 0 0 0-5.2 1.7 3 3 0 0 0-2.3 4.6 3 3 0 0 0 .8 4.9 3 3 0 0 0 4.2 3.4A2.8 2.8 0 0 0 12 20zM12 4.5a3 3 0 0 1 5.2 1.7 3 3 0 0 1 2.3 4.6 3 3 0 0 1-.8 4.9 3 3 0 0 1-4.2 3.4A2.8 2.8 0 0 1 12 20M12 4.5V20M8.5 10a2.5 2.5 0 0 1 3.5 0M15.5 14a2.5 2.5 0 0 1-3.5 0"/>' },
  { key: "bulb", label: "Санаа", svg: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z"/>' },
  { key: "sprout", label: "Ургамал", svg: '<path d="M12 21v-9M12 12c0-4-3-6.5-7-6.5 0 4 3 6.5 7 6.5zM12 10c0-3.2 2.6-5.5 6.5-5.5 0 3.6-2.6 5.5-6.5 5.5zM8 21h8"/>' },
  { key: "globe", label: "Дэлхий", svg: '<circle cx="12" cy="12" r="9.5"/><ellipse cx="12" cy="12" rx="4" ry="9.5"/><path d="M2.5 12h19M4 7h16M4 17h16"/>' },
  { key: "star", label: "Од", svg: '<path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z"/>' },
  { key: "moon", label: "Сар", svg: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/><path d="M17 3.5v3M15.5 5h3"/>' },
  { key: "bolt", label: "Цахилгаан", svg: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>' },
  { key: "magnet", label: "Соронз", svg: '<path d="M5.5 3v9a6.5 6.5 0 0 0 13 0V3h-4v9a2.5 2.5 0 0 1-5 0V3zM5.5 7h4M14.5 7h4"/>' },
  { key: "gear", label: "Техник", svg: `<circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="2.5"/><path d="${teeth}" stroke-width="2.6"/>` },
  { key: "robot", label: "Робот", svg: '<rect x="4.5" y="8" width="15" height="11.5" rx="2.5"/><path d="M12 8V4.5M2.5 12.5v3M21.5 12.5v3M10 16h4"/><circle cx="12" cy="3.8" r="1"/><circle cx="9" cy="12.5" r="1.1" fill="currentColor"/><circle cx="15" cy="12.5" r="1.1" fill="currentColor"/>' },
  { key: "code", label: "Код", svg: '<path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>' },
  { key: "pi", label: "Пи", svg: '<path d="M4 7.5c1-1.5 2.5-2 4-2h12M9.5 5.5V19M15.5 5.5v11a2.3 2.3 0 0 0 4 1.5"/>' },
  { key: "sigma", label: "Сигма", svg: '<path d="M18 4H6l6 8-6 8h12"/>' },
  { key: "benzene", label: "Хими", svg: '<path d="m12 2.5 8.2 4.75v9.5L12 21.5l-8.2-4.75v-9.5z"/><circle cx="12" cy="12" r="4"/>' },
  { key: "mountain", label: "Геологи", svg: '<path d="M2 20 9 7.5l4 6.5 3-4.5 6 10.5z"/><path d="m7.3 10.5 1.7 1.3 1.6-1.2"/>' },
  { key: "pulse", label: "Анагаах", svg: '<path d="M2.5 12H7l2-5 4 10 2-5h6.5"/>' },
  { key: "wave", label: "Долгион", svg: '<path d="M2 12c2.5-6.5 5-6.5 7.5 0s5 6.5 7.5 0c1.2-3 2.6-4 5-3.8"/>' },
  { key: "satellite", label: "Хиймэл дагуул", svg: '<path d="M3 7 7 3l3 3-4 4zM14 18l4-4 3 3-4 4zM9.5 12 12 9.5l2.5 2.5-2.5 2.5zM8 8l1.8 1.8M14.2 14.2 16 16M15 6.5a2.5 2.5 0 0 1 2.5 2.5M15 3.5A5.5 5.5 0 0 1 20.5 9"/>' },
  { key: "comet", label: "Сүүлт од", svg: '<circle cx="16" cy="8" r="3.5"/><path d="M13.5 10.5 3 21M12.6 7.4 5 12M16.6 11.4 12 19"/>' },
  { key: "sun", label: "Нар", svg: `<circle cx="12" cy="12" r="4.2"/><path d="${rays(8, 6.8, 9.8)}"/>` },
  { key: "cloud", label: "Цаг агаар", svg: '<path d="M7 18h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 18z"/><path d="M9 21l1-1.5M13 21l1-1.5"/>' },
  { key: "drop", label: "Ус", svg: '<path d="M12 2.5s6.5 7 6.5 11.5a6.5 6.5 0 0 1-13 0C5.5 9.5 12 2.5 12 2.5z"/><path d="M9 14.5a3 3 0 0 0 3 3"/>' },
  { key: "flame", label: "Гал", svg: '<path d="M12 2.5c1 3.5 5.5 5.5 5.5 11a5.5 5.5 0 0 1-11 0c0-3 1.5-4.5 2.5-5.5.3 2 1.2 3 2.3 3.3C10.5 8.5 11 5 12 2.5z"/>' },
  { key: "snow", label: "Цас", svg: `<path d="${flake}"/>` },
  { key: "thermo", label: "Хэм", svg: '<path d="M10 14.5V4.5a2 2 0 0 1 4 0v10a4 4 0 1 1-4 0z"/><path d="M12 16V8M16.5 5h2M16.5 8.5h2"/>' },
  { key: "compass", label: "Луужин", svg: '<circle cx="12" cy="12" r="9.5"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>' },
  { key: "geometry", label: "Геометр", svg: '<path d="M3 20.5h18L12 4z"/><circle cx="12" cy="15" r="3"/>' },
  { key: "infinity", label: "Хязгааргүй", svg: '<path d="M12 12c-2-2.7-3.5-4-5.5-4a4 4 0 0 0 0 8c2 0 3.5-1.3 5.5-4s3.5-4 5.5-4a4 4 0 0 1 0 8c-2 0-3.5-1.3-5.5-4z"/>' },
  { key: "sqrt", label: "Язгуур", svg: '<path d="M2.5 13.5 5 12l3.5 8L13 4h8.5M14.5 10l5 6M19.5 10l-5 6"/>' },
  { key: "cube", label: "Шоо", svg: '<path d="m12 2.5 8.5 4.75v9.5L12 21.5l-8.5-4.75v-9.5z"/><path d="M3.5 7.25 12 12l8.5-4.75M12 12v9.5"/>' },
  { key: "book", label: "Ном", svg: '<path d="M12 6.5C10 5 7 4.5 3 4.5v14c4 0 7 .5 9 2 2-1.5 5-2 9-2v-14c-4 0-7 .5-9 2zM12 6.5v14"/>' },
  { key: "cap", label: "Боловсрол", svg: '<path d="M2 9.5 12 5l10 4.5-10 4.5z"/><path d="M6 11.3V16c3.5 2.5 8.5 2.5 12 0v-4.7M22 9.5v5"/>' },
  { key: "tube", label: "Туршилт", svg: '<path d="M8.5 3h7M14.5 3v13a2.5 2.5 0 0 1-5 0V3M9.5 11h5"/>' },
  { key: "search", label: "Судалгаа", svg: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5.5 5.5M7.5 10.5a3 3 0 0 1 3-3"/>' },
  { key: "paw", label: "Амьтан", svg: '<ellipse cx="6.5" cy="10" rx="1.8" ry="2.4"/><ellipse cx="10" cy="6" rx="1.8" ry="2.4"/><ellipse cx="14.5" cy="6" rx="1.8" ry="2.4"/><ellipse cx="18" cy="10" rx="1.8" ry="2.4"/><path d="M7.5 18c0-3 2.3-6.5 4.8-6.5s4.7 3.5 4.7 6.5c0 2-1.5 3-3 2.6-.9-.2-1.2-.6-1.7-.6s-1 .4-1.9.6c-1.5.4-2.9-.6-2.9-2.6z"/>' },
  { key: "butterfly", label: "Эрвээхэй", svg: '<path d="M12 7v13M12 10C10 5 4 3 3.5 6.5S6 12 9 12.5C6 13 5 17 7.5 18.5S11.5 16 12 13.5M12 10c2-5 8-7 8.5-3.5S18 12 15 12.5c3 .5 4 4.5 1.5 6S12.5 16 12 13.5M10 4l2 3 2-3"/>' },
  { key: "tree", label: "Мод", svg: '<path d="M12 21v-7M9 21h6"/><path d="M12 2.5a5 5 0 0 0-5 5A4.5 4.5 0 0 0 7.5 16h9a4.5 4.5 0 0 0 .5-8.5 5 5 0 0 0-5-5z"/>' },
  { key: "heart", label: "Зүрх", svg: '<path d="M12 20s-8.5-5-8.5-11A4.5 4.5 0 0 1 12 6.5 4.5 4.5 0 0 1 20.5 9c0 6-8.5 11-8.5 11z"/>' },
  { key: "pill", label: "Эм", svg: '<rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(-45 12 12)"/><path d="m8.6 8.6 6.8 6.8"/>' },
  { key: "chip", label: "Чип", svg: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5"/><path d="M9 2.5V6M15 2.5V6M9 18v3.5M15 18v3.5M2.5 9H6M2.5 15H6M18 9h3.5M18 15h3.5"/>' },
  { key: "antenna", label: "Радио", svg: '<circle cx="12" cy="10" r="1.6" fill="currentColor"/><path d="M12 11.5 8.5 21.5M12 11.5l3.5 10M9.5 18h5M8.5 6.5a5 5 0 0 0 0 7M15.5 6.5a5 5 0 0 1 0 7M5.5 3.8a9 9 0 0 0 0 12.4M18.5 3.8a9 9 0 0 1 0 12.4"/>' },
  { key: "volcano", label: "Галт уул", svg: '<path d="M2.5 21h19l-6-11h-7z"/><path d="M8.5 10c1 1 2 1 3.5 0s2.5-1 3.5 0M12 7V3M9 5 7.5 3M15 5l1.5-2"/>' },
  { key: "feather", label: "Өд", svg: '<path d="M20.5 3.5c-8 0-14 5-14 13.5h4.5c6 0 9.5-6 9.5-13.5zM3.5 20.5 13 11"/>' },
];

// [фон 1, фон 2, дүрс/текст]
export const PALETTES = [
  ["#00a89b", "#37c3b3", "#ffffff"],
  ["#0b7285", "#15aabf", "#ffffff"],
  ["#1e63c7", "#5b8def", "#ffffff"],
  ["#6a3fd0", "#8e6cef", "#ffffff"],
  ["#5f3dc4", "#d6336c", "#ffffff"],
  ["#d9467a", "#ef6c9c", "#ffffff"],
  ["#c62f3a", "#ef6c4c", "#ffffff"],
  ["#7a1f2b", "#b23a48", "#f7d9a8"],
  ["#e8590c", "#fab005", "#ffffff"],
  ["#e58a00", "#f7b733", "#ffffff"],
  ["#1f7a4a", "#3fae6a", "#ffffff"],
  ["#2b8a3e", "#94d82d", "#ffffff"],
  ["#12232e", "#2a4a5e", "#7ff0e3"],
  ["#0f2a4a", "#1d4f7a", "#f7c948"],
  ["#1a1033", "#3b2a7a", "#ffd36e"],
  ["#111417", "#2b3036", "#ffffff"],
  ["#495057", "#868e96", "#ffffff"],
  ["#e6f7f5", "#ffffff", "#00897e"],
  ["#fff4e0", "#ffffff", "#c2410c"],
  ["#ffffff", "#eef1f4", "#12232e"],
];

export const STYLES = [
  { key: "flat", label: "Энгийн" },
  { key: "grad", label: "Градиент" },
  { key: "ring", label: "Хүрээтэй" },
  { key: "stars", label: "Одтой" },
];

export const LAYOUTS = [
  { key: "both", label: "Дүрс + текст" },
  { key: "icon", label: "Зөвхөн дүрс" },
  { key: "text", label: "Зөвхөн текст" },
];

export const TEXT_MAX = 10;
export const RING_MAX = 28;
export const RING_BOTTOM_MAX = 16;

// Клубийн нэрийн эхний үсгүүд: «Сансрын судлаачид» → «СС»
export function initials(name) {
  const w = String(name || "").replace(/[«»"'.,!?()-]/g, " ").trim().split(/\s+/).filter(Boolean);
  if (!w.length) return "";
  const s = w.length === 1 ? w[0].slice(0, 2) : w.slice(0, 3).map((x) => x[0]).join("");
  return s.toLocaleUpperCase("mn");
}

const SPARKS = [[96, 120, 9], [410, 98, 6], [440, 300, 8], [70, 330, 6], [150, 440, 5], [372, 430, 7], [250, 58, 4]];
const sparkle = ([x, y, r]) => `<path d="M${x} ${y - r * 2}Q${x} ${y} ${x + r * 2} ${y}Q${x} ${y} ${x} ${y + r * 2}Q${x} ${y} ${x - r * 2} ${y}Q${x} ${y} ${x} ${y - r * 2}z"/>`;

const hasRing = (o) => !!(o.ring || "").trim() || !!(o.ringBottom || "").trim();
// Тойрог текст байвал голын хэсгийг жижигрүүлнэ
export const innerScale = (o) => (hasRing(o) ? 0.66 : 1);

// Голын текстийн хэмжээ ба байрлал (512×512 дээр, жижигрүүлэхээс өмнө)
export function textBox(o) {
  const n = Math.max(1, [...(o.text || "")].length);
  if (o.layout === "text") return { size: Math.round(Math.min(230, 420 / (0.66 * n))), y: 256, max: 430 };
  return { size: Math.round(Math.min(104, 360 / (0.66 * n))), y: 392, max: 360 };
}

// Ар тал, чимэглэл, дүрс (текстгүй) — 512×512 SVG. Текстийг canvas дээр сайтын фонтоор зурна.
export function logoSvg(o) {
  const [c1, c2, fg] = PALETTES[o.palette] || PALETTES[0];
  const sym = SYMBOLS.find((s) => s.key === o.symbol) || SYMBOLS[0];
  const fill = o.style === "flat" ? c1 : "url(#g)";
  const hasText = o.layout !== "icon" && o.text;
  const icon = o.layout === "text" ? "" : hasText
    ? `<g transform="translate(166 92) scale(7.5)">${sym.svg}</g>`
    : `<g transform="translate(106 106) scale(12.5)">${sym.svg}</g>`;
  const ring = hasRing(o);
  const k = innerScale(o);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
<rect width="512" height="512" fill="${fill}"/>
${ring ? `<circle cx="256" cy="256" r="236" fill="none" stroke="${fg}" stroke-width="8" opacity=".9"/><circle cx="256" cy="256" r="172" fill="none" stroke="${fg}" stroke-width="4" opacity=".75"/>` : ""}
<g transform="translate(256 256) scale(${k}) translate(-256 -256)">
${o.style === "ring" ? `<circle cx="256" cy="256" r="226" fill="none" stroke="${fg}" stroke-width="12" opacity=".9"/><circle cx="256" cy="256" r="204" fill="none" stroke="${fg}" stroke-width="3" opacity=".55"/>` : ""}
${o.style === "stars" ? `<g fill="${fg}" opacity=".7">${SPARKS.map(sparkle).join("")}</g>` : ""}
<g fill="none" stroke="${fg}" color="${fg}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${icon}</g>
</g>
</svg>`;
}

// Тойргийн дагуу текст: top=true бол дээд нумаар, үгүй бол доод нумаар зүүнээс баруун тийш
function arcText(ctx, str, { r, top, font, maxAngle }) {
  const chars = [...str];
  let size = 40;
  const widths = () => chars.map((c) => ctx.measureText(c).width + size * 0.12);
  ctx.font = `800 ${size}px ${font}`;
  let w = widths(), total = w.reduce((a, b) => a + b, 0);
  while (total / r > maxAngle && size > 18) { size -= 2; ctx.font = `800 ${size}px ${font}`; w = widths(); total = w.reduce((a, b) => a + b, 0); }
  let acc = 0;
  chars.forEach((c, i) => {
    const mid = (acc + w[i] / 2) / r;
    const a = top ? -Math.PI / 2 - total / r / 2 + mid : Math.PI / 2 + total / r / 2 - mid;
    ctx.save();
    ctx.translate(256 + r * Math.cos(a), 256 + r * Math.sin(a));
    ctx.rotate(top ? a + Math.PI / 2 : a - Math.PI / 2);
    ctx.fillText(c, 0, 0);
    ctx.restore();
    acc += w[i];
  });
}

const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Лого зурж чадсангүй")); i.src = src; });

// Лого бүхэлд нь 512×512 canvas дээр зурна (урьдчилан харах болон хадгалахад нэг ижил)
export async function drawLogo(o, font = "sans-serif") {
  const img = await loadImg(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(logoSvg(o))}`);
  const cv = document.createElement("canvas");
  cv.width = 512; cv.height = 512;
  const ctx = cv.getContext("2d");
  ctx.drawImage(img, 0, 0, 512, 512);
  const fg = (PALETTES[o.palette] || PALETTES[0])[2];
  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const text = (o.text || "").trim();
  if (o.layout !== "icon" && text) {
    const t = textBox({ ...o, text });
    const k = innerScale(o);
    ctx.save();
    ctx.translate(256, 256); ctx.scale(k, k); ctx.translate(-256, -256);
    ctx.font = `800 ${t.size}px ${font}`;
    ctx.fillText(text, 256, t.y, t.max);
    ctx.restore();
  }
  const top = (o.ring || "").trim(), bottom = (o.ringBottom || "").trim();
  if (top) arcText(ctx, top, { r: 204, top: true, font, maxAngle: bottom ? Math.PI * 0.95 : Math.PI * 1.6 });
  if (bottom) arcText(ctx, bottom, { r: 204, top: false, font, maxAngle: Math.PI * 0.7 });
  if (top && bottom) {
    // Дээд, доод текстийг тусгаарлах хоёр жижиг цэг
    for (const x of [256 - 204, 256 + 204]) { ctx.beginPath(); ctx.arc(x, 256, 7, 0, Math.PI * 2); ctx.fill(); }
  }
  return cv;
}
