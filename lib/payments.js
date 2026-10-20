import { revalidatePath } from "next/cache";
import { sql } from "./db";
import { audit } from "./admin";
import { notify } from "./notify";
import { paymentRows, insertRow, fmtMnt, REQUEST_KIND, QPAY_FEE } from "./money";
import { qpayOn, createInvoice, checkInvoice, cancelInvoice } from "./qpay";

// Төлбөр баталгаажсаны дараах нийтлэг ажил (редакц гараар ч, QPay автоматаар ч):
// дансуудад хуваарилж, дэмжигчийн хугацааг сунгаж, төлсөн хүн болон бичээчид мэдэгдэнэ.
// req: статусыг нь аль хэдийн 'confirmed' болгосон мөр
export async function settlePayment(req, fee, actorId) {
  for (const r of paymentRows(req, fee, actorId)) await insertRow(r);
  if (req.kind === "premium") {
    await sql`UPDATE users SET premium_until = GREATEST(COALESCE(premium_until, now()), now()) + make_interval(days => ${30 * req.months})
              WHERE id = ${req.user_id}`;
    await notify({ userId: req.user_id, kind: "premium_ok" });
  } else if (req.kind === "topup") {
    await notify({ userId: req.user_id, kind: "topup_ok", note: fmtMnt(req.amount) });
  } else {
    await notify({ userId: req.user_id, kind: "pay_ok" });
    if (req.kind === "tip") await notify({ userId: req.writer_id, kind: "tip", actorId: req.anonymous ? null : req.user_id, postId: req.post_id, note: req.message });
  }
  revalidatePath("/san");
  revalidatePath("/wallet");
  revalidatePath("/admin/finance");
}

const describe = (r) =>
  r.kind === "premium" ? `Science Spark дэмжигч · ${r.months} сар` : `Science Spark · ${REQUEST_KIND[r.kind] || "Дэмжлэг"}`;

// Хүлээгдэж буй хүсэлтэд QPay нэхэмжлэх үүсгэнэ (нэг удаа). QPay тохируулаагүй эсвэл алдаа гарвал null:
// тэр үед хэрэглэгч дансаар шилжүүлж, редакц гараар баталгаажуулна.
export async function ensureInvoice(req) {
  if (!qpayOn() || req.status !== "pending") return null;
  if (req.qpay_invoice) return req.qpay;
  try {
    const inv = await createInvoice({ code: req.code, userId: req.user_id, amount: req.amount, description: describe(req) });
    const data = { qr_image: inv.qr_image, short_url: inv.short_url, urls: inv.urls };
    // Зэрэг хоёр хүсэлт ирвэл эхнийх нь л хадгалагдана
    const [saved] = await sql`UPDATE payment_requests SET qpay_invoice = ${inv.invoice_id}, qpay = ${JSON.stringify(data)}::jsonb
                              WHERE id = ${req.id} AND qpay_invoice IS NULL RETURNING qpay`;
    if (saved) return saved.qpay;
    await cancelInvoice(inv.invoice_id);
    const [r] = await sql`SELECT qpay FROM payment_requests WHERE id = ${req.id}`;
    return r?.qpay || null;
  } catch (e) {
    console.error("QPay invoice", e.message);
    return null;
  }
}

// QPay-ээс төлөгдсөн эсэхийг шалгаж, төлөгдсөн бол автоматаар баталгаажуулна.
// Хэрэглэгч цуцалсны дараа төлсөн ч мөнгө ирсэн тул баталгаажуулна. Буцаах утга: шинэ статус.
// gap: нэг хүсэлтийг энэ хугацаанаас (мс) ойр дахин QPay-ээс шалгахгүй (хуудас тогтмол асуухад)
const lastCheck = new Map();
export async function syncQpay(req, gap = 0) {
  if (!qpayOn() || !req.qpay_invoice || req.status === "confirmed") return req.status;
  const now = Date.now();
  if (gap && now - (lastCheck.get(req.id) || 0) < gap) return req.status;
  lastCheck.set(req.id, now);
  if (lastCheck.size > 5000) lastCheck.clear();
  let paid;
  try {
    paid = await checkInvoice(req.qpay_invoice);
  } catch (e) {
    console.error("QPay check", e.message);
    return req.status;
  }
  if (!paid.paymentId || paid.amount < req.amount) return req.status;
  const fee = Math.round(req.amount * QPAY_FEE);
  const [done] = await sql`UPDATE payment_requests SET status = 'confirmed', paid_via = 'qpay', qpay_payment = ${paid.paymentId}, decided_by = NULL, decided_at = now()
                           WHERE id = ${req.id} AND status IN ('pending', 'cancelled') RETURNING *`;
  if (!done) return "confirmed";
  await settlePayment(done, fee, null);
  // Санхүү хариуцсан супер админуудад
  try {
    await sql`INSERT INTO notifications (user_id, kind, actor_id, note)
              SELECT id, 'pay_in', ${done.user_id}, ${`${REQUEST_KIND[done.kind]} ${fmtMnt(done.amount)} · ${done.code}`} FROM users WHERE role = 'superadmin'`;
  } catch (e) {}
  await audit({ category: "money", action: `QPay: ${REQUEST_KIND[done.kind]} автоматаар баталгаажсан ${fmtMnt(done.amount)} (${done.code})`, targetType: "user", targetId: done.user_id });
  return "confirmed";
}

export { cancelInvoice };
