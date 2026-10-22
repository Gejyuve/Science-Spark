// Клубийн лого бүтээгчийн дүрс, өнгө, загвар (24×24 сүлжээн дээрх зураасан дүрсүүд)

const teeth = Array.from({ length: 8 }, (_, i) => {
  const a = (i * Math.PI) / 4, c = Math.cos(a), s = Math.sin(a);
  const f = (r) => `${(12 + r * c).toFixed(2)} ${(12 + r * s).toFixed(2)}`;
  return `M${f(6.5)}L${f(9.5)}`;
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
];

// [фон 1, фон 2, дүрс/үсэг]
export const PALETTES = [
  ["#00a89b", "#37c3b3", "#ffffff"],
  ["#1e63c7", "#5b8def", "#ffffff"],
  ["#6a3fd0", "#8e6cef", "#ffffff"],
  ["#d9467a", "#ef6c9c", "#ffffff"],
  ["#c62f3a", "#ef6c4c", "#ffffff"],
  ["#e58a00", "#f7b733", "#ffffff"],
  ["#1f7a4a", "#3fae6a", "#ffffff"],
  ["#12232e", "#2a4a5e", "#7ff0e3"],
  ["#0f2a4a", "#1d4f7a", "#f7c948"],
  ["#1a1033", "#3b2a7a", "#ffd36e"],
  ["#e6f7f5", "#ffffff", "#00897e"],
  ["#fff4e0", "#ffffff", "#c2410c"],
];

export const STYLES = [
  { key: "flat", label: "Энгийн" },
  { key: "grad", label: "Градиент" },
  { key: "ring", label: "Хүрээтэй" },
  { key: "stars", label: "Одтой" },
];

export const LAYOUTS = [
  { key: "both", label: "Дүрс + үсэг" },
  { key: "icon", label: "Зөвхөн дүрс" },
  { key: "text", label: "Зөвхөн үсэг" },
];

export const TEXT_MAX = 4;

// Клубийн нэрийн эхний үсгүүд: «Сансрын судлаачид» → «СС»
export function initials(name) {
  const w = String(name || "").replace(/[«»"'.,!?()-]/g, " ").trim().split(/\s+/).filter(Boolean);
  if (!w.length) return "";
  const s = w.length === 1 ? w[0].slice(0, 2) : w.slice(0, 3).map((x) => x[0]).join("");
  return s.toLocaleUpperCase("mn");
}

const SPARKS = [[96, 120, 9], [410, 98, 6], [440, 300, 8], [70, 330, 6], [150, 440, 5], [372, 430, 7], [250, 58, 4]];
const sparkle = ([x, y, r]) => `<path d="M${x} ${y - r * 2}Q${x} ${y} ${x + r * 2} ${y}Q${x} ${y} ${x} ${y + r * 2}Q${x} ${y} ${x - r * 2} ${y}Q${x} ${y} ${x} ${y - r * 2}z"/>`;

// Үсгийн хэмжээ ба байрлал (512×512 зураг дээр)
export function textBox(o) {
  const n = Math.max(1, [...o.text].length);
  if (o.layout === "text") return { size: [230, 190, 150, 118][n - 1], y: 256 };
  return { size: [104, 96, 82, 68][n - 1], y: 392 };
}

// 512×512 SVG. withText=false үед үсгийг canvas дээр тусад нь (сайтын фонтоор) зурна.
// uid: нэг хуудсанд олон лого байхад градиентийн id давхцахгүй байх
export function logoSvg(o, { withText = true, font = "sans-serif", uid = "g" } = {}) {
  const [c1, c2, fg] = PALETTES[o.palette] || PALETTES[0];
  const sym = SYMBOLS.find((s) => s.key === o.symbol) || SYMBOLS[0];
  const fill = o.style === "flat" ? c1 : `url(#${uid})`;
  const hasText = o.layout !== "icon" && o.text;
  const icon = o.layout === "text" ? "" : hasText
    ? `<g transform="translate(166 92) scale(7.5)">${sym.svg}</g>`
    : `<g transform="translate(106 106) scale(12.5)">${sym.svg}</g>`;
  const t = textBox(o);
  const text = hasText && withText
    ? `<text x="256" y="${t.y}" font-family="${font.replace(/"/g, "'")}" font-weight="800" font-size="${t.size}" fill="${fg}" text-anchor="middle" dominant-baseline="central" letter-spacing="2">${esc(o.text)}</text>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<defs><linearGradient id="${uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
<rect width="512" height="512" fill="${fill}"/>
${o.style === "ring" ? `<circle cx="256" cy="256" r="226" fill="none" stroke="${fg}" stroke-width="12" opacity=".9"/><circle cx="256" cy="256" r="204" fill="none" stroke="${fg}" stroke-width="3" opacity=".55"/>` : ""}
${o.style === "stars" ? `<g fill="${fg}" opacity=".7">${SPARKS.map(sparkle).join("")}</g>` : ""}
<g fill="none" stroke="${fg}" color="${fg}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${icon}</g>
${text}
</svg>`;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
