// Огноо: 2026.10.17
export function fmtDate(d) {
  return new Date(d).toISOString().slice(0, 10).replaceAll("-", ".");
}
// "Бичих" хуудсаар бичих төрлүүд (хянагч батална)
export const KINDS = ["Нийтлэл", "Мэдээ"];
// Нүүрний дээд хэсгээс шууд оруулах төрлүүд
export const QUICK_KINDS = ["Асуулт", "Бодрол", "Эвент", "Зарлал"];
// Хянагчийн шалгалтгүйгээр шууд нийтлэгдэх төрлүүд (Figma: "Асуух", "Шидэх")
export const INSTANT_KINDS = ["Асуулт", "Бодрол"];
export const EVENT_TYPES = ["Лекц", "Семинар", "Хурал", "Сургалт", "Уралдаан", "Үзэсгэлэн", "Аялал", "Бусад"];
export const EVENT_FORMATS = ["Онлайн", "Танхим", "Хосолсон"];
