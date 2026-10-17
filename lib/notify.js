import { sql } from "./db";

// Хэрэглэгчид мэдэгдэл үүсгэнэ. Өөрөө өөртөө мэдэгдэл явуулахгүй.
export async function notify({ userId, kind, actorId = null, postId = null, note = null }) {
  if (!userId || userId === actorId) return;
  try {
    await sql`INSERT INTO notifications (user_id, kind, actor_id, post_id, note)
              VALUES (${userId}, ${kind}, ${actorId}, ${postId}, ${note})`;
  } catch (e) {
    // Мэдэгдэл бүтэлгүйтсэн ч үндсэн үйлдлийг зогсоохгүй
  }
}

export async function unreadCount(userId) {
  if (!userId) return 0;
  try {
    const r = await sql`SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = ${userId} AND read_at IS NULL`;
    return r[0].n;
  } catch (e) {
    return 0;
  }
}

export const NOTIFY_TEXT = {
  approved: "таны нийтлэлийг баталлаа",
  rejected: "таны нийтлэлээс татгалзлаа",
  removed: "таны нийтлэлийг нийтээс хаслаа",
  comment: "таны нийтлэлд сэтгэгдэл бичлээ",
  follow: "таныг дагаж эхэллээ",
};
