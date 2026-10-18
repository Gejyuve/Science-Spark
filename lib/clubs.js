import { sql } from "./db";

// Аймгийн төв, нийслэл: газрын зураг дээрх байрлал (Figma «Клубын газрын зураг», 1100×470)
export const PLACES = [
  ["Улаанбаатар", 106.92, 47.92], ["Дархан", 105.97, 49.49], ["Эрдэнэт", 104.06, 49.03], ["Ховд", 91.64, 48.01],
  ["Мөрөн", 100.16, 49.64], ["Сайншанд", 110.14, 44.89], ["Чойбалсан", 114.53, 48.07], ["Баянхонгор", 100.72, 46.19],
  ["Өлгий", 89.97, 48.97], ["Улаангом", 92.07, 49.98], ["Улиастай", 96.84, 47.74], ["Алтай", 96.25, 46.37],
  ["Цэцэрлэг", 101.45, 47.47], ["Булган", 103.53, 48.81], ["Сүхбаатар", 106.21, 50.23], ["Зуунмод", 106.95, 47.71],
  ["Баруун-Урт", 113.28, 46.68], ["Өндөрхаан", 110.66, 47.32], ["Чойр", 109.29, 46.36], ["Мандалговь", 106.27, 45.76],
  ["Даланзадгад", 104.42, 43.57], ["Арвайхээр", 102.78, 46.27],
];
const BY = Object.fromEntries(PLACES.map(([n, lon, lat]) => [n, { lon, lat }]));
// Figma-гийн тэмдэглэгээнээс тохируулсан: 1° уртраг ≈ 24.84px, 1° өргөрөг ≈ 35.6px
export function placeXY(name) {
  const p = BY[name];
  if (!p) return null;
  return { x: 247.9 + (p.lon - 91.64) * 24.84, y: 201.2 - (p.lat - 47.92) * 35.6 };
}

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
    SELECT u.id, u.first_name, u.avatar_id AS avatar, c.aimag, c.about,
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
