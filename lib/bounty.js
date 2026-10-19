import { sql } from "./db";
import { currentPeriod } from "./spark";
import { TIP_FEE } from "./money";

// Шагналтай асуулт: асуугч хэтэвчээсээ мөнгө түгжиж, зөв хариулт өгсөн хүнийг сонгоход тэр хүний хэтэвч рүү шилжинэ.
export const BOUNTY_MIN = 1000;
export const BOUNTY_MAX = 5000000;
// Урамшууллын адил шимтгэл: шагналтай асуултаар шимтгэлгүй мөнгө шилжүүлэх зам болохоос сэргийлнэ
export const BOUNTY_FEE = TIP_FEE;
// false: бусдын хариулт ирсэн асуултыг устгаж мөнгөө буцааж авах боломжгүй (хариулт авчихаад устгахаас сэргийлнэ)
export const REFUND_AFTER_ANSWERS = false;

// Хэтэвчээс түгжинэ. Хэтэвч хүрэлцэхгүй эсвэл аль хэдийн шагналтай бол false.
// Нэг хүний түгжих үйлдлүүд ээлжилнэ (pg_advisory_xact_lock), тиймээс зэрэг дарахад давхар зарцуулахгүй.
export async function lockBounty(userId, postId, title, amount) {
  const period = currentPeriod();
  const [, rows] = await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(8101, ${userId})`,
    sql`
      WITH bal AS (SELECT COALESCE(SUM(delta), 0) AS b FROM money_ledger WHERE account = 'wallet' AND user_id = ${userId}),
      b AS (
        INSERT INTO bounties (post_id, user_id, title, amount)
        SELECT ${postId}, ${userId}, ${title}, ${amount} FROM bal WHERE bal.b >= ${amount}
        ON CONFLICT (post_id) DO NOTHING RETURNING id
      ),
      w AS (INSERT INTO money_ledger (account, user_id, kind, delta, period, ref_id)
            SELECT 'wallet', ${userId}, 'bounty_lock', ${-amount}, ${period}, id FROM b RETURNING 1),
      e AS (INSERT INTO money_ledger (account, user_id, kind, delta, period, ref_id)
            SELECT 'escrow', ${userId}, 'bounty_lock', ${amount}, ${period}, id FROM b RETURNING 1)
      SELECT id FROM b`,
  ]);
  return rows.length > 0;
}

// Хариултыг сонгоход: түгжээнээс гаргаж хариулагчийн хэтэвч рүү, шимтгэлийг сайт руу. Нэг асуулгаар, нэг л удаа.
export async function payBounty(bounty, winnerId, commentId) {
  const period = currentPeriod();
  const fee = Math.round(bounty.amount * BOUNTY_FEE);
  const rows = await sql`
    WITH b AS (
      UPDATE bounties SET status = 'awarded', winner_id = ${winnerId}, comment_id = ${commentId}, decided_at = now()
      WHERE id = ${bounty.id} AND status = 'open' RETURNING id, user_id, amount
    ),
    e AS (INSERT INTO money_ledger (account, user_id, kind, delta, period, ref_id)
          SELECT 'escrow', user_id, 'bounty_paid', -amount, ${period}, id FROM b RETURNING 1),
    w AS (INSERT INTO money_ledger (account, user_id, kind, delta, period, ref_id, note)
          SELECT 'wallet', ${winnerId}, 'bounty', amount - ${fee}, ${period}, id, ${bounty.title} FROM b RETURNING 1),
    f AS (INSERT INTO money_ledger (account, user_id, kind, delta, period, ref_id)
          SELECT 'platform', NULL, 'bounty_fee', ${fee}, ${period}, id FROM b WHERE ${fee} > 0 RETURNING 1)
    SELECT id FROM b`;
  return rows.length > 0;
}

// Асуултыг устгахад түгжээг тайлж асуугчийн хэтэвч рүү буцаана (асуултыг устгахаас өмнө дуудна)
export const refundStatement = (postId, userId) => sql`
  WITH b AS (
    UPDATE bounties SET status = 'refunded', decided_at = now()
    WHERE post_id = ${postId} AND user_id = ${userId} AND status = 'open' RETURNING id, amount
  ),
  e AS (INSERT INTO money_ledger (account, user_id, kind, delta, period, ref_id)
        SELECT 'escrow', ${userId}, 'bounty_refund', -amount, ${currentPeriod()}, id FROM b RETURNING 1),
  w AS (INSERT INTO money_ledger (account, user_id, kind, delta, period, ref_id)
        SELECT 'wallet', ${userId}, 'bounty_refund', amount, ${currentPeriod()}, id FROM b RETURNING 1)
  SELECT id, amount FROM b`;

export async function lockedBalance(userId) {
  const [r] = await sql`SELECT COALESCE(SUM(delta), 0)::bigint AS n FROM money_ledger WHERE account = 'escrow' AND user_id = ${userId}`;
  return Number(r.n);
}

// «Хэн юу гэв?» хуудасны дээд хэсэг: хариулт хүлээж буй ба бүх цаг үеийн хамгийн өндөр шагналтай асуултууд
export async function bountyBoard() {
  const base = (open) => sql`
    SELECT b.post_id, b.title, b.amount, b.status, b.created_at, b.decided_at,
           (SELECT COUNT(*) FROM comments c WHERE c.post_id = b.post_id AND c.parent_id IS NULL)::int AS answers,
           w.initial AS w_initial, w.first_name AS w_first
    FROM bounties b JOIN posts p ON p.id = b.post_id AND p.status = 'published'
    LEFT JOIN users w ON w.id = b.winner_id
    WHERE ${open}::boolean AND b.status = 'open' OR NOT ${open}::boolean AND b.status IN ('open', 'awarded')
    ORDER BY b.amount DESC, b.created_at DESC LIMIT 5`;
  const [open, top] = await Promise.all([base(true), base(false)]);
  return { open, top };
}

// Хариулт хүлээсэн хугацааны өнгө: удах тусам дулаан өнгө
export const waitTone = (d) => {
  const h = (Date.now() - new Date(d).getTime()) / 3600000;
  return h < 24 ? "w1" : h < 72 ? "w2" : "w3";
};
