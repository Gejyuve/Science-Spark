"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql, ensureSchema } from "@/lib/db";
import { getUser, needsName } from "@/lib/auth";
import { audit } from "@/lib/admin";
import { PREMIUM_PLANS, DONATION_MIN, DONATION_MAX, WITHDRAW_MIN, payCode, walletBalance, fmtMnt } from "@/lib/money";

const go = (path, key, msg) => redirect(`${path}${path.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(msg)}`);

// Дэмжих хүсэлт: дэмжигч, сан руу хандив, бичээчид хандив. Төлбөрийн систем холбогдох хүртэл
// хэрэглэгч кодыг утгандаа бичиж шилжүүлэг хийгээд, редакц шалгаж баталгаажуулна.
// Буцаах утга: { code, amount } эсвэл { error, to? } (to: шилжих хуудас)
async function makeRequest(user, formData) {
  if (user.restricted_at) return { error: "Таны эрх хязгаарлагдсан байна" };
  const kind = String(formData.get("kind") || "");
  const anonymous = formData.get("anonymous") === "on";
  const message = String(formData.get("message") || "").trim().slice(0, 300) || null;
  let amount = 0, months = null, writerId = null, postId = null;
  if (kind === "premium") {
    const plan = PREMIUM_PLANS.find((p) => p.months === Number(formData.get("months")));
    if (!plan) return { error: "Хугацаагаа сонгоно уу" };
    amount = plan.price;
    months = plan.months;
  } else if (kind === "pool" || kind === "tip") {
    // Өөр дүн бичсэн бол түүнийг, үгүй бол сонгосон товчийг авна
    const raw = String(formData.get("amount_custom") || "").trim() || String(formData.get("amount") || "");
    amount = Math.round(Number(raw.replace(/[^\d]/g, "")));
    if (!(amount >= DONATION_MIN && amount <= DONATION_MAX)) return { error: `Дүн ${fmtMnt(DONATION_MIN)}-с ${fmtMnt(DONATION_MAX)} хооронд байна` };
    if (kind === "tip") {
      writerId = Number(formData.get("writer_id"));
      const [w] = Number.isInteger(writerId) ? await sql`SELECT id FROM users WHERE id = ${writerId} AND first_name <> ''` : [];
      if (!w) return { error: "Бичээч олдсонгүй", to: "/san" };
      if (writerId === user.id) return { error: "Өөртөө хандив өгөх боломжгүй" };
      const p = Number(formData.get("post_id"));
      if (Number.isInteger(p) && p > 0) {
        const [ok] = await sql`SELECT id FROM posts WHERE id = ${p} AND author_id = ${writerId}`;
        postId = ok ? p : null;
      }
    }
  } else {
    return { error: "Буруу хүсэлт", to: "/san" };
  }
  // Нэг хүн нэг дор 5-аас олон хүлээгдэж буй хүсэлттэй байхгүй (спамаас сэргийлнэ)
  const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM payment_requests WHERE user_id = ${user.id} AND status = 'pending'`;
  if (n >= 5) return { error: "Хүлээгдэж буй 5 хүсэлт байна. Шилжүүлгээ хийх эсвэл цуцлаад дахин оролдоно уу.", to: "/wallet" };
  for (let i = 0; i < 5; i++) {
    const c = payCode();
    const r = await sql`INSERT INTO payment_requests (code, user_id, kind, writer_id, post_id, amount, months, anonymous, message)
                        VALUES (${c}, ${user.id}, ${kind}, ${writerId}, ${postId}, ${amount}, ${months}, ${anonymous}, ${message})
                        ON CONFLICT (code) DO NOTHING RETURNING code`;
    if (r.length) {
      revalidatePath("/wallet");
      return { code: c, amount };
    }
  }
  return { error: "Түр алдаа гарлаа. Дахин оролдоно уу." };
}

async function supportUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  if (needsName(user)) redirect("/profile/edit");
  await ensureSchema();
  return user;
}

// /san/support хуудасны маягт: алдаа гарвал буцааж, амжилттай бол шилжүүлгийн хуудас руу
export async function createSupport(formData) {
  const user = await supportUser();
  const r = await makeRequest(user, formData);
  if (r.error) {
    const kind = String(formData.get("kind") || "");
    const back = `/san/support?kind=${encodeURIComponent(kind)}${formData.get("writer_id") ? `&to=${Number(formData.get("writer_id"))}` : ""}`;
    go(r.to || back, "error", r.error);
  }
  redirect(`/san/pay/${r.code}`);
}

// Шагналын сангийн цонх: хуудаснаас гаралгүй дүн, кодыг буцаана
export async function startSupport(prev, formData) {
  const user = await supportUser();
  return { ...(await makeRequest(user, formData)), at: Date.now() };
}

export async function cancelSupport(formData) {
  const user = await getUser();
  if (!user) redirect("/login");
  const code = String(formData.get("code") || "");
  await sql`UPDATE payment_requests SET status = 'cancelled', decided_at = now() WHERE code = ${code} AND user_id = ${user.id} AND status = 'pending'`;
  revalidatePath("/wallet");
  go("/wallet", "ok", "Хүсэлтийг цуцаллаа");
}

// Хэтэвчээс мөнгө татах хүсэлт: доод дүнд хүрсэн үед, нэг удаад нэг хүсэлт
export async function requestWithdrawal(formData) {
  const user = await getUser();
  if (!user) redirect("/login");
  await ensureSchema();
  if (user.restricted_at) go("/wallet", "error", "Таны эрх хязгаарлагдсан байна");
  const balance = await walletBalance(user.id);
  const amount = Math.round(Number(String(formData.get("amount") || "").replace(/[^\d]/g, "")));
  const bank = String(formData.get("bank") || "").trim().replace(/\s+/g, " ").slice(0, 200);
  if (balance < WITHDRAW_MIN) go("/wallet", "error", `Хэтэвч ${fmtMnt(WITHDRAW_MIN)}-д хүрсний дараа татах боломжтой`);
  if (!(amount >= WITHDRAW_MIN && amount <= balance)) go("/wallet", "error", `Дүн ${fmtMnt(WITHDRAW_MIN)}-с ${fmtMnt(balance)} хооронд байна`);
  if (bank.length < 8) go("/wallet", "error", "Банк, дансны дугаар, эзэмшигчийн нэрээ бичнэ үү");
  const r = await sql`INSERT INTO withdrawals (user_id, amount, bank) VALUES (${user.id}, ${amount}, ${bank})
                      ON CONFLICT (user_id) WHERE status = 'pending' DO NOTHING RETURNING id`;
  if (!r.length) go("/wallet", "error", "Өмнөх хүсэлт тань шийдвэрлэгдээгүй байна");
  await audit({ actorId: user.id, category: "money", action: `Хэтэвчээс татах хүсэлт ${fmtMnt(amount)}`, targetType: "user", targetId: user.id });
  revalidatePath("/wallet");
  go("/wallet", "ok", "Хүсэлт илгээгдлээ. Редакц шалгаад шилжүүлнэ.");
}
