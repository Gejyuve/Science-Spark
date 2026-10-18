import { sql } from "./db";
import { PLACES } from "./clubs-places";
export { PLACES };

import { CLUB_CATEGORIES, BOARD_MAX, JOIN_REWARD, ORG_TYPES, COOLDOWN_MONTHS, REASON_WORDS } from "./clubs-shared";
export { CLUB_CATEGORIES, BOARD_MAX, JOIN_REWARD, ORG_TYPES, COOLDOWN_MONTHS, REASON_WORDS };

export const PERIODS = { all: "Бүх цаг", month: "Сар", week: "7 хоног" };
const DAYS = { month: 30, week: 7 };

// Клубын оч = гишүүдийн цуглуулсан очны нийлбэр
// ТОП-100: тухайн хугацааны очоор. Өөрчлөлт = өмнөх ижил хугацааны байрнаас хэдээр ахисан.
export async function clubBoard(period = "all") {
  const d = DAYS[period] || 0;
  const now = Date.now();
  const since = d ? new Date(now - d * 864e5).toISOString() : null;
  const prevFrom = d ? new Date(now - 2 * d * 864e5).toISOString() : null;
  const prevTo = new Date(now - (d || 7) * 864e5).toISOString();
  const rows = await sql`
    SELECT c.id, c.name, c.logo_id AS logo, c.city, c.about, c.lat, c.lng,
      COALESCE((SELECT SUM(l.delta) FROM points_ledger l JOIN club_members m ON m.user_id = l.user_id WHERE m.club_id = c.id
        AND (${since}::timestamptz IS NULL OR l.created_at >= ${since}::timestamptz)), 0)::int AS pts,
      COALESCE((SELECT SUM(l.delta) FROM points_ledger l JOIN club_members m ON m.user_id = l.user_id WHERE m.club_id = c.id
        AND l.created_at < ${prevTo}::timestamptz AND (${prevFrom}::timestamptz IS NULL OR l.created_at >= ${prevFrom}::timestamptz)), 0)::int AS prev,
      COALESCE((SELECT SUM(l.delta) FROM points_ledger l JOIN club_members m ON m.user_id = l.user_id WHERE m.club_id = c.id), 0)::int AS points,
      (SELECT COUNT(*) FROM club_members m WHERE m.club_id = c.id)::int AS members,
      (SELECT COUNT(*) FROM club_follows f WHERE f.club_id = c.id)::int AS followers
    FROM clubs c WHERE c.status = 'active' AND c.kind = 'club'`;
  // Өмнөх хугацаанд оч цуглуулаагүй (шинэ) клубт өөрчлөлт харуулахгүй
  const prevRank = new Map(rows.filter((r) => r.prev > 0).sort((a, b) => b.prev - a.prev || a.id - b.id).map((r, i) => [r.id, i + 1]));
  return rows
    .sort((a, b) => b.pts - a.pts || b.points - a.points || a.id - b.id)
    .slice(0, 100)
    .map((r, i) => ({ ...r, rank: i + 1, change: prevRank.has(r.id) ? prevRank.get(r.id) - (i + 1) : null }));
}

export async function clubFollowSet(viewer) {
  if (!viewer) return new Set();
  try {
    return new Set((await sql`SELECT club_id FROM club_follows WHERE user_id = ${viewer.id}`).map((r) => r.club_id));
  } catch (e) {
    return new Set();
  }
}

// Хэрэглэгч аль клубт байгаа (байхгүй бол null)
export async function membershipOf(userId) {
  if (!userId) return null;
  const r = await sql`SELECT m.club_id, m.role, m.joined_at, c.name FROM club_members m JOIN clubs c ON c.id = m.club_id WHERE m.user_id = ${userId}`;
  return r[0] || null;
}

export async function hotClubs(limit = 5) {
  return sql`
    SELECT c.id, c.name, c.logo_id AS logo,
      COALESCE((SELECT SUM(l.delta) FROM points_ledger l JOIN club_members m ON m.user_id = l.user_id WHERE m.club_id = c.id), 0)::int AS points,
      COALESCE((SELECT SUM(l.delta) FROM points_ledger l JOIN club_members m ON m.user_id = l.user_id WHERE m.club_id = c.id AND l.created_at > now() - interval '7 days'), 0)::int AS week,
      (SELECT COUNT(*) FROM club_follows f WHERE f.club_id = c.id)::int AS followers
    FROM clubs c WHERE c.status = 'active' AND c.kind = 'club'
    ORDER BY week DESC, points DESC, c.id LIMIT ${limit}`;
}

// Дахин нэгдэх хориг: сүүлд клубээс гарсан/шилжсэнээс хойш 1 сар
export async function cooldownOf(userId) {
  if (!userId) return null;
  const [m] = await sql`SELECT at, from_name FROM club_moves WHERE user_id = ${userId} ORDER BY at DESC LIMIT 1`;
  if (!m) return null;
  const since = new Date(m.at);
  const until = new Date(since);
  until.setMonth(until.getMonth() + COOLDOWN_MONTHS);
  return until > new Date() ? { since, until, from: m.from_name } : null;
}

// Анхны клубын урамшууллаас үлдсэн (шилжихэд хасагдана)
export async function rewardBalance(userId) {
  const [r] = await sql`SELECT COALESCE(SUM(delta), 0)::int AS n FROM points_ledger WHERE user_id = ${userId} AND reason IN ('club:first', 'club:switch')`;
  return r.n;
}
export async function hadFirstReward(userId) {
  return (await sql`SELECT 1 FROM points_ledger WHERE user_id = ${userId} AND reason = 'club:first'`).length > 0;
}

export const ymd = (d) => new Date(d).toLocaleDateString("sv-SE", { timeZone: "Asia/Ulaanbaatar" }).replaceAll("-", ".");
