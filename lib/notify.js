import { sql } from "./db";

// Хэрэглэгчид мэдэгдэл үүсгэнэ. Өөрөө өөртөө мэдэгдэл явуулахгүй.
export async function notify({ userId, kind, actorId = null, postId = null, note = null, clubId = null }) {
  if (!userId || userId === actorId) return;
  try {
    await sql`INSERT INTO notifications (user_id, kind, actor_id, post_id, note, club_id)
              VALUES (${userId}, ${kind}, ${actorId}, ${postId}, ${note}, ${clubId})`;
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
  reviewed: "таны нийтлэлийг хянаж зөвшөөрлөө",
  approved_edited: "таны нийтлэлийг засварлаж нийтэллээ. Засварыг профайлын «Редакцаас хариу ирсэн» хэсгээс харж, санал нийлэхгүй бол гомдол гаргаж болно",
  complaint_ok: "таны гомдлыг хүлээн авч шийдвэрлэлээ",
  complaint_no: "таны гомдлыг шалгаад өөрчлөлт хийх шаардлагагүй гэж үзлээ",
  removed: "таны нийтлэлийг нуулаа",
  comment: "таны нийтлэлд сэтгэгдэл бичлээ",
  reply: "таны сэтгэгдэлд хариулт бичлээ",
  logic_ok: "таны мэдэгдсэн логик алдааг шийдвэрлэлээ. Баярлалаа!",
  logic_no: "таны логик алдааны мэдэгдлийг шалгаад алдаа олдсонгүй гэж үзлээ",
  follow: "таныг дагаж эхэллээ",
  term_ok: "таны нэмсэн үгийг баталж Толь-д орууллаа 🎉",
  term_no: "таны нэмсэн үгийг энэ удаад батлаагүй",
  term_edit: "таны нэмсэн үгийн тайлбарыг засварлалаа",
  cat_ok: "таны санал болгосон ангиллыг Мод-нд нэмлээ 🎉",
  cat_no: "таны ангиллын саналыг энэ удаад хүлээж аваагүй",
  catrep_ok: "таны мэдэгдсэн ангиллын алдааг шийдвэрлэлээ. Баярлалаа!",
  reviewer_ok: "танд хянагчийн эрх нээлээ. Баяр хүргэе!",
  reviewer_no: "таны хянагчийн хүсэлтийг энэ удаад хүлээж аваагүй",
  club_invite: "таныг клубын удирдах зөвлөлд урилаа",
  club_join: "таны клубт нэгдлээ",
  club_request: "таны клубт нэгдэх хүсэлт илгээлээ",
  club_ok: "таны клубт нэгдэх хүсэлтийг зөвшөөрлөө 🎉",
  club_no: "таны клубт нэгдэх хүсэлтийг энэ удаад зөвшөөрсөнгүй",
  tip: "таныг урамшууллаа. Таны бичсэн зүйл хэн нэгэнд урам өгчээ 🎉",
  prize: "та сарын шилдэг бичээчдийн тоонд орж шагнал хүртлээ 🎉",
  pay_ok: "таны дэмжлэгийг хүлээн авлаа. Шинжлэх ухааныг дэмжсэнд баярлалаа!",
  premium_ok: "та Дэмжигч боллоо. Шинжлэх ухааны бичээчид, залуу судлаачдыг дэмжсэнд баярлалаа!",
  topup_ok: "таны хэтэвчийг цэнэглэлээ. Одоо асуултдаа шагнал тавьж, мэдлэгээ хуваалцсан хүмүүсийг урамшуулах боломжтой 🏆",
  withdraw_ok: "таны хэтэвчээс татах хүсэлтийг шилжүүллээ",
  withdraw_no: "таны хэтэвчээс татах хүсэлтийг буцаалаа",
  edited: "таны контентыг засварлалаа. Засвар бүр контентын түүхэнд харагдана",
  merged: "таны контентыг төстэй агуулгатай контенттой нэгтгэлээ. Таны нэр бичээчдийн жагсаалтад үлдэнэ",
  warning: "танд сануулга өглөө. Дахин сануулга авбал профайл устгагдана",
  bounty_won: "таны хариултыг сонгож, асуултын шагналыг олголоо 🎉",
};

// Мэдэгдлийн ангилал (хуудасны табууд)
export const NOTIF_TABS = [
  ["", "Бүгд"],
  ["unread", "Уншаагүй"],
  ["posts", "Нийтлэл"],
  ["questions", "Асуулт"],
  ["review", "Хяналт"],
  ["system", "Систем"],
];
// Редакцаас ирэх мэдэгдэлд хүний нэр биш "Редакц" гэж харуулна
export const FROM_EDITORS = ["prize", "pay_ok", "premium_ok", "topup_ok", "withdraw_ok", "withdraw_no", "cat_ok", "cat_no", "catrep_ok", "term_ok", "term_no", "term_edit", "removed", "reviewer_ok", "reviewer_no", "logic_ok", "logic_no", "complaint_ok", "complaint_no", "warning", "edited", "merged"];

export async function listNotifications(userId, { tab = "", before = null, limit = 30 } = {}) {
  const b = Number(before) || 2147483647;
  return sql`
    SELECT n.id, n.kind, n.note, n.read_at, n.created_at, n.post_id, n.actor_id, n.club_id,
           a.initial, a.first_name, a.avatar_id AS avatar, p.title, p.kind AS post_kind,
           EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = ${userId} AND f.followee_id = n.actor_id) AS following_back
    FROM notifications n
    LEFT JOIN users a ON a.id = n.actor_id
    LEFT JOIN posts p ON p.id = n.post_id
    WHERE n.user_id = ${userId} AND n.id < ${b}
      AND (
        ${tab} = ''
        OR (${tab} = 'unread' AND n.read_at IS NULL)
        OR (${tab} = 'posts' AND p.kind IS NOT NULL AND p.kind <> 'Асуулт')
        OR (${tab} = 'questions' AND p.kind = 'Асуулт')
        OR (${tab} = 'review' AND n.kind IN ('reviewer_ok', 'reviewer_no', 'approved', 'approved_edited', 'rejected', 'reviewed'))
        OR (${tab} = 'system' AND n.kind IN ('removed', 'warning', 'edited', 'merged', 'logic_ok', 'logic_no', 'complaint_ok', 'complaint_no', 'tip', 'prize', 'pay_ok', 'premium_ok', 'topup_ok', 'withdraw_ok', 'withdraw_no', 'bounty_won'))
      )
    ORDER BY n.id DESC LIMIT ${limit}`;
}

// Мэдэгдэл дээр дарахад очих хаяг
export function notifTarget(n) {
  if (n.kind === "follow") return `/u/${n.actor_id}`;
  // Редакцын засвар, сануулгыг профайлын «Редакцаас хариу ирсэн» хэсэгт харж, гомдол, хариу бичнэ
  if (n.user_id && (n.kind === "approved_edited" || n.kind === "warning" || ((n.kind === "complaint_ok" || n.kind === "complaint_no") && !n.post_id))) return `/u/${n.user_id}?tab=replied`;
  if (["tip", "prize", "pay_ok", "premium_ok", "topup_ok", "withdraw_ok", "withdraw_no"].includes(n.kind)) return "/wallet";
  if (n.kind === "club_request") return `/club/${n.club_id}?tab=requests`;
  if (n.club_id) return `/club/${n.club_id}`;
  if (n.kind === "reviewer_ok" || n.kind === "reviewer_no") return "/review";
  if (n.kind === "cat_ok" || n.kind === "cat_no" || n.kind === "catrep_ok") return "/tree";
  if (n.post_id) return `/post/${n.post_id}${n.kind === "comment" || n.kind === "reply" ? "#comments" : ""}`;
  return "/notifications";
}
