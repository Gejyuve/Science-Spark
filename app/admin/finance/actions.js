"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireSuper, audit } from "@/lib/admin";
import { notify } from "@/lib/notify";
import { paymentRows, insertRow, poolBalance, walletBalance, fmtMnt, EXPENSE_KINDS, KIND_LABEL, INCOME_TAX, REQUEST_KIND } from "@/lib/money";
import { currentPeriod, validPeriod, periodLabel, monthBoard, splitPrizes } from "@/lib/spark";

const back = (msg, ok = false, tab = "") => redirect(`/admin/finance${tab ? `?t=${tab}&` : "?"}${ok ? "ok" : "error"}=${encodeURIComponent(msg)}`);
const label = (u) => `${u.initial}.${u.first_name}`;

// Шилжүүлэг ирснийг баталгаажуулна: дүнг дансуудад хуваарилж, премиумыг сунгана
export async function confirmPayment(formData) {
  const me = await requireSuper("finance");
  const id = Number(formData.get("id"));
  const fee = Math.max(0, Math.round(Number(formData.get("fee") || 0)));
  // Зэрэг дарахад нэг л удаа бичигдэнэ
  const [req] = await sql`UPDATE payment_requests SET status = 'confirmed', decided_by = ${me.id}, decided_at = now()
                          WHERE id = ${id} AND status = 'pending' RETURNING *`;
  if (!req) back("Хүсэлт олдсонгүй эсвэл шийдвэрлэгдсэн");
  if (fee >= req.amount) {
    await sql`UPDATE payment_requests SET status = 'pending', decided_by = NULL, decided_at = NULL WHERE id = ${id}`;
    back("Шимтгэл дүнгээс бага байх ёстой");
  }
  for (const r of paymentRows(req, fee, me.id)) await insertRow(r);
  if (req.kind === "premium") {
    await sql`UPDATE users SET premium_until = GREATEST(COALESCE(premium_until, now()), now()) + make_interval(days => ${30 * req.months})
              WHERE id = ${req.user_id}`;
    await notify({ userId: req.user_id, kind: "premium_ok" });
  } else if (req.kind === "topup") {
    await notify({ userId: req.user_id, kind: "topup_ok", note: fmtMnt(req.amount - fee) });
  } else {
    await notify({ userId: req.user_id, kind: "pay_ok" });
    if (req.kind === "tip") await notify({ userId: req.writer_id, kind: "tip", actorId: req.anonymous ? null : req.user_id, postId: req.post_id, note: req.message });
  }
  await audit({ actorId: me.id, category: "money", action: `${REQUEST_KIND[req.kind]} баталгаажуулсан ${fmtMnt(req.amount)} (${req.code})`, targetType: "user", targetId: req.user_id });
  revalidatePath("/san");
  revalidatePath("/wallet");
  revalidatePath("/admin/finance");
  back(`${req.code} баталгаажлаа`, true);
}

export async function cancelPayment(formData) {
  const me = await requireSuper("finance");
  const id = Number(formData.get("id"));
  const [req] = await sql`UPDATE payment_requests SET status = 'cancelled', decided_by = ${me.id}, decided_at = now()
                          WHERE id = ${id} AND status = 'pending' RETURNING code, user_id`;
  if (!req) back("Хүсэлт олдсонгүй");
  await audit({ actorId: me.id, category: "money", action: `Төлбөрийн хүсэлт цуцалсан (${req.code})`, targetType: "user", targetId: req.user_id });
  await notify({ userId: req.user_id, kind: "pay_no", note: req.code });
  revalidatePath("/admin/finance");
  back(`${req.code} цуцлагдлаа`, true);
}

// Сайтын зардал: сервер, редакцын цалин, татвар, шимтгэл, бусад
export async function addExpense(formData) {
  const me = await requireSuper("finance");
  const kind = String(formData.get("kind") || "");
  const amount = Math.round(Number(String(formData.get("amount") || "").replace(/[^\d]/g, "")));
  const period = String(formData.get("period") || currentPeriod());
  const note = String(formData.get("note") || "").trim().slice(0, 200) || null;
  if (!EXPENSE_KINDS.includes(kind)) back("Зардлын төрлөө сонгоно уу", false, "expense");
  if (!(amount > 0 && amount < 1e10)) back("Дүнгээ зөв оруулна уу", false, "expense");
  if (!validPeriod(period)) back("Сар буруу байна (2026-10)", false, "expense");
  await insertRow({ account: "platform", kind, delta: -amount, period, note, created_by: me.id });
  await insertRow({ account: "out", kind, delta: amount, period, note, created_by: me.id });
  await audit({ actorId: me.id, category: "money", action: `Зардал: ${KIND_LABEL[kind]} ${fmtMnt(amount)} (${period})` });
  revalidatePath("/san");
  back("Зардал бүртгэгдлээ", true, "expense");
}

