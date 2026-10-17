// Түвшин (Figma: Очны дүрэм · 598:477). Түвшин зөвхөн хөдөлмөрөөр олсон очоор ахина.
// perkLocked: түвшинд хүрч болох ч нэмэлт эрх нь одоохондоо нээгдээгүй.
export const LEVELS = [
  { n: 0, name: "Шинэ", tagline: "Түвшин байхгүй", min: 0, perk: null, color: "#879dab" },
  { n: 1, name: "Лаа", tagline: "Асаж эхэлсэн", min: 1000, perk: "Нийтлэл бичих", color: "#f59e0b" },
  { n: 2, name: "Түймэр", tagline: "Дүрэлзэн дэгдэх", min: 2000, perk: "Мэдээ бичих", color: "#e5484d" },
  { n: 3, name: "Плазм", tagline: "Цахилгаан оч цацрах", min: 4000, perk: "Эвент, зарлал зөвшөөрөх", note: "+500 оч · асуудалтай бол −5,000 оч", color: "#8e6cef" },
  { n: 4, name: "Фузион", tagline: "Нэгтгэгч хүч", min: 10000, perk: "Нийтлэл хянах", note: "+2,000 оч · хэтэрхий алдаатай бол −10,000 оч", color: "#2f7be0" },
  { n: 5, name: "Од", tagline: "Алсаас гэрэлтэх", min: 30000, perk: "Шинэ үг зөвшөөрөх", color: "#f5b400" },
  { n: 6, name: "Супернова", tagline: "Галактикт цуурайтах", min: 100000, perk: null, perkLocked: true, color: "#c084fc" },
  { n: 7, name: "Хар нүх", tagline: "Бүхнийг татагч", min: 250000, perk: null, perkLocked: true, color: "#4f6676" },
  { n: 8, name: "Их тэсрэлт", tagline: "Ертөнц үүсгэгч", min: 500000, perk: null, perkLocked: true, color: "#ec4899" },
  { n: 9, name: "Атом", tagline: "Материйг бүрдүүлэгч", min: 1000000, perk: null, perkLocked: true, color: "#22c55e" },
];

export function levelFor(points) {
  let cur = LEVELS[0];
  for (const l of LEVELS) if (points >= l.min) cur = l;
  return cur;
}
export const nextLevel = (points) => LEVELS.find((l) => l.min > points) || null;

// Энэ түвшинд хүрсэн хэрэглэгч хянагчийн шалгалт өгч болно
export const REVIEWER_LEVEL = 4;

// Оч өгөх: өгсөн хүнд +5, контентын эзэнд +1
export const SPARK_GIVE = 5;
export const SPARK_GET = 1;
