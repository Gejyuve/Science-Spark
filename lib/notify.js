import { sql } from "./db";

// Хэрэглэгчид мэдэгдэл үүсгэнэ. Өөрөө өөртөө мэдэгдэл явуулахгүй.
// once: ижил хүнээс ижил контентод ирэх ижил мэдэгдлийг давтахгүй (оч буцааж дахин өгөх гэх мэт)
export async function notify({ userId, kind, actorId = null, postId = null, note = null, clubId = null, videoId = null, magId = null, once = false }) {
  if (!userId || userId === actorId) return;
  try {
    if (once) {
      await sql`INSERT INTO notifications (user_id, kind, actor_id, post_id, note, club_id)
                SELECT ${userId}, ${kind}, ${actorId}, ${postId}, ${note}, ${clubId}
                WHERE NOT EXISTS (SELECT 1 FROM notifications WHERE user_id = ${userId} AND kind = ${kind}
                  AND actor_id IS NOT DISTINCT FROM ${actorId}::int AND post_id IS NOT DISTINCT FROM ${postId}::int AND note IS NOT DISTINCT FROM ${note}::text)`;
    } else {
      await sql`INSERT INTO notifications (user_id, kind, actor_id, post_id, note, club_id, video_id, mag_id)
                VALUES (${userId}, ${kind}, ${actorId}, ${postId}, ${note}, ${clubId}, ${videoId}, ${magId})`;
    }
  } catch (e) {
    // Мэдэгдэл бүтэлгүйтсэн ч үндсэн үйлдлийг зогсоохгүй
  }
}

// Идэвхтэй бүх клубийн удирдагчид нэг дор мэдэгдэнэ (exceptClub — өөрийн клубт явуулахгүй)
// Шинэ даалгаврыг биелүүлэх эрхтэй ЕБС-ийн клубийн удирдагчдад л мэдэгдэнэ (Клубүүдийн код)
export async function notifyClubLeaders({ kind, actorId = null, postId = null, exceptClub = null }) {
  try {
    await sql`INSERT INTO notifications (user_id, kind, actor_id, post_id, club_id)
              SELECT c.leader_id, ${kind}, ${actorId}, ${postId}, c.id FROM clubs c
              WHERE c.kind = 'club' AND c.status = 'active' AND c.leader_id IS NOT NULL AND c.club_type = 'ЕБС'
                AND c.id IS DISTINCT FROM ${exceptClub}::int AND c.leader_id IS DISTINCT FROM ${actorId}::int`;
  } catch (e) {}
}

