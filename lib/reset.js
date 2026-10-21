import { del } from "@vercel/blob";
import { sql } from "@/lib/db";
import { blobOn } from "@/lib/images";

// Нээлтийн өмнө сайтыг шинээр эхлүүлэх: бүх хэрэглэгч, контент, клуб, оч, мөнгөний бүртгэлийг устгана.
// Үлдэх зүйл: үйлдлийг хийж буй супер админ (профайл, зурагтайгаа), хүсвэл бот хаягууд, ангилал (мод), сайтын тохиргоо.
// Буцаах боломжгүй тул эхлээд Neon дээр нөөц хуулбар (branch) авна.

// Бүрэн хоослох хүснэгтүүд (дугаарлалт нь 1-ээс эхэлнэ)
const WIPE = [
  "posts", "comments", "sparks", "saves", "post_views", "comment_likes", "term_votes", "post_revisions", "post_credits",
  "clubs", "club_members", "club_invites", "club_requests", "club_moves", "club_follows", "club_messages", "club_chat_reads", "club_points",
  "follows", "notifications", "points_ledger", "referrals",
  "logic_reports", "user_warnings", "banned_emails", "category_requests", "category_reports", "exam_attempts", "reviewer_requests",
  "money_ledger", "payment_requests", "withdrawals", "prizes", "bounties",
  "audit_log", "site_visits", "login_attempts",
];

// Устгахаас өмнө юу хэдэн ширхэг байгааг харуулна
export async function resetPreview(keepId, keepBots) {
  const [r] = await sql`
    SELECT
      (SELECT COUNT(*) FROM users WHERE id <> ${keepId} AND NOT (${keepBots} AND is_bot))::int AS users,
      (SELECT COUNT(*) FROM users WHERE is_bot)::int AS bots,
      (SELECT COUNT(*) FROM posts)::int AS posts,
      (SELECT COUNT(*) FROM comments)::int AS comments,
      (SELECT COUNT(*) FROM clubs)::int AS clubs,
      (SELECT COUNT(*) FROM images)::int AS images,
      (SELECT COUNT(*) FROM money_ledger)::int AS money,
      (SELECT COUNT(*) FROM payment_requests WHERE status = 'approved')::int AS paid`;
  return r;
}

export async function resetSite(keepId, keepBots) {
  const keep = keepBots
    ? sql`SELECT id FROM users WHERE id = ${keepId} OR is_bot`
    : sql`SELECT id FROM users WHERE id = ${keepId}`;
  const res = await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(7203115)`,
    sql.query(`TRUNCATE ${WIPE.join(", ")} RESTART IDENTITY CASCADE`),
    keepBots
      ? sql`DELETE FROM users WHERE id <> ${keepId} AND NOT is_bot`
      : sql`DELETE FROM users WHERE id <> ${keepId}`,
    sql`UPDATE users SET restricted_at = NULL, restrict_note = NULL, delete_pending_at = NULL, exam_reset_at = NULL,
               bot_by = CASE WHEN is_bot THEN ${keepId}::int ELSE NULL END`,
    // Үлдсэн хаягуудын профайл зураг, нүүр зургаас бусдыг устгана
    sql`DELETE FROM images WHERE id NOT IN (
          SELECT x FROM (
            SELECT avatar_id AS x FROM users UNION ALL SELECT avatar_src FROM users
            UNION ALL SELECT cover_id FROM profiles UNION ALL SELECT cover_src FROM profiles
          ) k WHERE x IS NOT NULL)
        RETURNING url`,
    keep,
  ]);
  const urls = res[4].map((r) => r.url).filter(Boolean);
  const kept = res[5].length;

  // Blob дахь зургийг устгана. Алдаа гарвал сайтад нөлөөлөхгүй (холбоосгүй файл л үлдэнэ)
  let blobs = 0;
  if (blobOn()) {
    for (let i = 0; i < urls.length; i += 100) {
      const part = urls.slice(i, i + 100);
      try {
        await del(part);
        blobs += part.length;
      } catch (e) {}
    }
  }
  return { images: urls.length, blobs, kept };
}
