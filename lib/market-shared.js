// Маркетын бүтээгдэхүүн: клиент, сервер хоёуланд ашиглах тогтмол, тооцоо.
import { PRODUCT_TYPES } from "./merchant-shared";
import { MN_CITIES } from "./profile";

export { PRODUCT_TYPES };
export const PRODUCT_STATUS = {
  draft: ["Ноорог", "gray"],
  pending_review: ["Редакц шалгаж байна", "warn"],
  revision_required: ["Засвар шаардлагатай", "warn"],
  published: ["Нийтлэгдсэн", "ok"],
  rejected: ["Татгалзсан", "bad"],
  hidden: ["Нуусан", "gray"],
};
export const PRODUCT_EDITABLE = ["draft", "revision_required", "rejected", "published", "hidden"];

// Хүргэлт шаардлагагүй (цахим) төрлүүд
export const DIGITAL_TYPES = ["Арга хэмжээний тасалбар", "Дижитал бүтээгдэхүүн", "Сургалт, курс"];
export const needsPost = (type) => !!type && !DIGITAL_TYPES.includes(type);

export const MAX_IMAGES = 8;
export const PRICE_MIN = 100;
export const PRICE_MAX = 50_000_000;
export const COMMISSION_PCT = 4;

// Илгээмжийн хайрцгийн хэмжээ (мерчантад чиглүүлэг)
export const PARCEL_SIZES = [
  ["S", "Жижиг", "25×20×10 см хүртэл"],
  ["M", "Дунд", "40×30×20 см хүртэл"],
  ["L", "Том", "60×40×40 см хүртэл"],
];
export const POST_FROM = MN_CITIES;
export const PREP_DAYS = [1, 2, 3, 5, 7];

// Шимтгэл, мерчантын авах дүн (бүхэл төгрөг)
export const feeOf = (price) => Math.round((Number(price) || 0) * COMMISSION_PCT / 100);

// Монгол шуудангийн тарифаар хүргэлтийн үнэ тооцно. Тарифыг супер админ Тохиргоонд оруулна (кодонд үнэ бичихгүй).
// t: { ub, aimag, perKg, ubDays, aimagDays } — хоосон бол null буцаана.
export function postEstimate(t = {}, weightKg, toUb = true) {
  const base = Number(toUb ? t.ub : t.aimag);
  if (!base) return null;
  const extra = Math.max(0, Math.ceil((Number(weightKg) || 0) - 1));
  return base + extra * (Number(t.perKg) || 0);
}
export const postReady = (t = {}) => !!(Number(t.ub) && Number(t.aimag));

export const fmtMnt = (n) => `${Math.round(Number(n) || 0).toLocaleString("en-US")}₮`;
