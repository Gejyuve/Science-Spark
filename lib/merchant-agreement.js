import crypto from "crypto";
import { sql } from "./db";
import { merchantName } from "./merchant-shared";

// ЦАХИМ ПЛАТФОРМООР ДАМЖУУЛАН БОРЛУУЛАЛТ ЗУУЧЛАХ ҮЙЛЧИЛГЭЭНИЙ ГЭРЭЭ.
// Эх нь энд. Агуулга өөрчлөгдөх бүрт AGREEMENT_V-г шинэчилнэ: шинэ хувилбар agreement_versions-д хадгалагдаж,
// мерчантууд дахин баталгаажуулна. Хуульч, нягтлан батлах хүртэл DRAFT (is_draft = true).
export const AGREEMENT_KIND = "merchant";
export const AGREEMENT_V = "0.1";
export const AGREEMENT_IS_DRAFT = true;
export const AGREEMENT_TITLE = "Цахим платформоор дамжуулан борлуулалт зуучлах үйлчилгээний гэрээ";
export const COMMISSION_BP = 400; // 4% (суурь нэгж: 0.01%)

const pctOf = (bp) => `${(bp / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
const mnt = (n) => `${Math.round(n).toLocaleString("en-US")} төгрөг`;

// Заалтууд. «• »-ээр эхэлсэн мөр нь дэд заалт.
export function agreementSections(bp = COMMISSION_BP) {
  const p = pctOf(bp);
  const fee = Math.round((50000 * bp) / 10000);
  return [
    ["Гэрээний зорилго", [
      "Платформ нь Мерчантын бараа, бүтээгдэхүүн, тасалбар болон үйлчилгээг цахим системээр дамжуулан хэрэглэгчдэд борлуулахад зуучлах үйлчилгээ үзүүлнэ.",
    ]],
    ["Талуудын эрх зүйн статус", [
      "Мерчант нь өөрийн байршуулсан бараа, бүтээгдэхүүн, үйлчилгээ, тасалбарын үндсэн борлуулагч, нийлүүлэгч байна.",
      "Платформ нь тухайн бүтээгдэхүүнийг өмчлөх, өөрийн нэрийн өмнөөс дахин худалдах, эсхүл үндсэн үйлчилгээ үзүүлэгчийн үүргийг хүлээхгүй бөгөөд борлуулалтын зуучлагчийн хувиар ажиллана.",
      "Платформ нь өөрийн үзүүлж буй зуучлалын үйлчилгээ болон хуульд заасан үүргээ хариуцна.",
    ]],
    ["Төлбөр хүлээн авах эрх", [
      "Мерчант нь өөрийн нэрийн өмнөөс худалдан авагчийн төлбөрийг Платформоор дамжуулан хүлээн авах, бүртгэх, тохиролцсон шимтгэлийг суутгах, үлдэгдэл төлбөрийг Мерчантын баталгаажсан банкны дансанд шилжүүлэх эрхийг Платформд олгоно.",
      "Платформын эрх бүхий төлбөр хүлээн авах сувгаар төлсөн, баталгаажсан төлбөрийг Мерчант хүлээн зөвшөөрнө.",
      "Мерчантын авах мөнгөн хөрөнгийг Платформ өөрийн үйл ажиллагааны орлогоос тусад нь өглөгөөр бүртгэж, зориулалтын бусаар ашиглахгүй.",
    ]],
    ["Зуучлалын үйлчилгээний шимтгэл", [
      `Платформ нь амжилттай хийгдсэн, буцаагдаагүй борлуулалтын төлбөрөөс ${p}-ийн зуучлалын шимтгэл авна.`,
      `Жишээлбэл, 50,000 төгрөгийн борлуулалт хийсэн тохиолдолд Платформын шимтгэл ${mnt(fee)}, Мерчантын авах дүн ${mnt(50000 - fee)} байна.`,
      "Хуульд заасан татварын суутгал болон тусгайлан тохиролцсон бусад төлбөр байвал тусад нь тооцож, тайланд харуулна.",
      "Шимтгэлийн НӨАТ-ын нөхцөлийг гэрээний хавсралт болон холбогдох татварын бүртгэлээр тодорхойлно.",
      "Шимтгэлийн хувь өөрчлөгдөх тохиолдолд Мерчантад урьдчилан мэдэгдэж, шинэ нөхцөлийг баталгаажуулна. Өмнө хийгдсэн борлуулалтад шинэ хувь буцаан үйлчлэхгүй.",
    ]],
    ["Төлбөр тооцоо", [
      "Тайлант хугацаа нь календарийн сарын эхний өдрөөс тухайн сарын сүүлийн өдрийг дуустал байна.",
      "Платформ нь сар бүрийн эцсээр Мерчантын борлуулалтын орлого, буцаалт, үйлчилгээний шимтгэл, хуульд заасан суутгал, өмнөх шилжүүлэг болон төлөх өглөгийг тооцож тайлан гаргана.",
      "Дараа сарын эхний долоо хоногт буюу 1–7-ны өдрүүдэд талууд борлуулалтын тайлан, тооцооны үлдэгдлийг тулган баталгаажуулна.",
      "Платформын нягтлан бодогч баталгаажсан төлбөрийг Мерчантын бүртгэлтэй банкны дансанд шилжүүлнэ.",
      "Амралтын өдөр, банкны саатал, мэдээллийн зөрүү, маргаантай гүйлгээ болон хуульд заасан хязгаарлалтын улмаас шилжүүлэх боломжгүй болсон тохиолдолд Мерчантад шалтгааныг мэдэгдэнэ. Маргаангүй төлбөрийг үндэслэлгүйгээр саатуулахгүй.",
      "Мерчантын хяналтын самбар дээр харагдах үлдэгдэл нь борлуулалтын тооцооны бүртгэл бөгөөд банкны хадгаламж, бие даасан цахим мөнгөний данс биш байна.",
    ]],
    ["Мерчантын эрх, үүрэг", [
      "Мерчант нь дараах үүрэгтэй:",
      "• Бүтээгдэхүүний мэдээллийг үнэн зөв байршуулах;",
      "• Борлуулах үнэ, тоо ширхэг, нөхцөлийг тогтоох;",
      "• Борлуулах эрхтэй бүтээгдэхүүн байршуулах;",
      "• Зохиогчийн эрх болон бусдын эрхийг зөрчихгүй байх;",
      "• Барааны чанар, нийлүүлэлт, хүргэлт, үйлчилгээний гүйцэтгэлийг хариуцах;",
      "• Тасалбартай арга хэмжээг зохион байгуулах үүргээ биелүүлэх;",
      "• Буцаалт, цуцлалтын нөхцөлийг худалдан авагчид ил тод мэдээлэх;",
      "• Татварын болон бүртгэлийн мэдээллийг үнэн зөв өгөх;",
      "• Борлуулалтын тайланг тогтоосон хугацаанд шалгах;",
      "• Банкны дансны мэдээлэл өөрчлөгдсөн бол мэдэгдэх.",
    ]],
    ["Платформын эрх, үүрэг", [
      "Платформ нь дараах үүрэгтэй:",
      "• Борлуулалтын цахим орчноор хангах;",
      "• Захиалга, төлбөрийн мэдээллийг бүртгэх;",
      "• Борлуулалтын тайлан гаргах;",
      "• Тохиролцсон шимтгэлээс өөр төлбөрийг үндэслэлгүй суутгахгүй байх;",
      "• Баталгаажсан төлбөрийг гэрээнд заасан хугацаанд шилжүүлэх;",
      "• Хэрэглэгч болон Мерчантын мэдээллийн аюулгүй байдлыг хангах;",
      "• Хууль бус, хуурамч, эрх зөрчсөн бүтээгдэхүүнийг нийтлэхээс татгалзах;",
      "• Холбогдох хууль тогтоомжид заасан өөрийн үүргийг биелүүлэх.",
    ]],
    ["Буцаалт болон цуцлалт", [
      "Буцаагдсан төлбөрийг Мерчантын борлуулалтын дүнгээс хасна.",
      "Буцаагдсан борлуулалтад хамаарах зуучлалын шимтгэлийг мөн зохих хэмжээгээр залруулна.",
      "Мерчантад төлбөрийг өмнө нь шилжүүлсэн бол тухайн буцаалтын дүнг дараагийн тооцоонд тусгах эсвэл Мерчантаас нөхөн төлүүлэхээр шийдвэрлэнэ.",
      "Худалдан авагчийн хууль ёсны эрхийг хязгаарлахгүй. Буцаалттай холбоотой хариуцлагыг талуудын бодит үүрэг болон хуульд нийцүүлэн хуваарилна.",
    ]],
    ["Татвар, төлбөрийн баримт", [
      "Мерчант нь өөрийн бараа, бүтээгдэхүүн, үйлчилгээний үндсэн борлуулалттай холбоотой татварын үүргийг хуулийн дагуу хариуцна.",
      "Платформ нь зуучлалын шимтгэлийн орлоготой холбоотой татварын үүргийг хариуцна.",
      "Хууль тогтоомжоор Платформд татвар суутган төлөх үүрэг үүссэн бол Платформ тухайн татварыг суутгаж, тайланд тусгана.",
      "Төлбөрийн баримтыг талуудын татварын бүртгэл, И-баримт системийн баталгаажсан зохицуулалтад нийцүүлэн олгоно.",
    ]],
    ["Хувийн мэдээлэл хамгаалах", [
      "Мерчантын хувийн мэдээллийг гэрээ байгуулах, борлуулалт бүртгэх, төлбөр шилжүүлэх, татвар тайлагнах, хуульд заасан үүргийг хэрэгжүүлэх зорилгоор зохих хууль зүйн үндэслэлтэйгээр боловсруулна.",
      "Регистр, банкны данс, иргэний үнэмлэх зэрэг мэдээллийг олон нийтэд харуулахгүй.",
    ]],
    ["Гэрээний хугацаа, цуцлалт", [
      "Гэрээ нь талууд баталгаажуулсан өдрөөс хүчин төгөлдөр болно.",
      "Гэрээ дуусгавар болсон ч өмнөх борлуулалтын өглөг, буцаалт, татвар болон маргаантай холбоотой биелэгдээгүй үүрэг хүчинтэй хэвээр байна.",
    ]],
    ["Маргаан шийдвэрлэх", [
      "Талууд маргааныг эхний ээлжид харилцан зөвшилцөж шийдвэрлэнэ. Зөвшилцөлд хүрээгүй тохиолдолд Монгол Улсын хууль тогтоомжийн дагуу шийдвэрлүүлнэ.",
    ]],
    ["Цахим баталгаажуулалт", [
      "Мерчант гэрээг Платформд нэвтэрсэн хаягаараа, бүртгэлтэй и-мэйл хаягт илгээсэн нэг удаагийн кодоор баталгаажуулна. Платформын эрх бүхий төлөөлөгч Платформын нэрийн өмнөөс баталгаажуулна.",
      "Хоёр талын баталгаажуулалтын огноо, цаг, хэрэглэгчийн дугаар, гэрээний хувилбар, баримтын hash утгыг Платформ хадгална. Баталгаажсан гэрээний агуулгыг өөрчлөхгүй. Гэрээ шинэчлэгдэхэд шинэ хувилбарыг дахин баталгаажуулна.",
    ]],
  ];
}

// Гэрээний хувилбарыг (кодын эх) өгөгдлийн санд нэг удаа хадгалж, мөрийг буцаана
export async function currentVersion() {
  const sections = agreementSections(COMMISSION_BP);
  const [r] = await sql`
    INSERT INTO agreement_versions (kind, version, title, sections, commission_bp, is_draft)
    VALUES (${AGREEMENT_KIND}, ${AGREEMENT_V}, ${AGREEMENT_TITLE}, ${JSON.stringify(sections)}::jsonb, ${COMMISSION_BP}, ${AGREEMENT_IS_DRAFT})
    ON CONFLICT (kind, version) DO UPDATE SET kind = EXCLUDED.kind
    RETURNING *`;
  return r;
}

// Тогтвортой JSON (түлхүүрийг эрэмбэлж) — hash тооцоход
function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`;
  return JSON.stringify(v ?? null);
}
export const hashContent = (c) => crypto.createHash("sha256").update(stable(c)).digest("hex");

