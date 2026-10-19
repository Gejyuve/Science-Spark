"use server";

import { redirect } from "next/navigation";
import { sql, ensureSchema } from "@/lib/db";
import { audit } from "@/lib/admin";
import { hashPassword, verifyPassword, createSession, destroySession, getUser } from "@/lib/auth";
import { loadSettings } from "@/lib/settings";

const back = (path, msg) => redirect(`${path}?error=${encodeURIComponent(msg)}`);

export async function register(formData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  if (!/^\S+@\S+\.\S+$/.test(email)) back("/register", "Имэйл хаяг буруу байна");
  if (password.length < 8) back("/register", "Нууц үг хамгийн багадаа 8 тэмдэгт байна");
  if (!(await loadSettings()).registrationOpen) back("/register", "Шинэ бүртгэл түр хаалттай байна");

  await ensureSchema();
  const exists = await sql`SELECT 1 FROM users WHERE email = ${email}`;
  if (exists.length) back("/register", "Энэ имэйл бүртгэлтэй байна");

  // Овог, нэрийг бүртгүүлсний дараах профайл үүсгэх хуудсанд (/profile/edit) асууна.
  const rows = await sql`
    INSERT INTO users (email, password_hash, initial, first_name)
    VALUES (${email}, ${hashPassword(password)}, '', '')
    RETURNING id`;
  await createSession(rows[0].id);
  redirect("/profile/edit");
}

export async function login(formData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  await ensureSchema();
  // 15 минутад 5-аас олон буруу оролдлого хийвэл түр хаана.
  const recent = await sql`SELECT COUNT(*)::int AS n FROM login_attempts
                           WHERE email = ${email} AND created_at > now() - interval '15 minutes'`;
  if (recent[0].n >= 5) {
    back("/login", "Олон удаа буруу оролдлоо. 15 минутын дараа дахин оролдоно уу");
  }
  const rows = await sql`SELECT id, password_hash FROM users WHERE email = ${email}`;
  if (!rows.length || !verifyPassword(password, rows[0].password_hash)) {
    await sql`INSERT INTO login_attempts (email) VALUES (${email})`;
    await audit({ category: "login", action: "Нэвтрэх оролдлого амжилтгүй", targetType: "email", targetLabel: email.replace(/^(.{2}).*(@.*)$/, "$1***$2"), ok: false });
    back("/login", "Имэйл эсвэл нууц үг буруу байна");
  }
  await sql`DELETE FROM login_attempts WHERE email = ${email} OR created_at < now() - interval '1 day'`;
  await createSession(rows[0].id);
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
  const done = (msg, ok) => redirect(`/profile?${ok ? "ok" : "error"}=${encodeURIComponent(msg)}`);
  if (next.length < 8) done("Шинэ нууц үг хамгийн багадаа 8 тэмдэгт байна");
  await ensureSchema();
  const rows = await sql`SELECT password_hash FROM users WHERE id = ${user.id}`;
  if (!rows.length || !verifyPassword(current, rows[0].password_hash)) done("Одоогийн нууц үг буруу байна");
  await sql`UPDATE users SET password_hash = ${hashPassword(next)} WHERE id = ${user.id}`;
  // Бусад төхөөрөмж дээрх нэвтрэлтийг гаргаж, энэ төхөөрөмж дээр шинээр нэвтрүүлнэ.
  await sql`DELETE FROM sessions WHERE user_id = ${user.id}`;
  await createSession(user.id);
  done("Нууц үг солигдлоо", true);
}
