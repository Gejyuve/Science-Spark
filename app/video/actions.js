"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql, ensureSchema } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { canSeeVideos, hasAccess, sparkBalance } from "@/lib/video";

const back = (id, key, msg) => redirect(`/video/${id}?${key}=${encodeURIComponent(msg)}#watch`);

// Видеог очоор нээнэ: оч системд эргэж очих бөгөөд хэрэглэгчийн түвшин буурахгүй (нийт олсон очоор тогтоно)
export async function unlockVideo(formData) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!canSeeVideos(user)) redirect("/");
  await ensureSchema();
  const id = Number(formData.get("vid"));
  const [v] = await sql`SELECT id, price, status FROM videos WHERE id = ${id} AND status = 'ready'`;
  if (!v) redirect("/video");
  const [had] = await sql`SELECT 1 FROM video_unlocks WHERE user_id = ${user.id} AND video_id = ${id}`;
  if (hasAccess(user, v, had)) back(id, "ok", "Та энэ видеог үзэх эрхтэй");
  if (user.restricted_at) back(id, "error", "Таны эрх хязгаарлагдсан байна");
  const balance = await sparkBalance(user);
  if (balance < v.price) back(id, "error", `Оч хүрэлцэхгүй байна: ${v.price} оч хэрэгтэй, танд ${balance} оч байна`);
  // Хоёр товшилт зэрэг ирвэл нэг л удаа хасна
  await sql`INSERT INTO video_unlocks (user_id, video_id, cost) VALUES (${user.id}, ${id}, ${v.price}) ON CONFLICT DO NOTHING`;
  revalidatePath(`/video/${id}`);
  back(id, "ok", `${v.price} очоор видеог нээлээ. Сайхан үзээрэй!`);
}
