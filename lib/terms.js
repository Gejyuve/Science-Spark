import { levelFor } from "./levels";
import { isStaff } from "./auth";

// Толь: нэр томьёо (posts.kind = 'Үг').
// Төлөв: discussion (хэлэлцэж байна) → published (батлагдсан) | rejected (буцаасан)
export const TERM_KIND = "Үг";
export const DISCUSS_DAYS = 7;
export const SUPPORT_NEEDED = 0.7; // батлагдахад 70% дэмжлэг
export const TERM_REWARD = 30; // батлагдвал нэмсэн хүнд
export const WORD_LEVEL = 5; // шинэ үг зөвшөөрөх түвшин
export const DEF_MAX = 500;
export const ALPHABET = ["А", "Б", "В", "Г", "Д", "Е", "Ж", "З", "И", "К", "Л", "М", "Н", "О", "П", "Р", "С", "Т", "У", "Ф", "Х", "Ц", "Ч", "Ш", "Э", "Ю", "Я"];

export const canApproveWords = (u) => isStaff(u) || (!!u && levelFor(u.points || 0).n >= WORD_LEVEL);

// Хэлэлцүүлгийн үлдсэн хоног (0 = дууссан)
export function daysLeft(meta, created) {
  const until = meta?.discuss_until ? new Date(meta.discuss_until) : new Date(new Date(created).getTime() + DISCUSS_DAYS * 86400000);
  return Math.max(0, Math.ceil((until.getTime() - Date.now()) / 86400000));
}

export const synonyms = (m) => (Array.isArray(m?.synonyms) ? m.synonyms : String(m?.synonyms || "").split(/[,;]/)).map((s) => String(s).trim()).filter(Boolean);
export const shortUrl = (u) => String(u || "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
export const firstLetter = (t) => {
  const c = String(t || "").trim().charAt(0).toUpperCase();
  return c === "Ё" ? "Е" : c === "Ө" ? "О" : c === "Ү" ? "У" : c;
};

// Хоёр үгийн төстэй байдал (0–1), Левенштейн зайгаар
export function similarity(a, b) {
  a = String(a || "").toLowerCase().trim();
  b = String(b || "").toLowerCase().trim();
  if (!a || !b) return 0;
  if (a === b) return 1;
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return 1 - prev[n] / Math.max(m, n);
}