// Редакцын бүх гишүүнд (админ, супер админ) нэг дор мэдэгдэнэ
export async function notifyStaff({ kind, actorId = null, note = null }) {
  try {
    await sql`INSERT INTO notifications (user_id, kind, actor_id, note)
              SELECT u.id, ${kind}, ${actorId}, ${note} FROM users u
              WHERE u.role IN ('admin', 'superadmin') AND u.id IS DISTINCT FROM ${actorId}::int`;
  } catch (e) {}
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
  welcome: "-д тавтай морил! Профайлаа бүрэн бөглөж оч цуглуулаад, анхны асуулт, бодролоо хуваалцаарай",
  pw_changed: ": таны нууц үг солигдлоо. Та өөрөө солиогүй бол «Нууц үгээ мартсан уу?» хэсгээр даруй шинэчилнэ үү",
  approved: "таны нийтлэлийг баталлаа",
  rejected: "таны нийтлэлийг засвар хийхээр буцаалаа",
  approved_edited: "таны нийтлэлийг засварлаж нийтэллээ. Засварыг профайлын «Редакцаас хариу ирсэн» хэсгээс харж, санал нийлэхгүй бол гомдол гаргаж болно",
  complaint_ok: "таны гомдлыг хүлээн авч шийдвэрлэлээ",
  complaint_no: "таны гомдлыг шалгаад өөрчлөлт хийх шаардлагагүй гэж үзлээ",
  help_new: "Тусламж хэсгээс редакцад хандлаа",
  help_ok: "таны Тусламж хэсгээс илгээсэн хүсэлтийг хүлээн авч шийдвэрлэлээ. Баярлалаа!",
  help_no: "таны Тусламж хэсгээс илгээсэн хүсэлтийг шалгаад хариу өглөө",
  removed: "таны нийтлэлийг нуулаа",
  deleted: "таны контентыг нэг мөсөн устгалаа",
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
  restored: "таны нуусан нийтлэлийг сэргээж дахин нийтэллээ",
  comment_removed: "таны сэтгэгдлийг сайтын дүрэмд нийцээгүй тул устгалаа",
  spark: "таны нийтлэлд оч өглөө ⚡",
  comment_spark: "таны сэтгэгдэлд оч өглөө ⚡",
  admin_on: "танд редакцын админы эрх нээлээ. Шинжлэх ухааны контентыг хамтдаа чанартай байлгацгаая!",
  admin_off: "таны редакцын админы эрхийг хаалаа. Хамтран ажилласанд баярлалаа",
  restricted: "таны эрхийг хязгаарлалаа. Одоогоор нийтлэл, сэтгэгдэл бичих, оч өгөх боломжгүй",
  unrestricted: "таны эрхийн хязгаарлалтыг цуцаллаа. Дахин тавтай морил!",
  unflagged: "таны профайлыг устгах дарааллаас гаргаж, эрхийг тань сэргээлээ",
  points_adj: "таны очийг өөрчиллөө",
  task_new: "клубүүдэд шинэ даалгавар нэмлээ. Клубээрээ биелүүлж, оч цуглуулаарай",
  task_done: "таны клубийн нэмсэн даалгаврыг биелүүлж тайлагналаа. Даалгаврын очны хувь танай клубт орлоо 🎉",
  club_invite: "таныг клубийн удирдах зөвлөлд урилаа",
  club_join: "таны клубт нэгдлээ",
  club_request: "таны клубт нэгдэх хүсэлт илгээлээ",
  club_ok: "таны клубт нэгдэх хүсэлтийг зөвшөөрлөө 🎉",
  club_no: "таны клубт нэгдэх хүсэлтийг энэ удаад зөвшөөрсөнгүй",
  club_removed: "таныг клубийн гишүүнчлэлээс хаслаа",
  club_left: "таны клубээс гарлаа",
  club_lead_offer: "таныг клубийн шинэ удирдагч болгох санал илгээлээ",
  club_lead_ok: "клубийн удирдагчийн эрхийг хүлээн авлаа. Та одоо удирдах зөвлөлийн гишүүн",
  club_lead_no: "клубийн удирдагч болох саналаас татгалзлаа",
  tip: "таныг урамшууллаа. Таны бичсэн зүйл хэн нэгэнд урам өгчээ 🎉",
  prize: "та сарын шилдэг бичээчдийн тоонд орж шагнал хүртлээ 🎉",
  pay_no: "таны төлбөрийн хүсэлтийг цуцаллаа. Төлбөр шилжүүлсэн бол Санхүүгийн хэсэгт хандана уу",
  pay_in: "QPay-ээр төлбөр төллөө. Автоматаар баталгаажсан",
  pay_ok: "таны дэмжлэгийг хүлээн авлаа. Шинжлэх ухааныг дэмжсэнд баярлалаа!",
  premium_ok: "та Дэмжигч боллоо. Шинжлэх ухааны бичээчид, залуу судлаачдыг дэмжсэнд баярлалаа!",
  topup_ok: "таны хэтэвчийг цэнэглэлээ. Одоо асуултдаа шагнал тавьж, мэдлэгээ хуваалцсан хүмүүсийг урамшуулах боломжтой 🏆",
  withdraw_ok: "таны хэтэвчээс татах хүсэлтийг шилжүүллээ",
  withdraw_no: "таны хэтэвчээс татах хүсэлтийг буцаалаа",
  edited: "таны контентыг засварлалаа. Засвар бүр контентын түүхэнд харагдана",
  merged: "таны контентыг төстэй агуулгатай контенттой нэгтгэлээ. Таны нэр бичээчдийн жагсаалтад үлдэнэ",
  warning: "танд сануулга өглөө. Дахин сануулга авбал профайл устгагдана",
  bounty_won: "таны хариултыг сонгож, асуултын шагналыг олголоо 🎉",
  referral: "Science Spark-ийн тухай танаас сонсоод нэгдлээ. Мэдлэг түгээсэнд баярлалаа, танд урамшууллын оч олгогдлоо 🎉",
  bot_post: "нэрээр автомат даалгавар нийтлэл бичиж редакц руу илгээлээ. Уншиж засаад, ковер зургийг нь нэмнэ үү",
  earned: ": таны хуваалцсан контент нийтлэгдэж оч авлаа ✦",
  limit: ": өнөөдрийн хуваалцах хязгаартаа хүрлээ. Маргааш дахин нээгдэнэ, эсвэл Дэмжигч болж илүү ихийг хуваалцаарай ⚡",
  video_ready: ": таны оруулсан видео боловсруулагдаж, үзэхэд бэлэн боллоо 🎬",
  video_error: ": таны оруулсан видеог боловсруулж чадсангүй. Устгаад дахин оруулна уу",
  video_new: ": шинэ видео нэмэгдлээ. Дэмжигчийн сарын эрхээрээ нээж үзэх боломжтой 🎬",
  mag_new: ": сэтгүүлийн шинэ дугаар гарлаа. Эхний хуудсуудыг үнэгүй уншаад, бүтнээр нь онлайнаар уншаарай 📖",
  mag_order: "сэтгүүлийн биет хувь захиаллаа. Хүргэлтэд өгнө үү",
  mag_req: "дараагийн дугаарт байршуулах хүсэлт илгээлээ",
  mag_order_sent: "таны захиалсан сэтгүүл хүргэлтэд гарлаа 🚚",
  mag_order_done: "таны захиалсан сэтгүүл хүргэгдлээ. Сайхан уншаарай!",
  mag_order_cancel: "таны сэтгүүлийн захиалгыг цуцалж, төлсөн мөнгийг хэтэвчинд тань буцаалаа",
  mag_req_ok: "таны сэтгүүлд байршуулах хүсэлтийг хүлээн авлаа. Удахгүй тантай холбогдоно",
  mag_req_no: "таны сэтгүүлд байршуулах хүсэлтийг энэ удаад хүлээн авах боломжгүй боллоо",
  mag_req_done: "таны хүсэлтээр бэлтгэсэн нийтлэл, зар сэтгүүлд нийтлэгдлээ 🎉",
  referral_club: "Science Spark-ийн тухай танай клуб, байгууллагаас сонсоод нэгдлээ. Урамшууллын оч нь дансанд тань орлоо 🎉",
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
// Сайтаас автоматаар ирэх мэдэгдэлд "Science Spark" гэж харуулна
export const FROM_SITE = ["welcome", "pw_changed", "limit", "earned", "video_ready", "video_error", "video_new", "mag_new"];
// Редакцаас ирэх мэдэгдэлд хүний нэр биш "Редакц" гэж харуулна
export const FROM_EDITORS = ["prize", "pay_ok", "pay_no", "restored", "comment_removed", "admin_on", "admin_off", "restricted", "unrestricted", "unflagged", "points_adj", "premium_ok", "topup_ok", "withdraw_ok", "withdraw_no", "cat_ok", "cat_no", "catrep_ok", "term_ok", "term_no", "term_edit", "removed", "deleted", "logic_ok", "logic_no", "complaint_ok", "complaint_no", "help_ok", "help_no", "warning", "edited", "merged", "mag_order_sent", "mag_order_done", "mag_order_cancel", "mag_req_ok", "mag_req_no", "mag_req_done"];

export async function listNotifications(userId, { tab = "", before = null, limit = 30 } = {}) {
  const b = Number(before) || 2147483647;
  return sql`
    SELECT n.id, n.kind, n.note, n.read_at, n.created_at, n.post_id, n.actor_id, n.club_id, n.video_id, n.mag_id,
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
        OR (${tab} = 'review' AND n.kind IN ('approved', 'approved_edited', 'rejected', 'restored'))
        OR (${tab} = 'system' AND n.kind IN ('removed', 'deleted', 'comment_removed', 'warning', 'restricted', 'unrestricted', 'unflagged', 'admin_on', 'admin_off', 'points_adj', 'pay_no', 'pay_in', 'edited', 'merged', 'logic_ok', 'logic_no', 'complaint_ok', 'complaint_no', 'help_new', 'help_ok', 'help_no', 'tip', 'prize', 'pay_ok', 'premium_ok', 'topup_ok', 'withdraw_ok', 'withdraw_no', 'bounty_won', 'referral', 'referral_club', 'bot_post', 'welcome', 'pw_changed', 'earned', 'limit', 'video_ready', 'video_error', 'video_new', 'mag_new', 'mag_order', 'mag_req', 'mag_order_sent', 'mag_order_done', 'mag_order_cancel', 'mag_req_ok', 'mag_req_no', 'mag_req_done'))
      )
    ORDER BY n.id DESC LIMIT ${limit}`;
}

// Мэдэгдэл дээр дарахад очих хаяг
export function notifTarget(n) {
  // Урилгын мэдэгдэл «Нөлөөлөл» жагсаалт руу очно (шинэ гишүүн нь хамгийн дээр)
  if (n.kind === "referral" && n.user_id) return `/u/${n.user_id}/influence`;
  if (n.kind === "referral_club" && n.club_id) return `/club/${n.club_id}/influence`;
  if (n.kind === "follow" || n.kind === "referral" || n.kind === "referral_club") return `/u/${n.actor_id}`;
  // Редакцын засвар, сануулгыг профайлын «Редакцаас хариу ирсэн» хэсэгт харж, гомдол, хариу бичнэ
  // Гомдлын хариу ч мөн тэнд гомдолтойгоо хамт харагдана
  if (n.user_id && ["approved_edited", "warning", "complaint_ok", "complaint_no", "restricted"].includes(n.kind)) return `/u/${n.user_id}?tab=replied`;
  if (n.user_id && ["unrestricted", "unflagged", "points_adj", "admin_off", "deleted"].includes(n.kind)) return `/u/${n.user_id}`;
  if (n.kind === "admin_on") return "/admin";
  if (n.kind === "welcome") return "/profile/edit";
  if (n.kind === "pw_changed") return "/profile/edit#password";
  // Тусламж хэсгийн хүсэлт: редакц «Гомдол» хэсэгт шийдвэрлэж, бичсэн хүн «Миний хүсэлтүүд»-ээс хариугаа харна
  if (n.kind === "help_new") return "/admin/logic";
  if (n.kind === "help_ok" || n.kind === "help_no") return "/help#mine";
  if (n.kind === "limit") return "/och#limits";
  // Видео: бэлэн болсон, шинэ видео үзэх хуудас руу; алдаатай бол админы видео хэсэг рүү
  if (n.kind === "video_error") return "/admin/videos";
  if (n.kind === "video_ready" || n.kind === "video_new") return n.video_id ? `/video/${n.video_id}` : "/video";
  // Сэтгүүл: шинэ дугаар уншигчийн хуудас руу; захиалга, хүсэлт супер админд Админ > Сэтгүүл, хэрэглэгчид «Миний захиалга»
  if (n.kind === "mag_new") return n.mag_id ? `/magazine/${n.mag_id}` : "/magazine";
  if (n.kind === "mag_order") return "/admin/magazine?tab=orders";
  if (n.kind === "mag_req") return "/admin/magazine?tab=requests";
  if (n.kind.startsWith("mag_order_")) return "/magazine/mine";
  if (n.kind.startsWith("mag_req_")) return "/magazine/mine#requests";
  if (n.kind === "pay_in") return "/admin/finance?t=tx";
  if (["tip", "prize", "pay_ok", "pay_no", "premium_ok", "topup_ok", "withdraw_ok", "withdraw_no"].includes(n.kind)) return "/wallet";
  if ((n.kind === "task_new" || n.kind === "task_done") && n.post_id) return `/post/${n.post_id}`;
  if (n.kind === "club_request") return `/club/${n.club_id}?tab=requests`;
  if (n.kind === "club_join" || n.kind === "club_left") return `/club/${n.club_id}?tab=members`;
  if (n.club_id) return `/club/${n.club_id}`;
  if (n.kind === "cat_ok" || n.kind === "cat_no" || n.kind === "catrep_ok") return "/tree";
  if (n.post_id) return `/post/${n.post_id}${["comment", "reply", "comment_spark", "comment_removed"].includes(n.kind) ? "#comments" : ""}`;
  return "/notifications";
}
