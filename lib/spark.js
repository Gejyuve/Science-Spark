import { sql } from "./db";
import { isPremium } from "./auth";
import { LEVELS, levelFor, PREMIUM_SPARK_WEIGHT, PREMIUM_DAILY_BONUS, FIRST_SPARK_REWARD, WRITING_KINDS } from "./levels";

// Сарын шагналын тооцоо: хуурамч данс, найзуудын харилцан очоос хамгаална
export const GIVER_MIN_DAYS = 30; // 30 хоногоос бага настай дансны оч шагналд тооцогдохгүй
export const PAIR_CAP = 5; // нэг хүнээс нэг бичээчид сард тооцогдох дээд оч (жинтэй)
export const TOP_N = 10;
export const STAR_SHARE = 0.1; // «Шинэ од»: шилдэг 10-т ороогүй Түвшин 1-2 бичээч
export const STAR_MAX_LEVEL = 2;

const TZ = "Asia/Ulaanbaatar";

// Улаанбаатарын цагаар одоогийн сар: "2026-10"
export function currentPeriod(d = new Date()) {
  return d.toLocaleDateString("sv-SE", { timeZone: TZ }).slice(0, 7);
}
export function prevPeriod(period) {
  const [y, m] = period.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}
export const validPeriod = (p) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(p || ""));
export const periodLabel = (p) => `${p.slice(0, 4)} оны ${Number(p.slice(5))}-р сар`;

// Сар дуусах агшин (УБ = UTC+8), мс
export function periodEnd(period) {
  const [y, m] = period.split("-").map(Number);
  return Date.UTC(y, m, 1) - 8 * 3600000;
}

export const sparkWeight = (u) => (isPremium(u) ? PREMIUM_SPARK_WEIGHT : 1);
export const dailyLimit = (u) => levelFor(u.points || 0).daily + (isPremium(u) ? PREMIUM_DAILY_BONUS : 0);

// Өнөөдөр (УБ цагаар) өгсөн оч: нийтлэл, хариулт хоёуланд
export async function givenToday(userId) {
  const [r] = await sql`
    WITH d AS (SELECT (date_trunc('day', now() AT TIME ZONE ${TZ}) AT TIME ZONE ${TZ}) AS t)
    SELECT ((SELECT COUNT(*) FROM sparks, d WHERE user_id = ${userId} AND created_at >= d.t)
          + (SELECT COUNT(*) FROM comment_likes, d WHERE user_id = ${userId} AND created_at >= d.t))::int AS n`;
  return r.n;
}

// Анхны очоо өгсөн уншигчид нэг удаа урамшуулал
export async function rewardFirstSpark(userId) {
  await sql`INSERT INTO points_ledger (user_id, delta, reason)
            SELECT ${userId}, ${FIRST_SPARK_REWARD}, 'first_spark'
            WHERE NOT EXISTS (SELECT 1 FROM points_ledger WHERE user_id = ${userId} AND reason = 'first_spark')`;
}

// Сарын жагсаалт: тухайн сард нийтлэл, мэдээ, хариулт, сэтгэгдэлдээ авсан «тооцогдох оч».
// Жин: премиум оч 2. Нэг хүнээс сард PAIR_CAP хүртэл. Шинэ, хязгаарлагдсан дансны оч тооцогдохгүй.
// Түвшин 1+ бичээч л шагналд оролцоно.
export async function monthBoard(period, limit = 50) {
  const [y, m] = period.split("-").map(Number);
  const rows = await sql`
    WITH b AS (
      SELECT make_timestamptz(${y}, ${m}, 1, 0, 0, 0, ${TZ}) AS t0,
             make_timestamptz(${y}, ${m}, 1, 0, 0, 0, ${TZ}) + interval '1 month' AS t1
    ), s AS (
      SELECT p.author_id AS uid, x.user_id AS giver, x.weight, x.created_at
      FROM sparks x JOIN posts p ON p.id = x.post_id
      WHERE p.kind = ANY(${WRITING_KINDS}) AND p.status = 'published'
      UNION ALL
      SELECT c.author_id, l.user_id, l.weight, l.created_at
      FROM comment_likes l JOIN comments c ON c.id = l.comment_id
    ), pairs AS (
      SELECT s.uid, s.giver, LEAST(SUM(s.weight), ${PAIR_CAP})::int AS w
      FROM s, b, users g
      WHERE g.id = s.giver AND s.created_at >= b.t0 AND s.created_at < b.t1
        AND s.giver <> s.uid AND g.restricted_at IS NULL
        AND g.created_at <= s.created_at - make_interval(days => ${GIVER_MIN_DAYS})
      GROUP BY s.uid, s.giver
    )
    SELECT u.id, u.initial, u.first_name, u.avatar_id AS avatar, u.premium_until,
           SUM(pairs.w)::int AS sparks,
           COALESCE((SELECT SUM(delta) FROM points_ledger WHERE user_id = u.id), 0)::int AS points
    FROM pairs JOIN users u ON u.id = pairs.uid
    WHERE u.restricted_at IS NULL AND u.first_name <> ''
    GROUP BY u.id
    ORDER BY sparks DESC, u.id ASC
    LIMIT ${limit}`;
  return rows
    .map((r) => {
      const l = levelFor(r.points);
      return { ...r, level: l, mult: l.mult, score: r.sparks * l.mult };
    })
    .filter((r) => r.level.n >= 1);
}

// Шагналын хуваарилалт: шилдэг 10 сангийн 90%-ийг оноогоор (оч × түвшний жин), Шинэ од 10%.
// Дүнг доош бүхэлчилнэ; үлдэгдэл сандаа үлдэж дараа сард шилжинэ.
export function splitPrizes(board, pool) {
  const top = board.slice(0, TOP_N);
  const star = board.slice(TOP_N).find((r) => r.level.n <= STAR_MAX_LEVEL) || null;
  const topPool = star ? Math.floor(pool * (1 - STAR_SHARE)) : pool;
  const total = top.reduce((a, r) => a + r.score, 0);
  const out = top.map((r, i) => ({ ...r, rank: i + 1, kind: "top", amount: total ? Math.floor((topPool * r.score) / total) : 0 }));
  if (star) out.push({ ...star, rank: 0, kind: "star", amount: Math.floor(pool * STAR_SHARE) });
  return out;
}

export { LEVELS };
