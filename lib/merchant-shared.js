// Мерчант (бараа, тасалбар борлуулагч): клиент болон сервер хоёуланд хэрэглэх тогтмол, шалгалт.

// Мерчантын бүртгэл нийтэд нээлттэй эсэх (settings.merchantOpen). Сервер дээр тохиргоо ачаалахад шинэчлэгдэнэ.
export let MERCHANT_OPEN = false;
export function setMerchantRules(s) {
  MERCHANT_OPEN = !!s.merchantOpen;
}

export const MERCHANT_TYPES = { individual: "Хувь хүн", business: "Хуулийн этгээд / байгууллага" };

// [нэр, өнгө (adm-pill / mc-pill tone)]
export const MERCHANT_STATUS = {
  draft: ["Бөглөж байна", "gray"],
  pending_review: ["Шалгуулахаар илгээсэн", "warn"],
  revision_required: ["Засвар шаардлагатай", "warn"],
  approved: ["Баталгаажсан", "ok"],
  rejected: ["Татгалзсан", "bad"],
  suspended: ["Түр түдгэлзүүлсэн", "bad"],
  terminated: ["Гэрээ дуусгавар болсон", "gray"],
};
// Мерчант өөрөө мэдээллээ засах боломжтой төлөв
export const EDITABLE = ["draft", "revision_required"];

export const BANK_STATUS = {
  pending: ["Шалгаж байна", "warn"],
  verified: ["Баталгаажсан", "ok"],
  rejected: ["Татгалзсан", "bad"],
  replaced: ["Сольсон (түүх)", "gray"],
};

export const PRODUCT_TYPES = [
  "Ном, сэтгүүл",
  "Арга хэмжээний тасалбар",
  "Сургалт, курс",
  "Туршилтын иж бүрдэл, хэрэгсэл",
  "Тоглоом, оньсого",
  "Хувцас, бэлэг дурсгал",
  "Дижитал бүтээгдэхүүн",
  "Бусад",
];

export const BANKS = [
  "Хаан банк", "Голомт банк", "Худалдаа хөгжлийн банк", "Хас банк", "Төрийн банк", "Капитрон банк",
  "Богд банк", "Ариг банк", "Тээвэр хөгжлийн банк", "Чингис хаан банк", "М банк", "Үндэсний хөрөнгө оруулалтын банк", "Кредит банк",
];

// Баримтын төрөл. need: тухайн төрлийн мерчантад заавал эсэх
export const DOC_KINDS = {
  id_card: { label: "Иргэний үнэмлэх", types: ["individual"] },
  cert: { label: "Улсын бүртгэлийн гэрчилгээ", types: ["business"], need: ["business"] },
  rep_basis: { label: "Төлөөлөх эрхийн баримт (томилгоо, итгэмжлэл)", types: ["business"] },
  bank_proof: { label: "Данс эзэмшлийг нотлох баримт (дансны тодорхойлолт)", types: ["individual", "business"] },
  other: { label: "Бусад баримт", types: ["individual", "business"] },
};
export const DOC_MAX = 4_000_000; // Vercel-ийн хүсэлтийн хязгаар 4.5MB
export const DOC_LIMIT = 20; // нэг мерчант идэвхтэй ийм тооны баримттай байна
export const DOC_MIME = { "application/pdf": "PDF", "image/jpeg": "JPG", "image/png": "PNG" };

