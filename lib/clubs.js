import { sql } from "./db";

import { PLACES } from "./clubs-places";
export { PLACES };

export const PERIODS = { all: "Бүх цаг", month: "Сар", week: "7 хоног" };
const DAYS = { month: 30, week: 7 };

// ТОП-100 клуб: тухайн хугацаанд цуглуулсан очоор. Өөрчлөлт = өмнөх ижил хугацааны байрнаас хэдээр ахисан.
export async function clubBoard(period = "all") {
  const d = DAYS[period] || 0;
  const now = Date.now();
  const since = d ? new Date(now - d * 864e5).toISOString() : null;
  const prevFrom = d ? new Date(now - 2 * d * 864e5).toISOString() : null;
  const prevTo = new Date(now - (d || 7) * 864e5).toISOString();
  const rows = await sql`
    SELECT u.id, u.first_name, u.avatar_id AS avatar, c.aimag, c.about, c.lat, c.lng,
      COALESCE((SELECT SUM(delta) FROM points_ledger l WHERE l.user_id = u.id
        AND (${since}::timestamptz IS NULL OR l.created_at >= ${since}::timestamptz)), 0)::int AS pts,
      COALESCE((SELECT SUM(delta) FROM points_ledger l WHERE l.user_id = u.id
        AND l.created_at < ${prevTo}::timestamptz
        AND (${prevFrom}::timestamptz IS NULL OR l.created_at >= ${prevFrom}::timestamptz)), 0)::int AS prev,
      COALESCE((SELECT SUM(delta) FROM points_ledger l WHERE l.user_id = u.id), 0)::int AS points,
      (SELECT COUNT(*) FROM club_members m WHERE m.club_id = u.id)::int AS members,
      (SELECT COUNT(*) FROM follows f WHERE f.followee_id = u.id)::int AS followers
    FROM users u LEFT JOIN clubs c ON c.user_id = u.id
    WHERE u.account_type = 'club' AND u.restricted_at IS NULL AND u.first_name <> ''`;
  // Өмнөх хугацаанд оч цуглуулаагүй (шинэ) клубт өөрчлөлт харуулахгүй
  const prevRank = new Map(rows.filter((r) => r.prev > 0).sort((a, b) => b.prev - a.prev || a.id - b.id).map((r, i) => [r.id, i + 1]));
  return rows
    .sort((a, b) => b.pts - a.pts || b.points - a.points || a.id - b.id)
    .slice(0, 100)
    .map((r, i) => ({ ...r, rank: i + 1, change: prevRank.has(r.id) ? prevRank.get(r.id) - (i + 1) : null }));
}
