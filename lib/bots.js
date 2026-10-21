import { sql } from "./db";

// Бот хаяг: супер админы үүсгэж удирддаг, имэйлгүй (нэвтрэх, нууц үг сэргээх боломжгүй) хувь хүний хаяг.
// Сайтад энгийн хүн шиг харагдана; бот гэдгийг зөвхөн редакц (админ, супер админ) мэднэ.
// Урамшуулал, асуултын шагнал ботын хэтэвчинд орж, супер админ ботоор ажиллан татна.
// Сарын шагналын санд бот оролцохгүй, ботын өгсөн оч тооцогдохгүй (бусад бичээчийн шагналаас хасагдахгүйн тулд).
export async function listBots() {
  return sql`
    SELECT u.id, u.initial, u.first_name, u.surname, u.avatar_id AS avatar, u.created_at, u.restricted_at,
      COALESCE((SELECT SUM(delta) FROM points_ledger WHERE user_id = u.id), 0)::int AS points,
      (SELECT COUNT(*) FROM follows f WHERE f.followee_id = u.id)::int AS followers,
      (SELECT COUNT(*) FROM posts p WHERE p.author_id = u.id AND p.status = 'published')::int AS posts,
      (SELECT COUNT(*) FROM notifications n WHERE n.user_id = u.id AND n.read_at IS NULL)::int AS unread,
      b.initial AS by_initial, b.first_name AS by_first
    FROM users u LEFT JOIN users b ON b.id = u.bot_by
    WHERE u.is_bot ORDER BY u.id DESC`;
}
