// Түвшин (Figma: Очны дүрэм · 598:477). Түвшин зөвхөн хөдөлмөрөөр олсон очоор ахина.
// perkLocked: түвшинд хүрч болох ч нэмэлт эрх нь одоохондоо нээгдээгүй.
// mult: шагналын сангийн жин (туршлагатай бичээч бага хөдөлмөрөөр илүүг олно), daily: өдөрт өгөх очны тоо
export const LEVELS = [
  { n: 0, name: "Шинэ", tagline: "Түвшин байхгүй", min: 0, perk: null, mult: 0, daily: 5, color: "#879dab" },
  { n: 1, name: "Лаа", tagline: "Асаж эхэлсэн", min: 500, perk: "Нийтлэл бичих · шагналын санд оролцох", mult: 1.0, daily: 10, color: "#ff9500" },
  { n: 2, name: "Түймэр", tagline: "Дүрэлзэн дэгдэх", min: 2000, perk: "Мэдээ бичих", mult: 1.1, daily: 10, color: "#e5243b" },
  { n: 3, name: "Плазм", tagline: "Цахилгаанжих", min: 4000, perk: "Өдөрт 15 оч өгөх", mult: 1.2, daily: 15, color: "#9b3df0" },
  { n: 4, name: "Фузион", tagline: "Нэгтгэгч хүч", min: 10000, perk: "Шагналын жин ×1.3", mult: 1.3, daily: 15, color: "#0a84ff" },
  { n: 5, name: "Од", tagline: "Алсаас гэрэлтэх", min: 30000, perk: "Шинэ үг зөвшөөрөх", mult: 1.5, daily: 20, color: "#f5a700" },
  { n: 6, name: "Супернова", tagline: "Галактикт цуурайтах", min: 100000, perk: null, perkLocked: true, mult: 1.7, daily: 20, color: "#c13bff" },
  { n: 7, name: "Хар нүх", tagline: "Бүхнийг татагч", min: 250000, perk: null, perkLocked: true, mult: 1.7, daily: 20, color: "#4f6676" },
  { n: 8, name: "Их тэсрэлт", tagline: "Ертөнц үүсгэгч", min: 500000, perk: null, perkLocked: true, mult: 1.7, daily: 20, color: "#ff2d7a" },
  { n: 9, name: "Атом", tagline: "Материйг бүрдүүлэгч", min: 1000000, perk: null, perkLocked: true, mult: 1.7, daily: 20, color: "#16c25a" },
];

export function levelFor(points) {
  let cur = LEVELS[0];
  for (const l of LEVELS) if (points >= l.min) cur = l;
  return cur;
}
export const nextLevel = (points) => LEVELS.find((l) => l.min > points) || null;

// Түвшний эрхүүд (Очны дүрэм)
// Доорх утгуудыг супер админ Тохиргоо хэсгээс өөрчилнө (lib/settings.js setLevelRules)
export let ARTICLE_LEVEL = 1; // Нийтлэл бичих
export let NEWS_LEVEL = 2; // Мэдээ бичих
export let WORD_LEVEL = 5; // Шинэ үг зөвшөөрөх
export function setLevelRules(r) {
  ARTICLE_LEVEL = r.articleLevel;
  NEWS_LEVEL = r.newsLevel;
  WORD_LEVEL = r.wordLevel;
}
// Нийтлэл, мэдээ, эвент, зарлалыг зөвхөн редакц хянана. Хэрэглэгч түвшнээр хянах эрх авахгүй, хянаснаар оч авахгүй.
// Хуучин хянагчийн хүсэлтүүдийг админ дээр харуулахад л ашиглана.
export const REVIEWER_LEVEL = 4;

// Тухайн төрлийн контент бичих шаардлагатай түвшин
export const writeLevel = (kind) => (kind === "Мэдээ" ? NEWS_LEVEL : kind === "Нийтлэл" ? ARTICLE_LEVEL : 0);

// Очны дүрэм v2 (docs: Очны системийн шинжилгээ, 2026-10-19).
// Оч өгөх нь «энэ сайн байна» гэсэн дохио тул өгсөн хүнд оноо өгөхгүй, харин өдрийн хязгаартай.
// Оноо нь бусдын үнэлсэн үр дүнд л олгогдоно.
export const SPARK_GET_WRITING = 10; // нийтлэл, мэдээнд авсан оч
export const SPARK_GET_OTHER = 5; // асуулт, бодрол, хариулт, сэтгэгдэлд авсан оч
export const PREMIUM_SPARK_WEIGHT = 2; // премиум гишүүний оч 2 дахин
export const PREMIUM_DAILY_BONUS = 10;
export const FIRST_SPARK_REWARD = 10; // анхны очоо өгөхөд нэг удаа
export const APPROVE_REWARD = { "Нийтлэл": 100, "Мэдээ": 50 }; // редакц зөвшөөрөхөд бичээчид
export const WRITING_KINDS = ["Нийтлэл", "Мэдээ"];
