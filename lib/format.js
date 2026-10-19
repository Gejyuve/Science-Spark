// Огноо: 2026.10.17
// Улаанбаатарын цагаар (UTC+8)
export function fmtDate(d) {
  return new Date(new Date(d).getTime() + 8 * 3600000).toISOString().slice(0, 10).replaceAll("-", ".");
}

// Нийтлэгдсэн хугацаа: 24 цагаас өмнө бол огноо, дотор бол "3 цаг", "30 мин", "Дөнгөж сая"
export function relTime(d) {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s >= 86400) return { recent: false, text: fmtDate(d) };
  if (s < 60) return { recent: true, text: "Дөнгөж сая" };
  if (s < 3600) return { recent: true, text: `${Math.floor(s / 60)} мин` };
  return { recent: true, text: `${Math.floor(s / 3600)} цаг` };
}
// "Бичих" хуудсаар бичих төрлүүд (хянагч батална)
export const KINDS = ["Нийтлэл", "Мэдээ"];
// Нүүрний дээд хэсгээс шууд оруулах төрлүүд
export const QUICK_KINDS = ["Асуулт", "Бодрол", "Эвент", "Зарлал"];
// Хянагчийн шалгалтгүйгээр шууд нийтлэгдэх төрлүүд (Figma: "Асуух", "Шидэх")
// Төрлийн шошгон дээр дарахад очих хуудас
export const KIND_HREF = { Асуулт: "/?f=qa", Бодрол: "/?f=qa", Эвент: "/events", Зарлал: "/?f=ann", Үг: "/dict", Нийтлэл: "/?f=art", Мэдээ: "/?f=news", Даалгавар: "/tasks", Тайлан: "/reports" };
export const INSTANT_KINDS = ["Асуулт", "Бодрол"];
export const EVENT_TYPES = ["Лекц", "Семинар", "Хурал", "Хакатон", "Олимпиад", "Өдөрлөг", "Сургалт", "Уралдаан", "Уулзалт", "Үзэсгэлэн", "Аялал", "Бусад"];
// Эвентийн тайлбарын доод хэмжээ (картын хоосон зайг дүүргэх)
export const EVENT_BODY_MIN = 150;
export const EVENT_FORMATS = ["Онлайн", "Танхим", "Хосолсон"];
// Зарлалын төрөл (Figma: Зарлалын төрөл: Элсэлт)
export const ANNOUNCE_TYPES = ["Элсэлт", "Ажлын байр", "Дадлага", "Тэтгэлэг", "Уралдаан", "Сайн дурын ажил", "Хамтрал", "Мэдээлэл", "Бусад"];
// "2026-10-31" → "2026.10.31 хүртэл"
export const untilText = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || "") ? `${d.replace(/-/g, ".")} хүртэл` : d || "");

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
