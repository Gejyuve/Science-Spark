import crypto from "node:crypto";
import { cookies } from "next/headers";
import { sql, ensureSchema } from "./db";
import { levelFor, REVIEWER_LEVEL } from "./levels";

const COOKIE = "ss_session";
const DAYS = 30;

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pw, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(pw, stored) {
  const [salt, hash] = stored.split(":");
  const test = crypto.scryptSync(pw, salt, 64);
  const real = Buffer.from(hash, "hex");
  return real.length === test.length && crypto.timingSafeEqual(real, test);
}

const sha = (t) => crypto.createHash("sha256").update(t).digest("hex");

export async function createSession(userId) {
  await ensureSchema();
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + DAYS * 864e5);
  await sql`DELETE FROM sessions WHERE expires_at < now()`;
  await sql`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (${sha(token)}, ${userId}, ${expires.toISOString()})`;
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const t = jar.get(COOKIE)?.value;
  if (t) {
    await ensureSchema();
    await sql`DELETE FROM sessions WHERE token_hash = ${sha(t)}`;
  }
  jar.delete(COOKIE);
}

// Нэвтэрсэн хэрэглэгчийг (оч, түвшний мэдээлэлтэй) буцаана, үгүй бол null.
export async function getUser() {
  const t = (await cookies()).get(COOKIE)?.value;
  if (!t) return null;
  await ensureSchema();
  const rows = await sql`
    SELECT u.id, u.email, u.initial, u.first_name, u.surname, u.avatar_id AS avatar, u.avatar_src, u.avatar_pos, u.account_type, u.role, u.perms, u.restricted_at, u.created_at,
           COALESCE((SELECT SUM(delta) FROM points_ledger WHERE user_id = u.id), 0)::int AS points
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${sha(t)} AND s.expires_at > now()`;
  const user = rows[0] || null;
  if (!user) return null;
  const listed = superAdminEmails().includes(user.email.toLowerCase());
  if (listed && user.role !== "superadmin") {
    await sql`UPDATE users SET role = 'superadmin' WHERE id = ${user.id}`;
    user.role = "superadmin";
  } else if (!listed && user.role === "superadmin") {
    // Жагсаалтаас хасагдсан бол супер админ эрх шууд цуцлагдана.
    await sql`UPDATE users SET role = 'user' WHERE id = ${user.id}`;
    user.role = "user";
  }
  return user;
}

// Супер админ зөвхөн Vercel-ийн SUPER_ADMIN_EMAILS (эсвэл хуучин нэр ADMIN_EMAILS) жагсаалтаар тодорно.
// Таслалаар тусгаарлана. Админ, хянагчийг супер админ /admin хуудсаар томилно.
export function superAdminEmails() {
  return `${process.env.SUPER_ADMIN_EMAILS || ""},${process.env.ADMIN_EMAILS || ""}`
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export const ROLE_LABELS = {
  user: "Хэрэглэгч",
  reviewer: "Хянагч",
  admin: "Админ",
  superadmin: "Супер админ",
};

// Нийтлэл хянах эрхтэй: хянагч, админ, супер админ
export const isStaff = (u) => !!u && ["reviewer", "admin", "superadmin"].includes(u.role);
// "Хянах" товч: хянагч эсвэл шалгалт өгөх түвшинд хүрсэн хэрэглэгч
export const canReview = (u) => isStaff(u) || (!!u && levelFor(u.points || 0).n >= REVIEWER_LEVEL);
export const isSuperAdmin = (u) => !!u && u.role === "superadmin";
// Нийтлэгдсэн нийтлэлийг хасах, бусдын сэтгэгдэл устгах эрхтэй: админ, супер админ
export const isAdmin = (u) => !!u && ["admin", "superadmin"].includes(u.role);

export const displayName = (u) => (u.first_name ? `${u.initial}.${u.first_name}` : "Шинэ хэрэглэгч");
// Нэрээ оруулаагүй хэрэглэгч
export const needsName = (u) => !!u && !u.first_name;
