"use server";

import crypto from "crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql, ensureSchema } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { audit } from "@/lib/admin";
import { mailReady, sendMail } from "@/lib/mail";
import { merchantOpenFor, loadMerchant, notifySupers } from "@/lib/merchant";
import { getAgreement, hashContent } from "@/lib/merchant-agreement";
import { AGREEMENT_VERSION as TERMS_VERSION } from "@/lib/agreement";

const OTP_TTL_MIN = 10;
const OTP_TRIES = 5;
const codeHash = (id, code) => crypto.createHash("sha256").update(`${id}:${code}`).digest("hex");
const maskMail = (e) => String(e).replace(/^(.)(.*)(.@.*)$/, (_, a, b, c) => a + "•".repeat(Math.min(6, b.length)) + c);

async function context() {
  const user = await getUser();
  if (!user) redirect("/login");
  if (user.is_bot || !(await merchantOpenFor(user))) redirect("/");
  await ensureSchema();
  const m = await loadMerchant({ userId: user.id });
  return { user, m };
}

async function openAgreement(m, id) {
  const a = await getAgreement(Number(id) || 0);
  if (!a || a.merchant_id !== m?.id) return null;
  return a;
}

// Гэрээ баталгаажуулах 6 оронтой кодыг хэрэглэгчийн бүртгэлтэй и-мэйл рүү илгээнэ
export async function sendAgreementCode(prev, formData) {
  const { user, m } = await context();
  const a = await openAgreement(m, formData.get("aid"));
  if (!a || a.status !== "pending_merchant" || m.status !== "approved") return { error: "Энэ гэрээг баталгаажуулах боломжгүй" };
  if (!user.email) return { error: "Таны бүртгэлд и-мэйл хаяг алга" };
  const [recent] = await sql`SELECT COUNT(*) FILTER (WHERE created_at > now() - interval '1 minute')::int AS m1,
                                    COUNT(*) FILTER (WHERE created_at > now() - interval '1 hour')::int AS h1
                             FROM agreement_otps WHERE user_id = ${user.id}`;
  if (recent.m1 > 0) return { error: "Код саяхан илгээсэн. 1 минутын дараа дахин оролдоно уу", sent: true };
  if (recent.h1 >= 5) return { error: "Хэт олон удаа код авлаа. 1 цагийн дараа оролдоно уу" };
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  const [o] = await sql`INSERT INTO agreement_otps (agreement_id, user_id, email, code_hash, expires_at)
                        VALUES (${a.id}, ${user.id}, ${user.email}, 'x', now() + make_interval(mins => ${OTP_TTL_MIN})) RETURNING id`;
  await sql`UPDATE agreement_otps SET code_hash = ${codeHash(o.id, code)} WHERE id = ${o.id}`;
  const text = `Science Spark: мерчантын гэрээ ${a.number} баталгаажуулах код: ${code}\nКод ${OTP_TTL_MIN} минут хүчинтэй. Та өөрөө хүсээгүй бол энэ захидлыг үл тоомсорлоно уу.`;
  if (mailReady()) {
    try {
      await sendMail({
        to: user.email,
        subject: `Гэрээ баталгаажуулах код: ${code}`,
        text,
        html: `<p>Мерчантын гэрээ <b>${a.number}</b> баталгаажуулах код:</p><p style="font-size:24px;font-weight:700;letter-spacing:4px">${code}</p><p>Код ${OTP_TTL_MIN} минут хүчинтэй. Та өөрөө хүсээгүй бол энэ захидлыг үл тоомсорлоно уу.</p>`,
      });
    } catch (e) {
      console.error("agreement otp mail", e.message);
      await sql`DELETE FROM agreement_otps WHERE id = ${o.id}`;
      return { error: "И-мэйл илгээж чадсангүй. Дахин оролдоно уу" };
    }
  } else if (process.env.NODE_ENV !== "production" || process.env.DEV_OTP_LOG === "1") {
    console.log(`[dev] agreement OTP for ${user.email}: ${code}`);
  } else {
    await sql`DELETE FROM agreement_otps WHERE id = ${o.id}`;
    return { error: "И-мэйл илгээх тохиргоо хийгдээгүй байна. Бидэнтэй холбогдоно уу" };
  }
  return { sent: true, ok: `Код ${maskMail(user.email)} хаяг руу илгээлээ` };
}