// Гэрээний бүрэн эх: тухайн үеийн талуудын мэдээлэл + заалтууд. Мерчант баталгаажуулсны дараа хадгалсан хуулбар л хэрэглэгдэнэ.
export function buildContent({ number, version, merchant: m, company: c = {}, bank }) {
  const p = m.type === "business" ? m.business : m.individual;
  return {
    title: version.title,
    number,
    version: version.version,
    draft: !!version.is_draft,
    commission_bp: version.commission_bp,
    platform: {
      name: c.legalName || "", register_no: c.registerNo || "", state_reg_no: c.stateRegNo || "", address: c.address || "",
      phone: c.phone || "", email: c.email || "", rep_name: c.repName || "", rep_position: c.repPosition || "",
    },
    merchant: m.type === "business"
      ? {
          id: m.id, type: "business", name: merchantName(m), register_no: p.register_no || "", state_reg_no: p.state_reg_no || "",
          address: p.address || "", phone: p.phone || "", email: p.email || "", rep_name: p.rep_name || "", rep_position: p.rep_position || "",
          rep_basis: p.rep_basis || "", tax_id: m.tax_id || "", vat_payer: !!m.vat_payer, shop_name: m.shop_name || "",
        }
      : {
          id: m.id, type: "individual", name: merchantName(m), register_no: p.register_no || "", address: p.address || "",
          phone: p.phone || "", email: p.email || "", tax_id: m.tax_id || "", vat_payer: !!m.vat_payer, shop_name: m.shop_name || "",
        },
    bank: bank ? { bank_name: bank.bank_name, account_no: bank.account_no, holder_name: bank.holder_name, currency: bank.currency || "MNT" } : null,
    sections: version.sections,
  };
}

