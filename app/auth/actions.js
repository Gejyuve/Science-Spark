"use server";

import { redirect } from "next/navigation";
import { sql, ensureSchema } from "@/lib/db";
import { audit } from "@/lib/admin";
import { hashPassword, verifyPassword, createSession, destroySession, getUser, resetToken, checkResetToken, verifyToken, createUser } from "@/lib/auth";
import { sendMail, mailReady, siteUrl } from "@/lib/mail";
import { loadSettings } from "@/lib/settings";
import { notify } from "@/lib/notify";

// «Асаая өө» цонх: эхлээд нэвтрэхийг оролдоно. Имэйл бүртгэлгүй бол нууц үгээ дахин бичүүлж
// баталгаажуулаад шинэ бүртгэл үүсгэж, профайл үүсгэх хуудас (/profile/edit) руу шилжүүлнэ.
// useActionState-ээр дуудагдана: { step: "login" | "confirm", error } төлөв буцаана.
export async function enter(prev, formData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const confirm = formData.get("confirm");
  const fail = (error, step = "login") => ({ step, error, email });
  if (!/^\S+@\S+\.\S+$/.test(email)) return fail("Имэйл хаяг буруу байна");
  await ensureSchema();

  const rows = await sql`SELECT id, password_hash FROM users WHERE email = ${email}`;
  if (rows.length) {
    // 15 минутад 5-аас олон буруу оролдлого хийвэл түр хаана.
    const recent = await sql`SELECT COUNT(*)::int AS n FROM login_attempts
                             WHERE email = ${email} AND created_at > now() - interval '15 minutes'`;
    if (recent[0].n >= 5) return fail("Олон удаа буруу оролдлоо. 15 минутын дараа дахин оролдоно уу");
    if (!verifyPassword(password, rows[0].password_hash)) {
      await sql`INSERT INTO login_attempts (email) VALUES (${email})`;
      await audit({ category: "login", action: "Нэвтрэх оролдлого амжилтгүй", targetType: "email", targetLabel: email.replace(/^(.{2}).*(@.*)$/, "$1***$2"), ok: false });
      return fail("Нууц үг буруу байна");
    }
    await sql`DELETE FROM login_attempts WHERE email = ${email} OR created_at < now() - interval '1 day'`;
    await createSession(rows[0].id);
    redirect("/");
  }

  // Бүртгэлгүй имэйл → шинэ бүртгэл
  if (!(await loadSettings()).registrationOpen) return fail("Энэ имэйл бүртгэлгүй байна. Шинэ бүртгэл түр хаалттай байна");
  const banned = await sql`SELECT 1 FROM banned_emails WHERE email = ${email}`;
  if (banned.length) return fail("Энэ имэйлээр бүртгүүлэх боломжгүй");

  // И-мэйл илгээх тохиргоогүй (зөвхөн локал туршилт) бол баталгаажуулалтгүйгээр шууд бүртгэнэ.
  if (!mailReady()) {
    if (password.length < 8) return fail("Энэ имэйл бүртгэлгүй байна. Шинээр асаахад нууц үг хамгийн багадаа 8 тэмдэгт байна");
    if (confirm === null) return { step: "confirm", error: null, email };
    if (String(confirm) !== password) return fail("Нууц үг таарахгүй байна. Дахин бичнэ үү", "confirm");
    const id = await createUser(email, hashPassword(password));
    if (!id) return fail("Энэ имэйл дөнгөж сая бүртгэгдлээ. Нэвтэрч орно уу");
    await createSession(id);
    redirect("/profile/edit");
  }

  // Өмнө нь бүртгүүлээд и-мэйлээ баталгаажуулаагүй: нууц үг таарвал холбоосыг дахин илгээнэ.
  const [pending] = await sql`SELECT password_hash FROM pending_signups WHERE email = ${email}`;
  if (pending && verifyPassword(password, pending.password_hash)) return sendVerify(email, pending.password_hash);

  if (password.length < 8) return fail("Энэ имэйл бүртгэлгүй байна. Шинээр асаахад нууц үг хамгийн багадаа 8 тэмдэгт байна");
  if (confirm === null) return { step: "confirm", error: null, email };
  if (String(confirm) !== password) return fail("Нууц үг таарахгүй байна. Дахин бичнэ үү", "confirm");

  // Бүртгэлийг и-мэйл баталгаажтал хүлээлгэнэ. Өөр нууц үгээр дахин бүртгүүлбэл хуучин хүсэлтийг солино
  // (хуучин холбоос хүчингүй болно), тиймээс бусдын имэйлийг «эзэлж» авах боломжгүй.
  const hash = hashPassword(password);
  await sql`DELETE FROM pending_signups WHERE created_at < now() - interval '2 days'`;
  await sql`INSERT INTO pending_signups (email, password_hash) VALUES (${email}, ${hash})
            ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, created_at = now()`;
  return sendVerify(email, hash);
}

