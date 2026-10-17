// Нийтлэлийн агуулгын энгийн тэмдэглэгээ (markdown-ын жижиг хэсэг). Сервер, клиент хоёуланд ажиллана.
//   # Гарчиг 1   ## Гарчиг 2   ### Гарчиг 3
//   **тод**  *налуу*  ==тодруулга==  [текст](https://холбоос)  [1] (эх сурвалжийн ишлэл)
//   > ишлэл (сүүлийн мөр "— Хэн" бол эзэн нь)      - жагсаалт      1. дугаартай жагсаалт
//   !> сонирхолтой баримт (ногоон хайрцаг; эхний мөр "!> # Гарчиг" бол гарчигтай)   ---  (зураас)
//   ![тайлбар](img:12 "Эх сурвалж|https://...")     (нийтлэл дундах зураг)
import { Fragment, createElement as h } from "react";

const INLINE = /(\*\*([^*]+?)\*\*|==([^=]+?)==|\*([^*\s][^*]*?)\*|\[([^\]]+?)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)|\[(\d{1,3})\])/;

// Мөр доторх тэмдэглэгээ → React элементүүд. text(s) нь энгийн текстэд нэмэлт боловсруулалт хийнэ (Толь гэх мэт).
export function inline(s, text = (x) => x, key = "i") {
  const out = [];
  let rest = String(s || "");
  let i = 0;
  while (rest) {
    const m = INLINE.exec(rest);
    if (!m) { out.push(h(Fragment, { key: `${key}t${i++}` }, text(rest))); break; }
    if (m.index > 0) out.push(h(Fragment, { key: `${key}t${i++}` }, text(rest.slice(0, m.index))));
    const k = `${key}m${i++}`;
    if (m[2] !== undefined) out.push(h("strong", { key: k }, inline(m[2], text, k)));
    else if (m[3] !== undefined) out.push(h("mark", { key: k, className: "md-hl" }, inline(m[3], text, k)));
    else if (m[4] !== undefined) out.push(h("em", { key: k }, inline(m[4], text, k)));
    else if (m[5] !== undefined) {
      const ext = /^https?:/i.test(m[6]);
      out.push(h("a", { key: k, href: m[6], className: "md-a", ...(ext ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {}) }, m[5]));
    } else if (m[7] !== undefined) out.push(h("sup", { key: k, className: "md-cite" }, h("a", { href: `#src-${m[7]}` }, `[${m[7]}]`)));
    rest = rest.slice(m.index + m[0].length);
  }
  return out;
}

const IMG = /^!\[([^\]]*)\]\((?:img:|\/img\/)(\d+)(?:\s+"([^"]*)")?\)\s*$/;