// Мерчант гэрээг баталгаажуулна: нэвтэрсэн хаяг + и-мэйл код + зөвшөөрлийн тэмдэглэгээ
export async function signAgreement(prev, formData) {
  const { user, m } = await context();
  const a = await openAgreement(m, formData.get("aid"));
  if (!a || a.status !== "pending_merchant" || m.status !== "approved") return { error: "Энэ гэрээг баталгаажуулах боломжгүй", sent: true };
  if (formData.get("agree") !== "on") return { error: "Гэрээ болон хэрэглэгчийн гэрээг зөвшөөрнө үү", sent: true };
  if (formData.get("hash") !== a.content_hash || hashContent(a.content) !== a.content_hash) return { error: "Гэрээний агуулга шинэчлэгдсэн байна. Хуудсаа шинэчлээд дахин уншина уу", sent: true };
  const code = String(formData.get("code") || "").replace(/\D/g, "");
  const [o] = await sql`SELECT * FROM agreement_otps WHERE agreement_id = ${a.id} AND user_id = ${user.id} AND used_at IS NULL ORDER BY id DESC LIMIT 1`;
  if (!o || new Date(o.expires_at) < new Date()) return { error: "Кодын хугацаа дууссан. Шинэ код авна уу" };
  if (o.attempts >= OTP_TRIES) return { error: "Буруу код олон удаа орууллаа. Шинэ код авна уу" };
  const good = code.length === 6 && crypto.timingSafeEqual(Buffer.from(codeHash(o.id, code)), Buffer.from(o.code_hash));
  if (!good) {
    await sql`UPDATE agreement_otps SET attempts = attempts + 1 WHERE id = ${o.id}`;
    return { error: `Код буруу байна (${OTP_TRIES - o.attempts - 1} оролдлого үлдсэн)`, sent: true };
  }
  const h = await headers();
  const ip = (h.get("x-forwarded-for") || "").split(",")[0].trim() || h.get("x-real-ip") || null;
  const ua = (h.get("user-agent") || "").slice(0, 300) || null;
  const res = await sql.transaction([
    sql`UPDATE agreement_otps SET used_at = now() WHERE id = ${o.id} AND used_at IS NULL`,
    sql`UPDATE merchant_agreements SET status = 'pending_platform', merchant_signed_at = now(), merchant_user_id = ${user.id}
        WHERE id = ${a.id} AND status = 'pending_merchant' AND content_hash = ${a.content_hash} RETURNING id`,
    sql`INSERT INTO agreement_acceptances (doc_kind, agreement_id, user_id, party, version, content_hash, method, ip, user_agent)
        SELECT 'merchant_agreement', ${a.id}, ${user.id}, 'merchant', ${a.version}, ${a.content_hash}, 'session+email_otp', ${ip}, ${ua}
        WHERE EXISTS (SELECT 1 FROM merchant_agreements WHERE id = ${a.id} AND status = 'pending_platform' AND merchant_user_id = ${user.id})`,
    sql`INSERT INTO agreement_acceptances (doc_kind, user_id, party, version, method, ip, user_agent)
        VALUES ('terms', ${user.id}, 'user', ${TERMS_VERSION}, 'session+email_otp', ${ip}, ${ua})`,
  ]);
  if (!res[1].length) return { error: "Гэрээг баталгаажуулж чадсангүй. Хуудсаа шинэчилнэ үү" };
  await notifySupers("agreement_signed", m.id, user.id, a.number);
  await audit({ actorId: user.id, category: "merchant", action: `Мерчант гэрээ ${a.number} (хувилбар ${a.version}) баталгаажуулсан`, targetType: "merchant", targetId: m.id });
  revalidatePath("/merchant");
  revalidatePath("/admin/merchants");
  redirect(`/merchant/agreement?ok=${encodeURIComponent("Баталгаажууллаа. Платформын төлөөлөгч баталгаажуулмагц гэрээ хүчин төгөлдөр болно")}`);
}