export const agreementNumber = (id, d = new Date()) => `SS-MG-${d.getFullYear()}-${String(id).padStart(4, "0")}`;

export const AGREEMENT_STATUS = {
  pending_merchant: ["Мерчант баталгаажуулаагүй", "warn"],
  pending_platform: ["Платформ баталгаажуулахыг хүлээж байна", "warn"],
  active: ["Хүчинтэй", "ok"],
  superseded: ["Шинэ хувилбараар солигдсон", "gray"],
  terminated: ["Дуусгавар болсон", "gray"],
};

export async function listAgreements(merchantId) {
  return sql`SELECT a.id, a.number, a.status, a.content_hash, a.commission_bp, a.merchant_signed_at, a.platform_signed_at, a.ended_at, a.created_at,
                    v.version, v.is_draft, mu.initial AS m_initial, mu.first_name AS m_first, pu.initial AS p_initial, pu.first_name AS p_first
             FROM merchant_agreements a JOIN agreement_versions v ON v.id = a.version_id
             LEFT JOIN users mu ON mu.id = a.merchant_user_id LEFT JOIN users pu ON pu.id = a.platform_user_id
             WHERE a.merchant_id = ${merchantId} ORDER BY a.id DESC`;
}

export async function getAgreement(id) {
  const [a] = await sql`SELECT a.*, v.version, v.is_draft FROM merchant_agreements a JOIN agreement_versions v ON v.id = a.version_id WHERE a.id = ${id}`;
  return a || null;
}

