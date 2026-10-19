"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { validCategory } from "@/lib/tree";
import { sql, ensureSchema } from "@/lib/db";
import { getUser, canApproveEvents } from "@/lib/auth";
import { APPROVE_REWARD } from "@/lib/levels";
import { notify } from "@/lib/notify";
import { audit } from "@/lib/admin";
import { TASK_APPROVE_REWARD } from "@/lib/tasks-shared";

const go = (path, key, msg) => redirect(`${path}${path.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(msg)}`);

const CHECKS_POST = 5;
const CHECKS_EVENT = 6;

// Хянагчийн шийдвэр: зөвшөөрөх (засвартай байж болно) эсвэл бичээч рүү буцаах
export async function decidePost(formData) {
  const user = await getUser();
  if (!canApproveEvents(user)) redirect("/");
  if (user.restricted_at) go("/review", "error", "Таны эрх хязгаарлагдсан байна");
  await ensureSchema();
  const id = Number(formData.get("post_id"));
  if (!Number.isInteger(id)) redirect("/review");
  const back = `/review/${id}`;
  const [p] = await sql`SELECT id, author_id, kind, title, subtitle, body, status, original, category, club_id FROM posts WHERE id = ${id}`;
  if (!p || p.status !== "pending") go("/review", "error", "Энэ контент хянагдсан эсвэл олдсонгүй");
  if (p.author_id === user.id) go("/review", "error", "Өөрийн контентыг өөр хянагч хянана");
  const approve = formData.get("decision") === "approve";
  const note = String(formData.get("note") || "").trim().slice(0, 1000) || null;
  const editable = p.kind === "Нийтлэл" || p.kind === "Мэдээ";
  if (!approve) {
    if (!note) go(back, "error", "Буцаахдаа бичээчид тайлбар бичнэ үү");
    const d = await sql`UPDATE posts SET status = 'rejected', reviewer_id = ${user.id}, reviewed_at = now(), review_note = ${note}
                        WHERE id = ${id} AND status = 'pending' AND author_id <> ${user.id} RETURNING id`;
    if (d.length) {
      await audit({ actorId: user.id, category: "content", action: `${p.kind} буцаасан (${note})`, targetType: "post", targetId: id, targetLabel: p.title });
      await notify({ userId: p.author_id, kind: "rejected", actorId: user.id, postId: id, note });
    }
    revalidatePath("/review", "layout");
    go("/review", "ok", "Бичээч рүү буцаалаа");
  }

  const checks = formData.getAll("check").length;
  if (checks < (editable ? CHECKS_POST : CHECKS_EVENT)) go(back, "error", "Зөвшөөрөхийн өмнө хяналтын жагсаалтыг бүрэн тэмдэглэнэ үү");

  let title = p.title, subtitle = p.subtitle, body = p.body, original = p.original, category = p.category;
  if (editable) {
    title = String(formData.get("title") || "").trim().slice(0, 200);
    subtitle = String(formData.get("subtitle") || "").trim().slice(0, 250) || null;
    body = String(formData.get("body") || "").trim().slice(0, 40000);
    if (!title || !body) go(back, "error", "Гарчиг, агуулга хоосон байж болохгүй");
    const cat = String(formData.get("category") || "");
    if (cat && validCategory(cat)) category = cat;
    const changed = title !== p.title || (subtitle || null) !== (p.subtitle || null) || body !== p.body;
    if (changed && !original) original = { title: p.title, subtitle: p.subtitle, body: p.body };
  }
  // Нийтлэл, мэдээ: бичээч рүү буцаж, бичээч өөрөө нийтэлнэ. Эвент, зарлал: шууд нийтлэгдэнэ.
  const next = editable ? "approved" : "published";
  const d = await sql`UPDATE posts SET status = ${next}, reviewer_id = ${user.id}, reviewed_at = now(), review_note = ${note},
                        title = ${title}, subtitle = ${subtitle}, body = ${body}, category = ${category},
                        original = ${original ? JSON.stringify(original) : null}::jsonb
                      WHERE id = ${id} AND status = 'pending' AND author_id <> ${user.id} RETURNING id`;
  if (d.length) {
    await audit({ actorId: user.id, category: "content", action: `${p.kind} зөвшөөрсөн${original && !p.original ? " (засвартай)" : ""}`, targetType: "post", targetId: id, targetLabel: title });
    await notify({ userId: p.author_id, kind: editable ? "reviewed" : "approved", actorId: user.id, postId: id, note });
    // Редакц чанарыг нь баталсан нийтлэл, мэдээнд бичээчид нэг удаа оч
    // Батлагдсан даалгаварт клубт нэг удаа
    if (p.club_id) {
      await sql`INSERT INTO club_points (club_id, delta, reason)
                SELECT ${p.club_id}, ${TASK_APPROVE_REWARD}, ${"approved:post:" + id}
                WHERE NOT EXISTS (SELECT 1 FROM club_points WHERE reason = ${"approved:post:" + id})`;
    }
    const reward = APPROVE_REWARD[p.kind];
    if (reward) {
      await sql`INSERT INTO points_ledger (user_id, delta, reason)
                SELECT ${p.author_id}, ${reward}, ${"approved:post:" + id}
                WHERE NOT EXISTS (SELECT 1 FROM points_ledger WHERE reason = ${"approved:post:" + id})`;
    }
  }
  revalidatePath("/");
  revalidatePath(`/post/${id}`);
  revalidatePath("/review", "layout");
  go(editable ? "/review" : p.club_id ? "/review?t=tasks" : "/review?t=events", "ok", editable ? "Зөвшөөрлөө. Бичээч нийтлэхэд бэлэн боллоо" : "Нийтлэгдлээ");
}