// Хэтэвчээс татах: татвар суутгаад шилжүүлсэн гэж тэмдэглэнэ
export async function payWithdrawal(formData) {
  const me = await requireSuper("finance");
  const id = Number(formData.get("id"));
  const [w] = await sql`SELECT w.*, u.initial, u.first_name FROM withdrawals w JOIN users u ON u.id = w.user_id WHERE w.id = ${id} AND w.status = 'pending'`;
  if (!w) back("Хүсэлт олдсонгүй", false, "withdraw");
  if ((await walletBalance(w.user_id)) < w.amount) back("Хэтэвчийн үлдэгдэл хүрэлцэхгүй байна", false, "withdraw");
  const [d] = await sql`UPDATE withdrawals SET status = 'paid', decided_by = ${me.id}, decided_at = now() WHERE id = ${id} AND status = 'pending' RETURNING id`;
  if (!d) back("Хүсэлт шийдвэрлэгдсэн байна", false, "withdraw");
  const period = currentPeriod();
  const tax = Math.round(w.amount * INCOME_TAX);
  await insertRow({ account: "wallet", user_id: w.user_id, kind: "withdrawal", delta: -w.amount, period, ref_id: id, created_by: me.id });
  if (tax) await insertRow({ account: "out", user_id: w.user_id, kind: "tax_withheld", delta: tax, period, ref_id: id, created_by: me.id });
  await insertRow({ account: "out", user_id: w.user_id, kind: "payout", delta: w.amount - tax, period, ref_id: id, created_by: me.id });
  await notify({ userId: w.user_id, kind: "withdraw_ok", note: `${fmtMnt(w.amount - tax)} шилжүүлсэн · татвар ${fmtMnt(tax)}` });
  await audit({ actorId: me.id, category: "money", action: `Хэтэвчээс шилжүүлсэн ${fmtMnt(w.amount)}`, targetType: "user", targetId: w.user_id, targetLabel: label(w) });
  revalidatePath("/admin/finance");
  back(`${label(w)}: ${fmtMnt(w.amount - tax)} шилжүүлсэн гэж тэмдэглэлээ`, true, "withdraw");
}

export async function rejectWithdrawal(formData) {
  const me = await requireSuper("finance");
  const id = Number(formData.get("id"));
  const note = String(formData.get("note") || "").trim().slice(0, 300);
  if (!note) back("Буцаах шалтгаанаа бичнэ үү", false, "withdraw");
  const [w] = await sql`UPDATE withdrawals SET status = 'rejected', note = ${note}, decided_by = ${me.id}, decided_at = now()
                        WHERE id = ${id} AND status = 'pending' RETURNING user_id`;
  if (!w) back("Хүсэлт олдсонгүй", false, "withdraw");
  await notify({ userId: w.user_id, kind: "withdraw_no", note });
  await audit({ actorId: me.id, category: "money", action: `Татах хүсэлт буцаасан (${note})`, targetType: "user", targetId: w.user_id });
  revalidatePath("/admin/finance");
  back("Буцаалаа", true, "withdraw");
}

// Сар хаах: дууссан сарын шилдэг 10, Шинэ одыг тооцож сангаас хэтэвчид шилжүүлнэ.
// Шагнал хуваарилахын өмнө редакц хуурамч очийг шалгасан байх ёстой (7 хоног).
export async function closeMonth(formData) {
  const me = await requireSuper("finance");
  const period = String(formData.get("period") || "");
  if (!validPeriod(period) || period >= currentPeriod()) back("Зөвхөн дууссан сарыг хаана", false, "close");
  if ((await sql`SELECT 1 FROM prizes WHERE period = ${period} LIMIT 1`).length) back(`${periodLabel(period)} аль хэдийн хаагдсан`, false, "close");
  const pool = await poolBalance();
  if (pool <= 0) back("Шагналын сан хоосон байна", false, "close");
  const winners = splitPrizes(await monthBoard(period, 100), pool).filter((w) => w.amount > 0);
  if (!winners.length) back("Шагнал авах бичээч алга", false, "close");
  const now = currentPeriod();
  for (const w of winners) {
    const r = await sql`INSERT INTO prizes (period, user_id, rank, kind, sparks, mult, amount)
                        VALUES (${period}, ${w.id}, ${w.rank}, ${w.kind}, ${w.sparks}, ${w.mult}, ${w.amount})
                        ON CONFLICT DO NOTHING RETURNING user_id`;
    if (!r.length) continue;
    const note = `${periodLabel(period)} · ${w.kind === "star" ? "Шинэ од" : `${w.rank}-р байр`}`;
    await insertRow({ account: "pool", user_id: w.id, kind: "prize", delta: -w.amount, period: now, note, created_by: me.id });
    await insertRow({ account: "wallet", user_id: w.id, kind: "prize", delta: w.amount, period: now, note, created_by: me.id });
    await notify({ userId: w.id, kind: "prize", note: `${note} · ${fmtMnt(w.amount)}` });
  }
  await audit({ actorId: me.id, category: "money", action: `${periodLabel(period)} хаасан: ${winners.length} бичээчид ${fmtMnt(winners.reduce((a, w) => a + w.amount, 0))}` });
  revalidatePath("/san");
  back(`${periodLabel(period)} хаагдлаа`, true, "close");
}
