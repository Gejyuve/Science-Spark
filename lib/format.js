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
export const EVENT_TYPES = ["Лекц", "Семинар", "Хурал", "Хакатон", "Олимпиад", "Өдөрлөг", "Сургалт", "Уралдаан", "Уулзалт", "Үзэсгэлэн", "Аялал", "Бусад"];
export const EVENT_FORMATS = ["Онлайн", "Танхим", "Хосолсон"];

// Латин үсгийн эзлэх хувь (зөвхөн үсгүүдийг тоолно, холбоос тоологдохгүй). 0–1.
export function latinShare(text) {
  const t = String(text || "").replace(/https?:\/\/\S+/gi, "");
  const latin = (t.match(/[A-Za-z]/g) || []).length;
  const cyr = (t.match(/[А-Яа-яЁёӨөҮү]/g) || []).length;
  return latin + cyr === 0 ? 0 : latin / (latin + cyr);
}
// Тайлбар текстэд латин үсэг хязгаараас хэтэрвэл зөвшөөрөхгүй (хязгаарыг хэрэглэгчид харуулахгүй)
export const LATIN_LIMIT = 0.3;
export const LATIN_MSG = "Кириллээр бичнэ үү.";
