import { sql } from "./db";

export const CHAT_MAX = 1000;
const PAGE = 40;
const RATE = 15; // минутад бичих дээд тоо

// Мессежийг харуулахад хэрэгтэй мэдээлэлтэй нь буцаана (устгасан мессежийн бичвэрийг илгээхгүй)
const pick = (r) => ({
  id: r.id,
  body: r.deleted_at ? null : r.body,
  at: r.created_at,
  user: r.user_id ? { id: r.user_id, initial: r.initial, first_name: r.first_name, avatar: r.avatar } : null,
  role: r.role || null,
});

export async function chatMessages(clubId, { after = 0, before = 0 } = {}) {
  const a = Number(after) || 0;
  const b = Number(before) || 2147483647;
  // after өгвөл түүнээс хойшхи шинэ мессежүүд (өсөхөөр), үгүй бол сүүлийн хуудас (буурахаар)
  const rows = await sql`
    SELECT m.id, m.body, m.deleted_at, m.created_at, m.user_id, u.initial, u.first_name, u.avatar_id AS avatar, cm.role
    FROM club_messages m
    LEFT JOIN users u ON u.id = m.user_id
    LEFT JOIN club_members cm ON cm.user_id = m.user_id AND cm.club_id = m.club_id
    WHERE m.club_id = ${clubId} AND m.id > ${a} AND m.id < ${b}
    ORDER BY CASE WHEN ${a} > 0 THEN m.id ELSE -m.id END LIMIT ${PAGE + 1}`;
  const more = rows.length > PAGE;
  const list = rows.slice(0, PAGE).map(pick);
  return { messages: a ? list : list.reverse(), more: !a && more };
}

// Сүүлийн хоёр минутад устгагдсан мессежүүд (бусад хүмүүсийн дэлгэцнээс арилгахад)
export async function chatDeleted(clubId) {
  return (await sql`SELECT id FROM club_messages WHERE club_id = ${clubId} AND deleted_at > now() - interval '2 minutes'`).map((r) => r.id);
}

export async function postMessage(clubId, userId, text) {
  const body = String(text || "").replace(/\r\n?/g, "\n").replace(/\n{4,}/g, "\n\n\n").trim();
  if (!body) return { error: "Мессежээ бичнэ үү." };
  if (body.length > CHAT_MAX) return { error: `Мессеж ${CHAT_MAX} тэмдэгтээс хэтрэхгүй.` };
  const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM club_messages WHERE user_id = ${userId} AND created_at > now() - interval '1 minute'`;
  if (n >= RATE) return { error: "Хэт олон мессеж илгээлээ. Түр хүлээгээд дахин оролдоно уу." };
  const [m] = await sql`INSERT INTO club_messages (club_id, user_id, body) VALUES (${clubId}, ${userId}, ${body}) RETURNING id`;
  await markChatRead(userId, clubId, m.id);
  return { id: m.id };
}

// Өөрийнхөө мессежийг, удирдагч бол дурын мессежийг устгана
export async function deleteMessage(clubId, user, messageId, isLeader) {
  const r = await sql`
    UPDATE club_messages SET deleted_at = now()
    WHERE id = ${messageId} AND club_id = ${clubId} AND deleted_at IS NULL AND (user_id = ${user.id} OR ${!!isLeader})
    RETURNING id`;
  return r.length > 0;
}

export async function markChatRead(userId, clubId, lastId) {
  if (!lastId) return;
  await sql`INSERT INTO club_chat_reads (user_id, club_id, last_id) VALUES (${userId}, ${clubId}, ${lastId})
    ON CONFLICT (user_id, club_id) DO UPDATE SET last_id = GREATEST(club_chat_reads.last_id, EXCLUDED.last_id)`;
}

// Өөрийн клубийн чатад уншаагүй мессежийн тоо
export async function chatUnread(userId, clubId) {
  if (!userId || !clubId) return 0;
  try {
    const [r] = await sql`
      SELECT COUNT(*)::int AS n FROM club_messages m
      WHERE m.club_id = ${clubId} AND m.deleted_at IS NULL AND m.user_id IS DISTINCT FROM ${userId}
        AND m.id > COALESCE((SELECT last_id FROM club_chat_reads WHERE user_id = ${userId} AND club_id = ${clubId}), 0)
        AND m.created_at >= (SELECT joined_at FROM club_members WHERE user_id = ${userId})`;
    return r.n;
  } catch (e) {
    return 0;
  }
}
