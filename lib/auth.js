import crypto from "node:crypto";
import { cookies } from "next/headers";
import { sql, ensureSchema } from "./db";
import { syncTree } from "./tree";
import { levelFor, writeLevel } from "./levels";
import { loadSettings } from "./settings";

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

// Нууц үг сэргээх токен: хүснэгтгүй, гарын үсэгтэй. Одоогийн нууц үгийн хэшийг оруулж гарын үсэг зурдаг тул
// нууц үг солигдмогц хуучин линк хүчингүй болно (нэг удаагийн), 1 цагийн дараа хугацаа нь дуусна.
const RESET_TTL = 60 * 60 * 1000;
const resetKey = () => process.env.AUTH_SECRET || sha(`ss-reset:${process.env.DATABASE_URL || process.env.POSTGRES_URL || ""}`);
const resetSig = (id, exp, hash) => crypto.createHmac("sha256", resetKey()).update(`${id}.${exp}.${hash}`).digest("base64url");

export function resetToken(user) {
  const exp = Date.now() + RESET_TTL;
  return `${user.id}.${exp}.${resetSig(user.id, exp, user.password_hash)}`;
}

// Токен хүчинтэй бол хэрэглэгчийг (id, email) буцаана, үгүй бол null.
export async function checkResetToken(token) {
  const [id, exp, sig] = String(token || "").split(".");
  if (!/^\d+$/.test(id || "") || !/^\d+$/.test(exp || "") || !sig || Number(exp) < Date.now()) return null;
  await ensureSchema();
  const rows = await sql`SELECT id, email, password_hash FROM users WHERE id = ${Number(id)}`;
  if (!rows.length) return null;
  const real = Buffer.from(resetSig(id, exp, rows[0].password_hash));
  const test = Buffer.from(sig);
  return real.length === test.length && crypto.timingSafeEqual(real, test) ? rows[0] : null;
}

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
  jar.delete("ss-as");
}

// Нэвтэрсэн хэрэглэгчийг (оч, түвшний мэдээлэлтэй) буцаана, үгүй бол null.
export async function getUser() {
  // Мод: редакц баталсан нэмэлт ангиллыг санах ойд залгана (хуудас бүрт хэрэгтэй, 60 сек кэштэй)
  try { await ensureSchema(); await syncTree(sql); } catch (e) {}
  // Супер админы тохиргоо (түвшний босго, санхүүгийн дүрэм г.м.), 30 сек кэштэй
  try { await loadSettings(); } catch (e) {}
  const t = (await cookies()).get(COOKIE)?.value;
  if (!t) return null;
  const rows = await sql`
    SELECT u.id, u.email, u.initial, u.first_name, u.surname, u.avatar_id AS avatar, u.avatar_src, u.avatar_pos, u.account_type, u.role, u.perms, u.restricted_at, u.created_at, u.premium_until,
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
  admin: "Админ",
  superadmin: "Супер админ",
};

// Нийтлэл хянах эрхтэй: хянагч, админ, супер админ
export const isStaff = (u) => !!u && ["admin", "superadmin"].includes(u.role);
// Нийтлэл, мэдээ, эвент, зарлалыг зөвхөн редакц (хянагч, админ) хянана
export const canApproveEvents = isStaff;
// Нийтлэл (Түвшин 1+), мэдээ (Түвшин 2+) бичих эрх. Хянагч, редакц шууд бичнэ.
export const canWrite = (u, kind) => isStaff(u) || (!!u && levelFor(u.points || 0).n >= writeLevel(kind));
// Премиум гишүүн (сайтыг дэмжигч)
export const isPremium = (u) => !!u?.premium_until && new Date(u.premium_until) > new Date();
export const isSuperAdmin = (u) => !!u && u.role === "superadmin";
// Нийтлэгдсэн нийтлэлийг хасах, бусдын сэтгэгдэл устгах эрхтэй: админ, супер админ
export const isAdmin = (u) => !!u && ["admin", "superadmin"].includes(u.role);
// Клубийн даалгавар, тайлан батлах, очийг тогтоох
export const canApproveTasks = isAdmin;

export const displayName = (u) => (u.first_name ? `${u.initial}.${u.first_name}` : "Шинэ хэрэглэгч");
// Нэрээ оруулаагүй хэрэглэгч
export const needsName = (u) => !!u && !u.first_name;
