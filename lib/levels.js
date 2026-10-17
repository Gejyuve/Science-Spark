// АНХААР: доорх оноо түр утга. Жинхэнэ босгыг та баталсны дараа энд солино.
export const LEVELS = [
  { n: 1, name: "Лаа", min: 0 },
  { n: 2, name: "Түймэр", min: 100 },
  { n: 3, name: "Плазм", min: 500 },
  { n: 4, name: "Фузион", min: 1500 },
  { n: 5, name: "Од", min: 5000 },
  { n: 6, name: "Супернова", min: 15000, locked: true },
  { n: 7, name: "Хар нүх", min: 40000, locked: true },
  { n: 8, name: "Их тэсрэлт", min: 100000, locked: true },
  { n: 9, name: "Атом", min: 250000, locked: true },
];

export function levelFor(points) {
  let cur = LEVELS[0];
  for (const l of LEVELS) if (!l.locked && points >= l.min) cur = l;
  return cur;
}

// Энэ түвшинд хүрсэн хэрэглэгч хянагчийн шалгалт өгч болно
export const REVIEWER_LEVEL = 4;
