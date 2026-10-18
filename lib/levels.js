// Түвшин (Figma: Очны дүрэм · 598:477). Түвшин зөвхөн хөдөлмөрөөр олсон очоор ахина.
// perkLocked: түвшинд хүрч болох ч нэмэлт эрх нь одоохондоо нээгдээгүй.
export const LEVELS = [
  { n: 0, name: "Шинэ", tagline: "Түвшин байхгүй", min: 0, perk: null, color: "#879dab" },
  { n: 1, name: "Лаа", tagline: "Асаж эхэлсэн", min: 1000, perk: "Нийтлэл бичих", color: "#ff9500" },
  { n: 2, name: "Түймэр", tagline: "Дүрэлзэн дэгдэх", min: 2000, perk: "Мэдээ бичих", color: "#e5243b" },
  { n: 3, name: "Плазм", tagline: "Цахилгаанжих", min: 4000, perk: null, perkLocked: true, color: "#9b3df0" },
  { n: 4, name: "Фузион", tagline: "Нэгтгэгч хүч", min: 10000, perk: null, perkLocked: true, color: "#0a84ff" },
  { n: 5, name: "Од", tagline: "Алсаас гэрэлтэх", min: 30000, perk: "Шинэ үг зөвшөөрөх", color: "#f5a700" },
  { n: 6, name: "Супернова", tagline: "Галактикт цуурайтах", min: 100000, perk: null, perkLocked: true, color: "#c13bff" },
  { n: 7, name: "Хар нүх", tagline: "Бүхнийг татагч", min: 250000, perk: null, perkLocked: true, color: "#4f6676" },
  { n: 8, name: "Их тэсрэлт", tagline: "Ертөнц үүсгэгч", min: 500000, perk: null, perkLocked: true, color: "#ff2d7a" },
  { n: 9, name: "Атом", tagline: "Материйг бүрдүүлэгч", min: 1000000, perk: null, perkLocked: true, color: "#16c25a" },
];

export function levelFor(points) {
  let cur = LEVELS[0];
  for (const l of LEVELS) if (points >= l.min) cur = l;
  return cur;
}
export const nextLevel = (points) => LEVELS.find((l) => l.min > points) || null;

// Түвшний эрхүүд (Очны дүрэм)
export const ARTICLE_LEVEL = 1; // Нийтлэл бичих
export const NEWS_LEVEL = 2; // Мэдээ бичих
// Нийтлэл, мэдээ, эвент, зарлалыг зөвхөн редакц хянана. Хэрэглэгч түвшнээр хянах эрх авахгүй, хянаснаар оч авахгүй.
// Хуучин хянагчийн хүсэлтүүдийг админ дээр харуулахад л ашиглана.
export const REVIEWER_LEVEL = 4;

// Тухайн төрлийн контент бичих шаардлагатай түвшин
export const writeLevel = (kind) => (kind === "Мэдээ" ? NEWS_LEVEL : kind === "Нийтлэл" ? ARTICLE_LEVEL : 0);

// Оч өгөх: өгсөн хүнд +5, контентын эзэнд +1
export const SPARK_GIVE = 5;
export const SPARK_GET = 1;
