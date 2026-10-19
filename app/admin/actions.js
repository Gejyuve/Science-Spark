"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { notify } from "@/lib/notify";
import { requireSection, audit, WARN_LIMIT } from "@/lib/admin";
import { ROLE_LABELS } from "@/lib/auth";

const safe = (f) => (/^\/admin(\/|\?|$)/.test(f) ? f : "/admin");
const back = (path, msg, ok) => redirect(`${path}${path.includes("?") ? "&" : "?"}${ok ? "ok" : "error"}=${encodeURIComponent(msg)}`);
const label = (u) => (u.first_name ? `${u.initial}.${u.first_name}` : u.email);

async function target(id) {
  const n = Number(id);
  if (!Number.isInteger(n)) return null;
  const r = await sql`SELECT id, email, initial, first_name, role, perms, restricted_at FROM users WHERE id = ${n}`;
  return r[0] || null;
}

// Эрх солих — зөвхөн супер админ. Супер админ эрхийг зөвхөн SUPER_ADMIN_EMAILS-ээр олгоно.
export async function adminSetRole(formData) {
  const me = await requireSection("users");
  const from = safe(String(formData.get("from") || "/admin/users"));
  if (me.role !== "superadmin") back(from, "Эрх солих нь зөвхөн супер админд");
  const t = await target(formData.get("user_id"));
  const role = String(formData.get("role"));
  if (!t || !["user", "admin"].includes(role)) back(from, "Буруу хүсэлт");
  if (t.id === me.id || t.role === "superadmin") back(from, "Энэ хэрэглэгчийн эрхийг өөрчлөх боломжгүй");
  if (t.role === role) back(from, "Өөрчлөлт алга", true);
  await sql`UPDATE users SET role = ${role}, perms = '{}'
            WHERE id = ${t.id} AND role <> 'superadmin'`;
  await audit({ actorId: me.id, category: "role", action: `Эрх: ${ROLE_LABELS[t.role]} → ${ROLE_LABELS[role]}`, targetType: "user", targetId: t.id, targetLabel: label(t) });
  revalidatePath("/admin", "layout");
  back(from, "Эрх шинэчлэгдлээ", true);
}

// Хязгаарлах / сэргээх: хязгаарлагдсан хэрэглэгч нийтлэл, сэтгэгдэл бичих, оч өгөх боломжгүй
export async function restrictUser(formData) {
  const me = await requireSection("users");
  const t = await target(formData.get("user_id"));
  const from = `/admin/users/${t?.id || ""}`;
  const undo = formData.get("undo") === "1";
  const note = String(formData.get("note") || "").trim().slice(0, 500);
  if (!t) back("/admin/users", "Хэрэглэгч олдсонгүй");
  if (t.id === me.id || t.role === "superadmin") back(from, "Энэ хэрэглэгчийг хязгаарлах боломжгүй");
  if (me.role !== "superadmin") back(from, "Хязгаарлах нь зөвхөн супер админд. Админ сануулга өгнө");
  if (!undo && !note) back(from, "Хязгаарлах шалтгаанаа бичнэ үү");
  if (undo) await sql`UPDATE users SET restricted_at = NULL, restrict_note = NULL WHERE id = ${t.id}`;
  else await sql`UPDATE users SET restricted_at = now(), restrict_note = ${note} WHERE id = ${t.id}`;
  await audit({ actorId: me.id, category: "role", action: undo ? "Хязгаарлалт цуцалсан" : `Хязгаарласан (${note})`, targetType: "user", targetId: t.id, targetLabel: label(t) });
  revalidatePath("/admin", "layout");
  back(from, undo ? "Хязгаарлалт цуцлагдлаа" : "Хэрэглэгч хязгаарлагдлаа", true);
}

// Сануулга: админ, супер админ өгнө. 2 дахь сануулгаар профайл хязгаарлагдаж, устгах дараалалд орно.