// Талбарууд: [нэр, шошго, заавал эсэх, төрөл]. Заавал биш бол «Байгаа бол», «Хамаарах бол» гэж харуулна.
export const INDIVIDUAL_FIELDS = [
  ["parent_name", "Эцэг, эхийн нэр", true, "name"],
  ["first_name", "Өөрийн нэр", true, "name"],
  ["register_no", "Регистрийн дугаар", true, "reg_person"],
  ["phone", "Утасны дугаар", true, "phone"],
  ["email", "И-мэйл хаяг", true, "email"],
  ["address", "Оршин суугаа хаяг", true, "address"],
];
export const BUSINESS_FIELDS = [
  ["legal_name", "Байгууллагын албан ёсны нэр", true, "name"],
  ["state_reg_no", "Улсын бүртгэлийн дугаар", true, "state_reg"],
  ["register_no", "Байгууллагын регистрийн дугаар", true, "reg_org"],
  ["address", "Албан ёсны хаяг", true, "address"],
  ["phone", "Байгууллагын утас", true, "phone"],
  ["email", "Байгууллагын и-мэйл", true, "email"],
  ["rep_name", "Эрх бүхий төлөөлөгчийн овог, нэр", true, "name"],
  ["rep_position", "Төлөөлөгчийн албан тушаал", true, "name"],
  ["rep_basis", "Төлөөлөх эрхийн үндэслэл", true, "basis"],
  ["rep_phone", "Төлөөлөгчийн утас", true, "phone"],
  ["rep_email", "Төлөөлөгчийн и-мэйл", true, "email"],
  ["acc_name", "Нягтлан бодогчийн овог, нэр", false, "name"],
  ["acc_phone", "Нягтлан бодогчийн утас", false, "phone"],
  ["acc_email", "Нягтлан бодогчийн и-мэйл", false, "email"],
];
export const REP_BASIS = ["Гүйцэтгэх захирал (дүрмээр)", "Томилгооны тушаал", "Итгэмжлэл", "Байгууллагын эзэмшигч"];

// Утгыг цэвэрлэнэ (зай, том жижиг үсэг)
export function normalize(kind, v) {
  let s = String(v ?? "").trim();
  if (kind === "reg_person") return s.replace(/\s+/g, "").toUpperCase();
  if (kind === "reg_org" || kind === "state_reg") return s.replace(/\s+/g, "");
  if (kind === "phone") return s.replace(/[\s-]/g, "").replace(/^\+?976/, "");
  if (kind === "email") return s.toLowerCase();
  if (kind === "account") return s.replace(/[\s-]/g, "").toUpperCase();
  return s.replace(/\s+/g, " ");
}

const MAX = { name: 120, address: 300, basis: 120, email: 120 };

// Алдаатай бол монгол тайлбар, зөв бол null
export function check(kind, v) {
  if (kind === "reg_person") return /^[А-ЯЁӨҮ]{2}\d{8}$/.test(v) ? null : "2 кирилл үсэг, 8 оронтой тоо байна (жишээ: УБ99112233)";
  if (kind === "reg_org") return /^\d{7}$/.test(v) ? null : "7 оронтой тоо байна";
  if (kind === "state_reg") return /^\d{6,14}$/.test(v) ? null : "Зөвхөн тоо, 6–14 оронтой байна";
  if (kind === "phone") return /^\d{8}$/.test(v) ? null : "8 оронтой утасны дугаар бичнэ үү";
  if (kind === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= MAX.email ? null : "И-мэйл хаяг буруу байна";
  if (kind === "account") return /^\d{6,20}$/.test(v) || /^MN\d{18}$/.test(v) ? null : "Дансны дугаар (6–20 оронтой тоо) эсвэл MN-ээр эхэлсэн IBAN бичнэ үү";
  if (kind === "tax_id") return /^[0-9A-ZА-ЯЁӨҮ]{7,14}$/.test(v) ? null : "Татвар төлөгчийн дугаар буруу байна";
  const n = MAX[kind] || 200;
  if (v.length < 2) return "Хэт богино байна";
  if (v.length > n) return `${n} тэмдэгтээс хэтрэхгүй`;
  return null;
}

// Олон нийтэд харагдах хэсэгчилсэн утга
export const maskTail = (v, keep = 4) => {
  const s = String(v || "");
  return s.length <= keep ? s : "•".repeat(Math.min(6, s.length - keep)) + s.slice(-keep);
};

// Мерчантын нэр: байгууллагын албан ёсны нэр эсвэл хувь хүний овог нэр
export const merchantName = (m) =>
  m.type === "business" ? m.legal_name || m.shop_name || `Мерчант №${m.id}` : [m.parent_name, m.first_name].filter(Boolean).join(" ") || m.shop_name || `Мерчант №${m.id}`;