// Баталгаажуулах холбоос илгээгээд «И-мэйлээ шалгана уу» алхмыг харуулна.
async function sendVerify(email, passwordHash) {
  const step = (error, sent = false) => ({ step: "verify", error, email, sent });
  // Нэг хаяг руу 15 минутад 3-аас олон захидал илгээхгүй.
  const key = `verify:${email}`;
  const recent = await sql`SELECT COUNT(*)::int AS n FROM login_attempts
                           WHERE email = ${key} AND created_at > now() - interval '15 minutes'`;
  if (recent[0].n >= 3) return step("Олон удаа илгээлээ. Ирсэн захидлаа шалгах эсвэл 15 минутын дараа дахин оролдоно уу");
  await sql`INSERT INTO login_attempts (email) VALUES (${key})`;
  const link = `${siteUrl()}/verify?t=${verifyToken(email, passwordHash)}`;
  try {
    await sendMail({
      to: email,
      subject: "Science Spark: и-мэйлээ баталгаажуулна уу",
      text: `Сайн байна уу!\n\nScience Spark-д бүртгүүлсэн танд баярлалаа. Бүртгэлээ идэвхжүүлэхийн тулд доорх холбоосоор орно уу (24 цагийн турш хүчинтэй):\n${link}\n\nХэрэв та бүртгүүлээгүй бол энэ захидлыг үл тоомсорлоно уу.\n\nScience Spark`,
      html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#1d2a33">
<p>Сайн байна уу!</p>
<p>Science Spark-д бүртгүүлсэн танд баярлалаа. Бүртгэлээ идэвхжүүлэхийн тулд доорх товч дээр дарна уу. Холбоос <b>24 цагийн</b> турш хүчинтэй.</p>
<p><a href="${link}" style="display:inline-block;padding:12px 22px;border-radius:24px;background:#2fbfae;color:#fff;text-decoration:none;font-weight:bold">И-мэйлээ баталгаажуулах</a></p>
<p style="color:#708c9e;font-size:13px">Хэрэв та бүртгүүлээгүй бол энэ захидлыг үл тоомсорлоно уу. Таны хаягаар бүртгэл үүсэхгүй.</p>
<p>Science Spark ✦</p></div>`,
    });
  } catch (e) {
    console.error("verify mail", e);
    return step("И-мэйл илгээж чадсангүй. Хэсэг хугацааны дараа «Дахин илгээх» товчийг дарна уу");
  }
  return step(null, true);
}

// Нууц үг сэргээх линк и-мейлээр илгээнэ. Бүртгэлтэй эсэхээс үл хамааран ижил хариу өгнө.
export async function forgotPassword(formData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const done = (q) => redirect(`/forgot?${q}`);
  if (!/^\S+@\S+\.\S+$/.test(email)) done(`error=${encodeURIComponent("Имэйл хаяг буруу байна")}`);
  if (!mailReady()) done(`error=${encodeURIComponent("И-мейл илгээх тохиргоо хараахан хийгдээгүй байна. Редакцад хандана уу")}`);
  await ensureSchema();
  // Нэг хаяг руу 15 минутад 3-аас олон линк илгээхгүй.
  const key = `reset:${email}`;
  const recent = await sql`SELECT COUNT(*)::int AS n FROM login_attempts
                           WHERE email = ${key} AND created_at > now() - interval '15 minutes'`;
  if (recent[0].n >= 3) done(`error=${encodeURIComponent("Олон удаа хүслээ. 15 минутын дараа дахин оролдоно уу")}`);
  await sql`INSERT INTO login_attempts (email) VALUES (${key})`;
  const rows = await sql`SELECT id, password_hash FROM users WHERE email = ${email}`;
  if (rows.length) {
    const link = `${siteUrl()}/reset?t=${resetToken(rows[0])}`;
    try {
      await sendMail({
        to: email,
        subject: "Science Spark: нууц үг сэргээх",
        text: `Сайн байна уу!\n\nНууц үгээ сэргээхийн тулд доорх холбоосоор орно уу (1 цагийн турш хүчинтэй):\n${link}\n\nХэрэв та энэ хүсэлтийг илгээгээгүй бол энэ захидлыг үл тоомсорлоно уу.\n\nScience Spark`,
        html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#1d2a33">
<p>Сайн байна уу!</p>
<p>Нууц үгээ сэргээхийн тулд доорх товч дээр дарна уу. Холбоос <b>1 цагийн</b> турш хүчинтэй.</p>
<p><a href="${link}" style="display:inline-block;padding:12px 22px;border-radius:24px;background:#2fbfae;color:#fff;text-decoration:none;font-weight:bold">Нууц үг сэргээх</a></p>
<p style="color:#708c9e;font-size:13px">Хэрэв та энэ хүсэлтийг илгээгээгүй бол энэ захидлыг үл тоомсорлоно уу. Таны нууц үг өөрчлөгдөхгүй.</p>
<p>Science Spark ✦</p></div>`,
      });
    } catch (e) {
      console.error("reset mail", e);
      done(`error=${encodeURIComponent("И-мейл илгээж чадсангүй. Хэсэг хугацааны дараа дахин оролдоно уу")}`);
    }  } else {
    // Бүртгүүлээд и-мэйлээ баталгаажуулаагүй бол нууц үг сэргээхийн оронд баталгаажуулах холбоосыг дахин илгээнэ.
    const [pending] = await sql`SELECT password_hash FROM pending_signups WHERE email = ${email}`;
    if (pending) await sendVerify(email, pending.password_hash);
  }
  done(`sent=${encodeURIComponent(email)}`);
}