// Агуулгыг блокууд болгон задлах
export function parse(src) {
  const lines = String(src || "").replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let para = [];
  const flush = () => { if (para.length) { blocks.push({ t: "p", lines: para }); para = []; } };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const tr = l.trim();
    if (!tr) { flush(); continue; }
    let m;
    if ((m = /^(#{1,3})\s+(.+)$/.exec(tr))) { flush(); blocks.push({ t: "h", level: m[1].length, text: m[2] }); continue; }
    if (/^(-{3,}|\*{3,})$/.test(tr)) { flush(); blocks.push({ t: "hr" }); continue; }
    if ((m = IMG.exec(tr))) {
      flush();
      const [srcText, srcUrl] = String(m[3] || "").split("|");
      blocks.push({ t: "img", caption: m[1], id: m[2], source: (srcText || "").trim(), url: (srcUrl || "").trim() });
      continue;
    }
    if (/^>/.test(tr)) {
      flush();
      const q = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) { q.push(lines[i].replace(/^\s*>\s?/, "")); i++; }
      i--;
      let cite = null;
      if (q.length > 1 && /^(—|--|–)\s*/.test(q[q.length - 1].trim())) cite = q.pop().trim().replace(/^(—|--|–)\s*/, "");
      blocks.push({ t: "quote", lines: q.filter((x, k) => x.trim() || k < q.length - 1), cite });
      continue;
    }
    if (/^!>\s?/.test(tr)) {
      flush();
      const q = [];
      while (i < lines.length && /^\s*!>/.test(lines[i])) { q.push(lines[i].replace(/^\s*!>\s?/, "")); i++; }
      i--;
      // Эхний мөр "# Гарчиг" бол хайрцагны гарчиг болно; үгүй бол гарчиггүй
      let title = null;
      if (q.length && /^#\s+/.test(q[0].trim())) title = q.shift().trim().replace(/^#\s+/, "");
      blocks.push({ t: "note", title, lines: q });
      continue;
    }
    if (/^[-*•]\s+/.test(tr) || /^\d{1,3}[.)]\s+/.test(tr)) {
      flush();
      const ordered = /^\d/.test(tr);
      const items = [];
      while (i < lines.length && (ordered ? /^\s*\d{1,3}[.)]\s+/ : /^\s*[-*•]\s+/).test(lines[i])) {
        items.push(lines[i].replace(ordered ? /^\s*\d{1,3}[.)]\s+/ : /^\s*[-*•]\s+/, ""));
        i++;
      }
      i--;
      blocks.push({ t: ordered ? "ol" : "ul", items });
      continue;
    }
    para.push(l);
  }
  flush();
  return blocks;
}

const withBreaks = (lines, text, key) =>
  lines.flatMap((l, j) => (j ? [h("br", { key: `${key}b${j}` }), ...inline(l, text, `${key}l${j}`)] : inline(l, text, `${key}l${j}`)));

