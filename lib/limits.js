import { redirect } from "next/navigation";
import { sql } from "./db";
import { isPremium, isStaff } from "./auth";
import { notify } from "./notify";

// Хуваалцах үйлдлийн оч (Очны учир). Доорх утгуудыг супер админ Тохиргоо хэсгээс өөрчилнө (lib/settings.js).
// answer: бусдын асуултад хариулахад (нэг асуултад 1 удаа), ask/thought: шууд нийтлэгдэхэд,
// announce/event: редакц батлахад. Клубийн, байгууллагын нэрээр хуваалцсан бол оч нь клубт очно.
export const ACT_REWARD = { answer: 10, ask: 50, thought: 100, announce: 200, event: 500 };
export const ACT_KEY = { "Асуулт": "ask", "Бодрол": "thought", "Зарлал": "announce", "Эвент": "event" };

// Редакцын хяналтгүй шууд орох контентын өдрийн хязгаар: [энгийн хэрэглэгч, дэмжигч]. Редакцад хязгааргүй.
// Оч нь өдөрт эхний «энгийн» тоонд л олгогдоно: дэмжигч илүү их хуваалцана, гэхдээ түвшинг мөнгөөр ахиулахгүй.
export const DAILY_POST = { ask: [3, 10], thought: [3, 10], comment: [20, 100] };
export const LIMIT_LABEL = { ask: "асуулт", thought: "бодрол", comment: "сэтгэгдэл, хариулт" };
export const LIMIT_KEYS = Object.keys(DAILY_POST);

export function setActRules(s) {
  Object.assign(ACT_REWARD, s.actReward);
  for (const k of LIMIT_KEYS) DAILY_POST[k] = s.dailyPost[k];
}

const TZ = "Asia/Ulaanbaatar";

export const postLimit = (u, key) => (isStaff(u) ? Infinity : DAILY_POST[key][isPremium(u) ? 1 : 0]);

// Өнөөдөр (УБ цагаар) хуваалцсан тоо
export async function postedToday(userId, key) {
  const kind = key === "ask" ? "Асуулт" : "Бодрол";
  const [r] = key === "comment"
    ? await sql`WITH d AS (SELECT (date_trunc('day', now() AT TIME ZONE ${TZ}) AT TIME ZONE ${TZ}) AS t)
                SELECT COUNT(*)::int AS n FROM comments, d WHERE author_id = ${userId} AND created_at >= d.t`
    : await sql`WITH d AS (SELECT (date_trunc('day', now() AT TIME ZONE ${TZ}) AT TIME ZONE ${TZ}) AS t)
                SELECT COUNT(*)::int AS n FROM posts, d WHERE author_id = ${userId} AND kind = ${kind} AND created_at >= d.t`;
  return r.n;
}

// Хязгаарт хүрсэн бол нэг өдөрт нэг удаа мэдэгдээд «Очны учир» хуудасны хязгаарын хэсэг рүү хөтөлнө.
// Тэнд энгийн хэрэглэгчид Дэмжигч болж илүү ихийг хуваалцах боломжийг санал болгоно.
export async function checkPostLimit(user, key) {
  const limit = postLimit(user, key);
  if (limit === Infinity) return;
  if ((await postedToday(user.id, key)) < limit) return;
  const day = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10).replaceAll("-", ".");
  await notify({ userId: user.id, kind: "limit", note: `${day} · өдөрт ${limit} ${LIMIT_LABEL[key]}`, once: true });
  redirect(`/och?limit=${key}#limits`);
}

// Нийтлэгдсэн асуулт, бодрол, эвент, зарлалын оч. Шууд нийтлэгдэх төрөлд өдрийн эхний «энгийн» тоонд л олгоно.
// Нэг контентод нэг л удаа (reason = act:post:<id>). Олгосон бол дүнг буцаана.
export async function grantPostReward(post, { capped = true } = {}) {
  const key = ACT_KEY[post.kind];
  const amount = key ? ACT_REWARD[key] : 0;
  if (!amount) return 0;
  if (capped && DAILY_POST[key] && (await postedToday(post.author_id, key)) > DAILY_POST[key][0]) return 0;
  const reason = `act:post:${post.id}`;
  const r = post.club_id
    ? await sql`INSERT INTO club_points (club_id, delta, reason) SELECT ${post.club_id}, ${amount}, ${reason}
                WHERE NOT EXISTS (SELECT 1 FROM club_points WHERE reason = ${reason}) RETURNING id`
    : await sql`INSERT INTO points_ledger (user_id, delta, reason) SELECT ${post.author_id}, ${amount}, ${reason}
                WHERE NOT EXISTS (SELECT 1 FROM points_ledger WHERE reason = ${reason}) RETURNING id`;
  return r.length ? amount : 0;
}

// Контент устгагдах, нуугдахад хуваалцсаны очийг буцааж хасна (дахин нийтлэж оч цуглуулахаас сэргийлнэ)
export async function undoPostReward(postId) {
  const reason = `act:post:${postId}`;
  await sql`DELETE FROM points_ledger WHERE reason = ${reason}`;
  await sql`DELETE FROM club_points WHERE reason = ${reason}`;
}

// Бусдын асуултад өгсөн хариулт: нэг асуултад нэг л удаа
export async function grantAnswerReward(userId, postId) {
  const amount = ACT_REWARD.answer;
  if (!amount) return 0;
  const reason = `act:answer:${postId}`;
  const r = await sql`INSERT INTO points_ledger (user_id, delta, reason) SELECT ${userId}, ${amount}, ${reason}
                      WHERE NOT EXISTS (SELECT 1 FROM points_ledger WHERE user_id = ${userId} AND reason = ${reason}) RETURNING id`;
  return r.length ? amount : 0;
}

// Тухайн асуултад үлдсэн хариулт байхгүй болсон бол хариултын очийг хасна
export async function undoAnswerReward(userId, postId) {
  await sql`DELETE FROM points_ledger WHERE user_id = ${userId} AND reason = ${`act:answer:${postId}`}
            AND NOT EXISTS (SELECT 1 FROM comments WHERE post_id = ${postId} AND author_id = ${userId} AND parent_id IS NULL)`;
}