export async function warnUser(formData) {
  const me = await requireSection("users");
  const t = await target(formData.get("user_id"));
  const from = `/admin/users/${t?.id || ""}`;
  const note = String(formData.get("note") || "").trim().slice(0, 500);
  if (!t) back("/admin/users", "Хэрэглэгч олдсонгүй");
  if (t.id === me.id || t.role !== "user") back(from, "Зөвхөн энгийн хэрэглэгчид сануулга өгнө");
  if (!note) back(from, "Сануулгын шалтгаанаа бичнэ үү");
  await sql`INSERT INTO user_warnings (user_id, admin_id, note) VALUES (${t.id}, ${me.id}, ${note})`;
  const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM user_warnings WHERE user_id = ${t.id}`;
  await audit({ actorId: me.id, category: "role", action: `Сануулга ${n} (${note})`, targetType: "user", targetId: t.id, targetLabel: label(t) });
  await notify({ userId: t.id, kind: "warning", actorId: me.id, note });
  if (n >= WARN_LIMIT) {
    const d = await sql`UPDATE users SET delete_pending_at = now(), restricted_at = COALESCE(restricted_at, now()),
                          restrict_note = COALESCE(restrict_note, ${"Дахин сануулга авсан: устгахаар хүлээгдэж байна"})
                        WHERE id = ${t.id} AND delete_pending_at IS NULL RETURNING id`;
    if (d.length) await audit({ actorId: me.id, category: "role", action: "Устгах дараалалд орсон (2 дахь сануулга)", targetType: "user", targetId: t.id, targetLabel: label(t) });
  }
  revalidatePath("/admin", "layout");
  back(from, n >= WARN_LIMIT ? "Сануулга өглөө. Профайл хязгаарлагдаж, супер админы устгах жагсаалтад орлоо" : "Сануулга өглөө", true);
}

// Устгах дарааллаас гаргах (сануулгууд хадгалагдана) — зөвхөн супер админ
export async function cancelDeletion(formData) {
  const me = await requireSection("users");
  const t = await target(formData.get("user_id"));
  const from = `/admin/users/${t?.id || ""}`;
  if (me.role !== "superadmin") back(from, "Зөвхөн супер админ");
  if (!t) back("/admin/users", "Хэрэглэгч олдсонгүй");
  await sql`UPDATE users SET delete_pending_at = NULL, restricted_at = NULL, restrict_note = NULL WHERE id = ${t.id}`;
  await audit({ actorId: me.id, category: "role", action: "Устгах дарааллаас гаргасан", targetType: "user", targetId: t.id, targetLabel: label(t) });
  revalidatePath("/admin", "layout");
  back(from, "Профайлыг сэргээлээ", true);
}

// Профайлыг эцэслэн устгах — зөвхөн супер админ. Имэйл хаалттай болж, дахин бүртгүүлэх боломжгүй.
export async function deleteUser(formData) {
  const me = await requireSection("users");
  const t = await target(formData.get("user_id"));
  const from = `/admin/users/${t?.id || ""}`;
  if (me.role !== "superadmin") back(from, "Хэрэглэгч устгах нь зөвхөн супер админд");
  if (!t) back("/admin/users", "Хэрэглэгч олдсонгүй");
  if (t.id === me.id || t.role === "superadmin") back(from, "Энэ хэрэглэгчийг устгах боломжгүй");
  if (String(formData.get("confirm") || "").trim().toLowerCase() !== t.email) back(from, "Баталгаажуулахын тулд имэйлийг яг бичнэ үү");
  const [w] = await sql`SELECT string_agg(note, '; ' ORDER BY created_at) AS notes FROM user_warnings WHERE user_id = ${t.id}`;
  const reason = String(formData.get("note") || "").trim().slice(0, 300) || w?.notes || "Супер админ устгасан";
  await sql.transaction([
    sql`INSERT INTO banned_emails (email, reason, banned_by) VALUES (${t.email}, ${reason}, ${me.id}) ON CONFLICT (email) DO NOTHING`,
    sql`DELETE FROM users WHERE id = ${t.id} AND role <> 'superadmin'`,
  ]);
  await audit({ actorId: me.id, category: "role", action: `Профайл устгасан, имэйл хаасан (${reason})`, targetType: "email", targetLabel: label(t) });
  revalidatePath("/", "layout");
  back("/admin/users?tab=delete", `${label(t)} устгагдлаа`, true);
}

// Оч нэмэх / хасах (торгууль). Өөртөө өгөх боломжгүй.
export async function adjustPoints(formData) {
  const me = await requireSection("users");
  if (me.role !== "superadmin") back("/admin/users", "Оч өөрчлөх нь зөвхөн супер админд");
  const from = safe(String(formData.get("from") || "/admin/users"));
  const who = String(formData.get("who") || "").trim().toLowerCase();
  const delta = Number(formData.get("delta"));
  const note = String(formData.get("note") || "").trim().slice(0, 300);
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 10000) back(from, "Очны хэмжээ -10000…10000 бүхэл тоо байна");
  if (!note) back(from, "Шалтгаанаа бичнэ үү");
  const r = /^\d+$/.test(who)
    ? await sql`SELECT id, email, initial, first_name FROM users WHERE id = ${Number(who)}`
    : await sql`SELECT id, email, initial, first_name FROM users WHERE email = ${who}`;
  const t = r[0];
  if (!t) back(from, "Хэрэглэгч олдсонгүй (ID эсвэл мэйл)");
  if (t.id === me.id) back(from, "Өөртөө оч өгөх, хасах боломжгүй");
  await sql`INSERT INTO points_ledger (user_id, delta, reason) VALUES (${t.id}, ${delta}, ${"admin:" + note})`;
  await audit({ actorId: me.id, category: "points", action: `${delta > 0 ? "+" : ""}${delta} оч (${note})`, targetType: "user", targetId: t.id, targetLabel: label(t) });
  revalidatePath("/admin", "layout");
  back(from, `${label(t)}: ${delta > 0 ? "+" : ""}${delta} оч`, true);
}

// Контент нуух / сэргээх
export async function moderatePost(formData) {
  const me = await requireSection("content");
  const from = safe(String(formData.get("from") || "/admin/content"));
  const id = Number(formData.get("post_id"));
  const op = String(formData.get("op"));
  const note = String(formData.get("note") || "").trim().slice(0, 500);
  if (!Number.isInteger(id)) back(from, "Буруу хүсэлт");
  if (op === "hide") {
    if (!note) back(from, "Нуух шалтгаанаа бичнэ үү");
    const d = await sql`UPDATE posts SET status = 'removed', reviewer_id = ${me.id}, reviewed_at = now(), review_note = ${note}
                        WHERE id = ${id} AND status = 'published' RETURNING author_id, title, kind`;
    if (!d.length) back(from, "Зөвхөн нийтлэгдсэн контентыг нууна");
    await audit({ actorId: me.id, category: "content", action: `${d[0].kind} нуусан (${note})`, targetType: "post", targetId: id, targetLabel: d[0].title });
    await notify({ userId: d[0].author_id, kind: "removed", actorId: me.id, postId: id, note });
  } else if (op === "restore") {
    const d = await sql`UPDATE posts SET status = 'published', reviewer_id = ${me.id}, reviewed_at = now(), review_note = NULL
                        WHERE id = ${id} AND status = 'removed' RETURNING title, kind`;
    if (!d.length) back(from, "Зөвхөн нуусан контентыг сэргээнэ");
    await audit({ actorId: me.id, category: "content", action: `${d[0].kind} сэргээсэн`, targetType: "post", targetId: id, targetLabel: d[0].title });
  } else if (op === "delete") {
    // Нуусан контентыг нэг мөсөн устгах — зөвхөн супер админ
    if (me.role !== "superadmin") back(from, "Нэг мөсөн устгах нь зөвхөн супер админд");
    const d = await sql`DELETE FROM posts WHERE id = ${id} AND status = 'removed' RETURNING title, kind`;
    if (!d.length) back(from, "Зөвхөн нуусан контентыг устгана");
    await audit({ actorId: me.id, category: "content", action: `${d[0].kind} нэг мөсөн устгасан`, targetType: "post", targetId: id, targetLabel: d[0].title });
  } else back(from, "Буруу хүсэлт");
  revalidatePath("/");
  revalidatePath(`/post/${id}`);
  revalidatePath("/admin", "layout");
  back(from, op === "hide" ? "Нуулаа" : op === "delete" ? "Нэг мөсөн устгалаа" : "Сэргээлээ", true);
}

// Логик алдааны мэдэгдлийг шийдвэрлэх
export async function decideLogic(formData) {
  const me = await requireSection("logic");
  const from = safe(String(formData.get("from") || "/admin/logic"));
  const id = Number(formData.get("id"));
  const op = String(formData.get("op"));
  const note = String(formData.get("note") || "").trim().slice(0, 300) || null;
  if (!Number.isInteger(id) || !["resolved", "dismissed"].includes(op)) back(from, "Буруу хүсэлт");
  const [r] = await sql`UPDATE logic_reports SET status = ${op}, note = ${note}, resolved_by = ${me.id}, resolved_at = now()
                        WHERE id = ${id} AND status = 'open' RETURNING user_id, post_id`;
  if (!r) back(from, "Энэ мэдэгдэл шийдвэрлэгдсэн байна");
  await audit({ actorId: me.id, category: "content", action: `Логик алдааны мэдэгдэл: ${op === "resolved" ? "засагдсан" : "алдаа биш"}${note ? ` (${note})` : ""}`, targetType: "post", targetId: r.post_id });
  await notify({ userId: r.user_id, kind: op === "resolved" ? "logic_ok" : "logic_no", actorId: me.id, postId: r.post_id, note });
  revalidatePath("/admin", "layout");
  back(from, "Шийдвэрлэлээ", true);
}
