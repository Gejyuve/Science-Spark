"use server";

import crypto from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { sql, ensureSchema } from "@/lib/db";
import { getUser, isSuperAdmin, realUser, BOT_COOKIE } from "@/lib/auth";

const COOKIE_OPTS = { path: "/", maxAge: 60 * 60 * 24 * 30, sameSite: "lax", httpOnly: true, secure: true };

async function superOnly() {
  const me = realUser(await getUser());
  if (!isSuperAdmin(me)) redirect("/");
  await ensureSchema();
  return me;
}

// Шинэ бот: шинэ хэрэглэгч бүртгүүлсэнтэй адил хоосон хаяг үүсч, супер админ шууд түүгээр профайлаа бөглөнө.
// Имэйлгүй, ашиглах боломжгүй нууц үгтэй тул хэн ч нэвтэрч чадахгүй.
export async function createBot() {
  const me = await superOnly();
  const [b] = await sql`
    INSERT INTO users (email, password_hash, initial, first_name, is_bot, bot_by)
    VALUES (NULL, ${"bot:" + crypto.randomBytes(24).toString("hex")}, '', '', true, ${me.id})
    RETURNING id`;
  (await cookies()).set(BOT_COOKIE, String(b.id), COOKIE_OPTS);
  revalidatePath("/", "layout");
  redirect("/profile/edit");
}

// Бот руу шилжих (to = ботын id) эсвэл өөрийн хаяг руу буцах (to хоосон)
export async function switchBot(fd) {
  await superOnly();
  const to = Number(fd.get("to"));
  const jar = await cookies();
  const [b] = Number.isInteger(to) && to > 0 ? await sql`SELECT id FROM users WHERE id = ${to} AND is_bot` : [];
  if (b) jar.set(BOT_COOKIE, String(b.id), COOKIE_OPTS);
  else jar.delete(BOT_COOKIE);
  jar.delete("ss-as");
  revalidatePath("/", "layout");
  const next = String(fd.get("next") || "");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : b ? "/" : "/admin/bots");
}
