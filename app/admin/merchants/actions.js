"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireSection, audit } from "@/lib/admin";
import { realUser } from "@/lib/auth";
import { loadSettings, saveSettings } from "@/lib/settings";
import { loadMerchant, logStatus, notifyMerchant } from "@/lib/merchant";
import { MERCHANT_STATUS, merchantName } from "@/lib/merchant-shared";

// Мерчантыг зөвхөн супер админ шалгаж батална (Админ > Мерчант)
async function requireSuper() {
  const me = realUser(await requireSection("merchants"));
  if (me.role !== "superadmin") redirect("/admin");
  return me;
}

const clean = (v, n) => String(v || "").trim().slice(0, n);
const back = (path, key, msg) => redirect(`${path}${path.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(msg)}`);
const refresh = (id) => {
  revalidatePath("/admin/merchants", "layout");
  revalidatePath("/merchant");
};

// [зөвшөөрөгдөх өмнөх төлөв, шинэ төлөв, тайлбар заавал эсэх, мэдэгдлийн төрөл]
const MOVES = {
  approve: [["pending_review"], "approved", false, "merchant_ok"],
  revise: [["pending_review"], "revision_required", true, "merchant_fix"],
  reject: [["pending_review", "revision_required"], "rejected", true, "merchant_no"],
  suspend: [["approved"], "suspended", true, "merchant_suspended"],
  reinstate: [["suspended"], "approved", false, "merchant_reinstated"],
  terminate: [["approved", "suspended"], "terminated", true, "merchant_terminated"],
};

export async function decideMerchant(formData) {
  const me = await requireSuper();
  const id = Number(formData.get("mid")); // «id» нэртэй талбар form.id-г дарж, React товчны утгыг алдуулдаг
  const act = String(formData.get("act"));
  const note = clean(formData.get("note"), 1000) || null;
  const path = `/admin/merchants/${id}`;
  const mv = MOVES[act];
  if (!mv) back(path, "error", "Үйлдэл буруу");
  const [from, to, needNote, kind] = mv;
  const m = await loadMerchant({ id });
  if (!m) back("/admin/merchants", "error", "Мерчант олдсонгүй");
  if (!from.includes(m.status)) back(path, "error", `«${MERCHANT_STATUS[m.status][0]}» төлөвөөс ийм шийдвэр гаргах боломжгүй`);
  if (needNote && !note) back(path, "error", "Мерчантад харагдах тайлбар бичнэ үү");
  // Батлахад баталгаажсан эсвэл шалгуулж буй данс заавал байна
  if (act === "approve" && !m.bank && !m.pendingBank) back(path, "error", "Банкны данс бүртгэгдээгүй байна. Засвар хүснэ үү");

  const [u] = await sql`UPDATE merchants SET status = ${to}, review_note = ${note}, reviewed_by = ${me.id}, reviewed_at = now(),
                          approved_at = CASE WHEN ${to} = 'approved' THEN COALESCE(approved_at, now()) ELSE approved_at END, updated_at = now()
                        WHERE id = ${id} AND status = ${m.status} RETURNING id`;
  if (!u) back(path, "error", "Төлөв өөр хүн өөрчилсөн байна. Хуудсаа шинэчилнэ үү");
  // Анхны батлалтаар илгээсэн дансыг мөн баталгаажуулна
  if (act === "approve" && m.pendingBank && !m.bank) await verifyPending(m, me.id);
  await logStatus(id, m.status, to, note, me.id);
  await notifyMerchant(m, kind, me.id, note);
  await audit({ actorId: me.id, category: "merchant", action: `Мерчант: ${MERCHANT_STATUS[m.status][0]} → ${MERCHANT_STATUS[to][0]}${note ? ` (${note.slice(0, 80)})` : ""}`, targetType: "merchant", targetId: id, targetLabel: merchantName(m) });
  refresh(id);
  back(path, "ok", `${merchantName(m)}: ${MERCHANT_STATUS[to][0]}`);
}

// Шалгуулж буй дансыг баталгаажуулна: өмнөх баталгаажсан данс «сольсон» болж түүхэнд үлдэнэ
async function verifyPending(m, actorId) {
  await sql.transaction([
    sql`UPDATE merchant_bank_accounts SET status = 'replaced', replaced_at = now() WHERE merchant_id = ${m.id} AND status = 'verified'`,
    sql`UPDATE merchant_bank_accounts SET status = 'verified', verified_by = ${actorId}, verified_at = now() WHERE id = ${m.pendingBank.id} AND status = 'pending'`,
  ]);
}

export async function decideBank(formData) {
  const me = await requireSuper();
  const id = Number(formData.get("mid")); // «id» нэртэй талбар form.id-г дарж, React товчны утгыг алдуулдаг
  const act = String(formData.get("act"));
  const note = clean(formData.get("note"), 500) || null;
  const path = `/admin/merchants/${id}`;
  const m = await loadMerchant({ id });
  if (!m?.pendingBank) back(path, "error", "Шалгуулж буй данс алга");
  if (!["approved", "suspended"].includes(m.status)) back(path, "error", "Мерчантын бүртгэлийг эхлээд шийдвэрлэнэ үү");
  const label = `${m.pendingBank.bank_name} ${m.pendingBank.account_no}`;
  if (act === "verify") {
    await verifyPending(m, me.id);
    await notifyMerchant(m, "merchant_bank_ok", me.id, m.pendingBank.bank_name);
    await audit({ actorId: me.id, category: "merchant", action: `Мерчантын шинэ данс баталгаажуулсан: ${m.pendingBank.bank_name}`, targetType: "merchant", targetId: id, targetLabel: merchantName(m) });
    refresh(id);
    back(path, "ok", "Данс баталгаажлаа");
  }
  if (act === "reject") {
    if (!note) back(path, "error", "Татгалзсан шалтгааныг бичнэ үү");
    await sql`UPDATE merchant_bank_accounts SET status = 'rejected', note = ${note}, verified_by = ${me.id}, replaced_at = now() WHERE id = ${m.pendingBank.id} AND status = 'pending'`;
    await notifyMerchant(m, "merchant_bank_no", me.id, note);
    await audit({ actorId: me.id, category: "merchant", action: `Мерчантын шинэ данснаас татгалзсан: ${m.pendingBank.bank_name}`, targetType: "merchant", targetId: id, targetLabel: merchantName(m) });
    refresh(id);
    back(path, "ok", `${label}: татгалзлаа`);
  }
  back(path, "error", "Үйлдэл буруу");
}

// Мерчантын бүртгэлийг бүх хэрэглэгчид нээх / хаах (settings.merchantOpen)
export async function setMerchantOpen(formData) {
  const me = await requireSuper();
  const on = formData.get("on") === "1";
  const s = await loadSettings();
  await saveSettings({ ...s, merchantOpen: on });
  await audit({ actorId: me.id, category: "settings", action: on ? "Мерчантын бүртгэлийг нээсэн" : "Мерчантын бүртгэлийг хаасан" });
  revalidatePath("/", "layout");
  back("/admin/merchants", "ok", on ? "Мерчантын бүртгэл бүх хэрэглэгчид нээгдлээ" : "Мерчантын бүртгэлийг хаалаа");
}
