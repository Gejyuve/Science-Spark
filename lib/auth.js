import crypto from "node:crypto";
import { cookies } from "next/headers";
import { sql, ensureSchema } from "./db";

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
    SELECT u.id, u.email, u.initial, u.first_name, u.role, u.created_at,
           COALESCE((SELECT SUM(delta) FROM points_ledger WHERE user_id = u.id), 0)::int AS points
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${sha(t)} AND s.expires_at > now()`;
  return rows[0] || null;
}

export const displayName = (u) => `${u.initial}.${u.first_name}`;
