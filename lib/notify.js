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
  rejected: "таны нийтлэлийг засвар хийхээр буцаалаа",
  reviewed: "таны нийтлэлийг хянаж зөвшөөрлөө. Одоо та өөрөө нийтлэх боломжтой",
  removed: "таны нийтлэлийг нуулаа",
  comment: "таны нийтлэлд сэтгэгдэл бичлээ",
  reply: "таны сэтгэгдэлд хариулт бичлээ",
  logic_ok: "таны мэдэгдсэн логик алдааг шийдвэрлэлээ. Баярлалаа!",
  logic_no: "таны логик алдааны мэдэгдлийг шалгаад алдаа олдсонгүй гэж үзлээ",
  follow: "таныг дагаж эхэллээ",
  reviewer_ok: "танд хянагчийн эрх нээлээ. Баяр хүргэе!",
  reviewer_no: "таны хянагчийн хүсэлтийг энэ удаад хүлээж аваагүй",
};
