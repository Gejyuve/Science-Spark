import { sql } from "./db";
import { merchantName } from "./merchant-shared";

// Маркетын бүтээгдэхүүн (сервер). Тогтмол, тооцоо: lib/market-shared.js

// Борлуулагчийн нэр: дэлгүүрийн нэр, албан ёсны нэр (худалдан авагчид ил тод харуулна)
const withSeller = (r) => r && {
  ...r,
  seller: r.m_id ? merchantName({ id: r.m_id, type: r.m_type, legal_name: r.legal_name, parent_name: r.parent_name, first_name: r.m_first }) : null,
};

export async function loadProduct(id) {
  const [r] = await sql`SELECT p.*, m.type AS m_type, m.status AS m_status, m.shop_name, m.id AS m_id,
    bp.legal_name, ip.parent_name, ip.first_name AS m_first, u.initial AS u_initial, u.first_name AS u_first FROM products p
    LEFT JOIN merchants m ON m.id = p.merchant_id
    LEFT JOIN merchant_business_profiles bp ON bp.merchant_id = m.id
    LEFT JOIN merchant_individual_profiles ip ON ip.merchant_id = m.id
    LEFT JOIN users u ON u.id = p.user_id
    WHERE p.id = ${id}`;
  return withSeller(r) || null;
}

// Нийтэд: нийтлэгдсэн, мерчант нь борлуулах эрхтэй (баталгаажсан, хүчинтэй гэрээтэй)
export async function listPublished({ type = null, limit = 60 } = {}) {
  const rows = await sql`SELECT p.*, m.type AS m_type, m.status AS m_status, m.shop_name, m.id AS m_id,
    bp.legal_name, ip.parent_name, ip.first_name AS m_first, u.initial AS u_initial, u.first_name AS u_first FROM products p
    JOIN merchants m ON m.id = p.merchant_id AND m.status = 'approved'
    JOIN merchant_agreements a ON a.merchant_id = m.id AND a.status = 'active'
    LEFT JOIN merchant_business_profiles bp ON bp.merchant_id = m.id
    LEFT JOIN merchant_individual_profiles ip ON ip.merchant_id = m.id
    LEFT JOIN users u ON u.id = p.user_id
    WHERE p.status = 'published' AND (${type}::text IS NULL OR p.type = ${type})
    ORDER BY p.published_at DESC NULLS LAST, p.id DESC LIMIT ${limit}`;
  return rows.map(withSeller);
}

export async function listMine(userId) {
  return sql`SELECT id, title, status, price, stock, image_ids, type, review_note, updated_at FROM products WHERE user_id = ${userId} ORDER BY updated_at DESC`;
}

export async function listForReview(status) {
  const rows = await sql`SELECT p.*, m.type AS m_type, m.status AS m_status, m.shop_name, m.id AS m_id,
    bp.legal_name, ip.parent_name, ip.first_name AS m_first, u.initial AS u_initial, u.first_name AS u_first FROM products p
    LEFT JOIN merchants m ON m.id = p.merchant_id
    LEFT JOIN merchant_business_profiles bp ON bp.merchant_id = m.id
    LEFT JOIN merchant_individual_profiles ip ON ip.merchant_id = m.id
    LEFT JOIN users u ON u.id = p.user_id
    WHERE p.status = ${status} ORDER BY COALESCE(p.submitted_at, p.updated_at) ASC LIMIT 200`;
  return rows.map(withSeller);
}

// Мерчантын гэрээний шат: бүтээгдэхүүнийг редакц руу илгээхээс өмнө шалгана
// none: мерчант бүртгэлгүй · form: мэдээлэл бөглөж байна · sign: гэрээ баталгаажуулах · ready: баталгаажуулсан · blocked
export function merchantStage(m) {
  if (!m || m.status === "rejected") return "none";
  if (["draft", "revision_required"].includes(m.status)) return "form";
  if (["suspended", "terminated"].includes(m.status)) return "blocked";
  if (m.agreement || m.agreementOpen?.status === "pending_platform") return "ready";
  return "sign";
}
