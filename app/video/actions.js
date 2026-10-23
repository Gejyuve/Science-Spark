"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql, ensureSchema } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { canSeeVideos, hasAccess, sparkBalance, payVideo } from "@/lib/video";
import { walletBalance, fmtMnt } from "@/lib/money";
import { currentPeriod } from "@/lib/spark";

// Видеог очоор эсвэл хэтэвчнээс төгрөгөөр нээнэ. Зарцуулсан оч түвшинд нөлөөлөхгүй (нийт олсон очоор тогтоно).
export async function unlockVideo(formData) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!canSeeVideos(user)) redirect("/");
  await ensureSchema();
  const id = Number(formData.get("vid"));
  const method = formData.get("method") === "mnt" ? "mnt" : "spark";
  const [v] = await sql`SELECT id, title, price, price_mnt, status, post_id FROM videos WHERE id = ${id} AND status = 'ready'`;
  if (!v?.post_id) redirect("/video");
  const back = (key, msg) => redirect(`/post/${v.post_id}?${key}=${encodeURIComponent(msg)}#watch`);
  const [had] = await sql`SELECT 1 FROM video_unlocks WHERE user_id = ${user.id} AND video_id = ${id}`;
  if (hasAccess(user, v, had)) back("ok", "Та энэ видеог үзэх эрхтэй. Сайхан үзээрэй!");
  if (user.restricted_at) back("error", "Таны эрх хязгаарлагдсан байна");
  if (method === "mnt") {
    if (!v.price_mnt) back("error", "Энэ видеог төгрөгөөр нээх боломжгүй");
    const bal = Number(await walletBalance(user.id));
    if (bal < v.price_mnt) back("error", `Хэтэвчинд ${fmtMnt(v.price_mnt)} хэрэгтэй, танд ${fmtMnt(bal)} байна. Хэтэвчээ цэнэглээд дахин оролдоорой`);
  } else {
    if (!v.price) back("error", "Энэ видеог очоор нээх боломжгүй");
    const bal = await sparkBalance(user);
    if (bal < v.price) back("error", `Оч хүрэлцэхгүй байна: ${v.price} оч хэрэгтэй, танд ${bal} оч байна`);
  }
  const ok = await payVideo(user.id, v, method, currentPeriod());
  if (!ok) back("error", "Нээж чадсангүй. Үлдэгдлээ шалгаад дахин оролдоно уу");
  revalidatePath(`/post/${v.post_id}`);
  back("ok", method === "mnt" ? `${fmtMnt(v.price_mnt)}-өөр видеог нээлээ. Сайт, шинжлэх ухааныг дэмжсэнд баярлалаа!` : `${v.price} очоор видеог нээлээ. Сайхан үзээрэй!`);
}
