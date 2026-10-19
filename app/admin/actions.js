"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { notify } from "@/lib/notify";
import { requireSection, audit } from "@/lib/admin";
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
  if (!t || !["user", "reviewer", "admin"].includes(role)) back(from, "Буруу хүсэлт");
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
  if (t.role !== "user" && me.role !== "superadmin") back(from, "Хянагч, админыг зөвхөн супер админ хязгаарлана");
  if (!undo && !note) back(from, "Хязгаарлах шалтгаанаа бичнэ үү");
  if (undo) await sql`UPDATE users SET restricted_at = NULL, restrict_note = NULL WHERE id = ${t.id}`;
  else await sql`UPDATE users SET restricted_at = now(), restrict_note = ${note} WHERE id = ${t.id}`;
  await audit({ actorId: me.id, category: "role", action: undo ? "Хязгаарлалт цуцалсан" : `Хязгаарласан (${note})`, targetType: "user", targetId: t.id, targetLabel: label(t) });
  revalidatePath("/admin", "layout");
  back(from, undo ? "Хязгаарлалт цуцлагдлаа" : "Хэрэглэгч хязгаарлагдлаа", true);
}

// Оч нэмэх / хасах (торгууль). Өөртөө өгөх боломжгүй.
export async function adjustPoints(formData) {
  const me = await requireSection("points");
  const from = safe(String(formData.get("from") || "/admin/points"));
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
  } else back(from, "Буруу хүсэлт");
  revalidatePath("/");
  revalidatePath(`/post/${id}`);
  revalidatePath("/admin", "layout");
  back(from, op === "hide" ? "Нуулаа" : "Сэргээлээ", true);
}

// Хянагчийн хүсэлт: эрх нээх эсвэл татгалзах
export async function decideRequest(formData) {
  const me = await requireSection("requests");
  const id = Number(formData.get("request_id"));
  const from = `/admin/requests/${Number.isInteger(id) ? id : ""}`;
  const op = String(formData.get("op"));
  const note = String(formData.get("note") || "").trim().slice(0, 500) || null;
  const [r] = await sql`SELECT r.id, r.user_id, r.status, u.email, u.initial, u.first_name, u.role
                        FROM reviewer_requests r JOIN users u ON u.id = r.user_id WHERE r.id = ${id}`;
  if (!r || r.status !== "pending") back(from, "Хүсэлт шийдэгдсэн эсвэл олдсонгүй");
  if (r.user_id === me.id) back(from, "Өөрийн хүсэлтийг шийдэх боломжгүй");
  if (op === "approve") {
    const u = await sql`UPDATE users SET role = 'reviewer' WHERE id = ${r.user_id} AND role = 'user' RETURNING id`;
    if (!u.length) back(from, "Энэ хэрэглэгчийн эрх аль хэдийн өөр байна");
    await sql`UPDATE reviewer_requests SET status = 'approved', decided_by = ${me.id}, decided_at = now(), note = ${note} WHERE id = ${id}`;
    await audit({ actorId: me.id, category: "role", action: "Эрх: Хэрэглэгч → Хянагч (шалгалтаар)", targetType: "user", targetId: r.user_id, targetLabel: label(r) });
    await notify({ userId: r.user_id, kind: "reviewer_ok", actorId: me.id });
  } else if (op === "decline") {
    if (!note) back(from, "Татгалзах шалтгаанаа бичнэ үү");
    await sql`UPDATE reviewer_requests SET status = 'declined', decided_by = ${me.id}, decided_at = now(), note = ${note} WHERE id = ${id}`;
    await audit({ actorId: me.id, category: "role", action: `Хянагчийн хүсэлт татгалзсан (${note})`, targetType: "user", targetId: r.user_id, targetLabel: label(r) });
    await notify({ userId: r.user_id, kind: "reviewer_no", actorId: me.id, note });
  } else back(from, "Буруу хүсэлт");
  revalidatePath("/admin", "layout");
  back(from, op === "approve" ? "Хянагчийн эрх нээлээ" : "Татгалзлаа", true);
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
