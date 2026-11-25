import { sql } from "./db";
import { isSuperAdmin } from "./auth";
import { loadSettings } from "./settings";

// Мерчантын бүртгэл (Marketplace, Phase 1). Тогтмол, шалгалт: lib/merchant-shared.js

// Мерчантын бүртгэл нээлттэй эсэх: супер админ Админ > Мерчант хэсгээс нээнэ (settings.merchantOpen).
// Нээгээгүй үед зөвхөн супер админ туршина.
export async function merchantOpenFor(user) {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  const s = await loadSettings();
  return !!s.merchantOpen;
}

// Маркетыг үзэх эрх: нээгдсэн бол хүн бүр (нэвтрээгүй ч), эс бөгөөс супер админ
export async function marketOpenFor(user) {
  if (user && isSuperAdmin(user)) return true;
  const s = await loadSettings();
  return !!s.merchantOpen;
}

// Мерчантын мөрийг профайлтай нь (төрлөөс хамааран) нэг объект болгож авна
export async function loadMerchant({ id = null, userId = null }) {
  const rows = id
    ? await sql`SELECT * FROM merchants WHERE id = ${id}`
    : await sql`SELECT * FROM merchants WHERE user_id = ${userId}`;
  const m = rows[0];
  if (!m) return null;
  const [ind, biz, banks, docs, log, agr] = await Promise.all([
    sql`SELECT * FROM merchant_individual_profiles WHERE merchant_id = ${m.id}`,
    sql`SELECT * FROM merchant_business_profiles WHERE merchant_id = ${m.id}`,
    sql`SELECT b.*, d.file_name AS proof_name FROM merchant_bank_accounts b LEFT JOIN merchant_documents d ON d.id = b.proof_doc_id
        WHERE b.merchant_id = ${m.id} ORDER BY b.id DESC`,
    sql`SELECT id, kind, file_name, mime, size, created_at FROM merchant_documents WHERE merchant_id = ${m.id} AND removed_at IS NULL ORDER BY id`,
    sql`SELECT l.*, u.initial, u.first_name FROM merchant_status_log l LEFT JOIN users u ON u.id = l.actor_id
        WHERE l.merchant_id = ${m.id} ORDER BY l.id DESC LIMIT 50`,
    sql`SELECT a.id, a.number, a.status, v.version FROM merchant_agreements a JOIN agreement_versions v ON v.id = a.version_id
        WHERE a.merchant_id = ${m.id} AND a.status IN ('active', 'pending_merchant', 'pending_platform') ORDER BY a.id DESC`,
  ]);
  const profile = (m.type === "business" ? biz[0] : ind[0]) || {};
  delete profile.merchant_id;
  delete profile.updated_at;
  return {
    ...profile,
    ...m,
    individual: ind[0] || {},
    business: biz[0] || {},
    banks,
    bank: banks.find((b) => b.status === "verified") || null,
    pendingBank: banks.find((b) => b.status === "pending") || null,
    docs,
    log,
    agreement: agr.find((a) => a.status === "active") || null,
    agreementOpen: agr.find((a) => a.status !== "active") || null,
  };
}

// Төлөв солих бүрийг түүхэнд бичнэ
export async function logStatus(merchantId, from, to, note, actorId) {
  await sql`INSERT INTO merchant_status_log (merchant_id, from_status, to_status, note, actor_id)
            VALUES (${merchantId}, ${from}, ${to}, ${note || null}, ${actorId || null})`;
}

// Санхүү хариуцсан супер админуудад мерчантын мэдэгдэл
export async function notifySupers(kind, merchantId, actorId, note = null) {
  try {
    await sql`INSERT INTO notifications (user_id, kind, actor_id, note, merchant_id)
              SELECT id, ${kind}, ${actorId}, ${note}, ${merchantId} FROM users
              WHERE role = 'superadmin' AND NOT is_bot AND id IS DISTINCT FROM ${actorId}::int`;
  } catch (e) {}
}

// Мерчант руу мэдэгдэл (мерчантын эзэн хэрэглэгчид)
export async function notifyMerchant(m, kind, actorId, note = null) {
  if (!m.user_id || m.user_id === actorId) return;
  try {
    await sql`INSERT INTO notifications (user_id, kind, actor_id, note, merchant_id)
              VALUES (${m.user_id}, ${kind}, ${actorId}, ${note}, ${m.id})`;
  } catch (e) {}
}

// Бараа нийтлэх, шинэ борлуулалт хийх эрх: баталгаажсан, баталгаажсан данстай, хоёр тал баталгаажуулсан хүчинтэй гэрээтэй
export const canSell = (m) => !!m && m.status === "approved" && !!m.bank && !!m.agreement;