// Агуулгыг React элемент болгож харуулна
export function render(src, { text, imgUrl = (id) => `/img/${id}`, pClass = "ar-text" } = {}) {
  return parse(src).map((b, n) => {
    const key = `b${n}`;
    switch (b.t) {
      case "h": return h(`h${b.level + 1}`, { key, className: `md-h${b.level}` }, inline(b.text, text, key));
      case "hr": return h("hr", { key, className: "md-hr" });
      case "img":
        return h("figure", { key, className: "md-fig" },
          h("img", { src: imgUrl(b.id), alt: b.caption || "", loading: "lazy" }),
          (b.caption || b.source) && h("figcaption", null,
            b.caption && h("span", null, inline(b.caption, text, `${key}c`)),
            b.source && h("small", null, "Эх сурвалж: ", b.url && /^https?:\/\//.test(b.url) ? h("a", { href: b.url, target: "_blank", rel: "noopener noreferrer nofollow" }, b.source) : b.source)));
      case "quote":
        return h("blockquote", { key, className: "md-quote" }, h("p", null, withBreaks(b.lines, text, key)), b.cite && h("cite", null, "— ", inline(b.cite, text, `${key}c`)));
      case "note":
        return h("aside", { key, className: "md-note" }, b.title && h("b", null, inline(b.title, text, `${key}t`)), b.lines.length > 0 && h("p", null, withBreaks(b.lines, text, key)));
      case "ul":
      case "ol":
        return h(b.t, { key, className: "md-list" }, b.items.map((it, j) => h("li", { key: j }, inline(it, text, `${key}i${j}`))));
      default:
        return h("p", { key, className: pClass }, withBreaks(b.lines, text, key));
    }
  });
}

// Тэмдэглэгээг арилгаж цэвэр текст гаргана (товч агуулга, үгийн тоо)
export function strip(src) {
  return String(src || "")
    .replace(/^!\[([^\]]*)\]\([^)]*\)\s*$/gm, "$1")
    .replace(/^\s*(#{1,3}|>|!>|[-*•]|\d{1,3}[.)])\s+/gm, "")
    .replace(/^\s*(-{3,}|\*{3,})\s*$/gm, "")
    .replace(/\*\*([^*]+?)\*\*/g, "$1")
    .replace(/==([^=]+?)==/g, "$1")
    .replace(/\*([^*\s][^*]*?)\*/g, "$1")
    .replace(/\[([^\]]+?)\]\([^)]+\)/g, "$1")
    .replace(/\[(\d{1,3})\]/g, "")
    .replace(/[ \t]+/g, " ");
}

// Эх сурвалжийн төрөл, хэл (Figma 550:394)
export const SOURCE_TYPES = ["Ном", "Сэтгүүлийн өгүүлэл", "Вэб хуудас", "Мэдээ", "Видео", "Судалгааны тайлан", "Бусад"];
export const SOURCE_LANGS = ["Монгол", "Англи", "Орос", "Хятад", "Япон", "Герман", "Франц", "Бусад"];

// Эх сурвалжийг нэг мөр болгон бичнэ
export function formatSource(s) {
  const parts = [];
  if (s.author) parts.push(s.author);
  if (s.date) parts.push(`(${String(s.date).slice(0, 4)})`);
  return { lead: parts.join(" "), title: s.title, tail: [s.type, s.pages && `${s.pages} х.`, s.lang && s.lang !== "Монгол" ? s.lang : null].filter(Boolean).join(" · ") };
}

// Сервер талд эх сурвалжуудыг шалгаж цэвэрлэнэ
export function cleanSources(raw) {
  let arr = [];
  try { arr = JSON.parse(String(raw || "[]")); } catch (e) { arr = []; }
  if (!Array.isArray(arr)) return [];
  const t = (v, n) => String(v ?? "").trim().replace(/\s+/g, " ").slice(0, n);
  return arr.slice(0, 50).map((s) => ({
    type: SOURCE_TYPES.includes(s?.type) ? s.type : "Бусад",
    title: t(s?.title, 300),
    author: t(s?.author, 200) || null,
    date: /^\d{4}(-\d{2}(-\d{2})?)?$/.test(String(s?.date || "")) ? String(s.date) : null,
    pages: /^\d{1,5}$/.test(String(s?.pages || "")) ? String(s.pages) : null,
    lang: SOURCE_LANGS.includes(s?.lang) ? s.lang : null,
    url: /^https?:\/\/\S+$/i.test(String(s?.url || "")) ? t(s.url, 500) : null,
  })).filter((s) => s.title);
}

// Үгийн тоо (тэмдэглэгээг тооцохгүй)
export function wordCount(src) {
  const t = strip(src).replace(/https?:\/\/\S+/g, " ").trim();
  return t ? t.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length : 0;
}

// Агуулгын дүрэм: Мэдээ 200–500 үг, Нийтлэл 500-аас дээш үг; латин үсэг 30%-иас бага
export const WORD_RULES = { Мэдээ: [200, 500], Нийтлэл: [501, Infinity] };
export function bodyRule(kind, src) {
  const n = wordCount(src);
  const [min, max] = WORD_RULES[kind] || WORD_RULES.Нийтлэл;
  const t = strip(src).replace(/https?:\/\/\S+/gi, "");
  const latin = (t.match(/[A-Za-z]/g) || []).length;
  const cyr = (t.match(/[А-Яа-яЁёӨөҮү]/g) || []).length;
  if (latin + cyr > 0 && latin / (latin + cyr) > 0.3) return { n, error: "Кириллээр бичнэ үү." };
  if (n < min) return { n, error: kind === "Мэдээ" ? `Мэдээ ${min}–${max} үгтэй байна. Одоо ${n} үг.` : `Нийтлэл 500-аас дээш үгтэй байна. Одоо ${n} үг.` };
  if (n > max) return { n, error: `Мэдээ ${max} үгээс хэтрэхгүй. Одоо ${n} үг. Урт бол «Нийтлэл» төрлөөр илгээнэ үү.` };
  return { n, error: null };
}