// Баталгаажсан мерчантад гэрээний ноорог бэлдэнэ. Мерчант баталгаажуулаагүй бол (pending_merchant) эхийг
// одоогийн мэдээллээр шинэчилнэ; баталгаажуулсан бол хөндөхгүй. Хүчинтэй гэрээ одоогийн хувилбартай бол null.
// Шалгуулж буй (pending_review) мерчант ч гэрээгээ урьдчилж баталгаажуулж болно; платформ мерчантыг батласны дараа баталгаажуулна.
export async function ensureAgreement(m, company) {
  const bank = m.bank || m.pendingBank;
  if (!["approved", "pending_review"].includes(m.status) || !bank) return null;
  const version = await currentVersion();
  const rows = await sql`SELECT * FROM merchant_agreements WHERE merchant_id = ${m.id} AND status IN ('pending_merchant', 'pending_platform', 'active') ORDER BY id DESC`;
  const open = rows.find((r) => r.status !== "active");
  const active = rows.find((r) => r.status === "active");
  if (open?.status === "pending_platform") return open;
  if (!open && active && active.version_id === version.id) return null;
  if (open) {
    const content = buildContent({ number: open.number, version, merchant: m, company, bank });
    const hash = hashContent(content);
    if (hash === open.content_hash && open.version_id === version.id) return open;
    const [u] = await sql`UPDATE merchant_agreements SET content = ${JSON.stringify(content)}::jsonb, content_hash = ${hash}, version_id = ${version.id},
                            commission_bp = ${version.commission_bp}, bank_account_id = ${bank.id}
                          WHERE id = ${open.id} AND status = 'pending_merchant' RETURNING *`;
    return u || open;
  }
  const [{ id }] = await sql`SELECT nextval(pg_get_serial_sequence('merchant_agreements', 'id'))::int AS id`;
  const number = agreementNumber(id);
  const content = buildContent({ number, version, merchant: m, company, bank });
  const [a] = await sql`INSERT INTO merchant_agreements (id, number, merchant_id, version_id, content, content_hash, commission_bp, bank_account_id)
                        VALUES (${id}, ${number}, ${m.id}, ${version.id}, ${JSON.stringify(content)}::jsonb, ${hashContent(content)}, ${version.commission_bp}, ${bank.id})
                        ON CONFLICT DO NOTHING RETURNING *`;
  if (a) return a;
  const [again] = await sql`SELECT * FROM merchant_agreements WHERE merchant_id = ${m.id} AND status IN ('pending_merchant', 'pending_platform')`;
  return again || null;
}

export async function activeAgreement(merchantId) {
  const [a] = await sql`SELECT a.id, a.number, v.version FROM merchant_agreements a JOIN agreement_versions v ON v.id = a.version_id
                        WHERE a.merchant_id = ${merchantId} AND a.status = 'active'`;
  return a || null;
}
