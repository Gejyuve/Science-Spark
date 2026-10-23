// Сэтгүүл хэсгийн тохиргоо. Супер админ Админ > Сэтгүүл хуудаснаас нийтэд нээнэ (settings.magazinePublic).
export let MAGAZINE_PUBLIC = false;
export function setMagazineRules(s) {
  MAGAZINE_PUBLIC = !!s.magazinePublic;
}

export const ISSUE_STATUS = { draft: ["Бэлтгэж байна", "gray"], soon: ["Удахгүй гарна", "warn"], published: ["Нийтлэгдсэн", "ok"], archived: ["Архивласан", "gray"] };
export const ORDER_STATUS = { paid: ["Төлсөн, хүргэлт хүлээж байна", "warn"], sent: ["Хүргэлтэд гарсан", "teal"], delivered: ["Хүргэгдсэн", "ok"], cancelled: ["Цуцалсан, мөнгө буцсан", "gray"] };
export const REQUEST_STATUS = { new: ["Шинэ", "warn"], accepted: ["Хүлээн авсан", "teal"], declined: ["Татгалзсан", "gray"], done: ["Нийтлэгдсэн", "ok"] };
export const REQUEST_KIND = { article: "Нийтлэл", banner: "Баннер зар" };
export const BANNER_SIZES = ["Бүтэн хуудас", "Хагас хуудас", "1/4 хуудас", "Ар хавтас", "Дотор хавтас"];
// Улаанбаатарын дүүргүүд (хаяг бөглөхөд)
export const UB_DISTRICTS = ["Багануур", "Багахангай", "Баянгол", "Баянзүрх", "Налайх", "Сонгинохайрхан", "Сүхбаатар", "Хан-Уул", "Чингэлтэй"];
export const MAX_PAGES = 400;
export const MAX_ORDER_QTY = 20;