// Сэргээх линкээр шинэ нууц үг тохируулна.
export async function resetPassword(formData) {
  const token = String(formData.get("t") || "");
  const next = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");
  const again = (msg) => redirect(`/reset?t=${encodeURIComponent(token)}&error=${encodeURIComponent(msg)}`);
  const user = await checkResetToken(token);
  if (!user) redirect("/reset");
  if (next.length < 8) again("Нууц үг хамгийн багадаа 8 тэмдэгт байна");
  if (next !== confirm) again("Нууц үг таарахгүй байна");
  await sql`UPDATE users SET password_hash = ${hashPassword(next)} WHERE id = ${user.id}`;
  // Бүх төхөөрөмж дээрх нэвтрэлтийг гаргаж, энэ төхөөрөмж дээр шинээр нэвтрүүлнэ.
  await sql`DELETE FROM sessions WHERE user_id = ${user.id}`;
  await sql`DELETE FROM login_attempts WHERE email = ${user.email}`;
  await notify({ userId: user.id, kind: "pw_changed" });
  await audit({ category: "login", action: "Нууц үг сэргээсэн", targetType: "user", targetId: user.id, targetLabel: user.email.replace(/^(.{2}).*(@.*)$/, "$1***$2") });
  await createSession(user.id);
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/");
}

export async function changePassword(formData) {
  const user = await getUser();
  if (!user) redirect("/login");
  const current = String(formData.get("current") || "");
  const next = String(formData.get("next") || "");
  const done = (msg, ok) => redirect(`/profile/edit?${ok ? "pw_ok" : "pw_error"}=${encodeURIComponent(msg)}`);
  if (next.length < 8) done("Шинэ нууц үг хамгийн багадаа 8 тэмдэгт байна");
  await ensureSchema();
  const rows = await sql`SELECT password_hash FROM users WHERE id = ${user.id}`;
  if (!rows.length || !verifyPassword(current, rows[0].password_hash)) done("Одоогийн нууц үг буруу байна");
  await sql`UPDATE users SET password_hash = ${hashPassword(next)} WHERE id = ${user.id}`;
  await notify({ userId: user.id, kind: "pw_changed" });
  // Бусад төхөөрөмж дээрх нэвтрэлтийг гаргаж, энэ төхөөрөмж дээр шинээр нэвтрүүлнэ.
  await sql`DELETE FROM sessions WHERE user_id = ${user.id}`;
  await createSession(user.id);
  done("Нууц үг солигдлоо", true);
}
