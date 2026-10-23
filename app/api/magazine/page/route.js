import { getUser, isSuperAdmin } from "@/lib/auth";
import { sql, ensureSchema } from "@/lib/db";
import { canSeeMagazine, visibleStatuses, hasIssueAccess, freePages, readPage } from "@/lib/magazine";

export const dynamic = "force-dynamic";

const no = (msg, status) => new Response(msg, { status, headers: { "Cache-Control": "no-store" } });

// Сэтгүүлийн нэг хуудасны зураг. Эхний үнэгүй хуудсууд, арын хавтас (сүүлийн хуудас)-аас бусдыг зөвхөн худалдаж авсан хүн (эсвэл редакц) үзнэ.
// Зургийг шинэ цонхонд шууд нээж хадгалахаас сэргийлж, зөвхөн хуудсан доторх <img>-ээр ачаалахыг зөвшөөрнө.
export async function GET(req) {
  const u = new URL(req.url);
  const issueId = Number(u.searchParams.get("i"));
  const page = Number(u.searchParams.get("p"));
  if (!Number.isInteger(issueId) || !Number.isInteger(page) || issueId <= 0 || page <= 0) return no("Олдсонгүй", 404);
  if (req.headers.get("sec-fetch-dest") === "document") return no("Сэтгүүлийг сайт дээрээс уншина уу", 403);
  const user = await getUser();
  if (!canSeeMagazine(user)) return no("Олдсонгүй", 404);
  await ensureSchema();
  const [issue] = await sql`
    SELECT i.id, i.price_mnt, i.preview_pages, i.pages, un.user_id IS NOT NULL AS unlocked
    FROM magazine_issues i
    LEFT JOIN magazine_unlocks un ON un.issue_id = i.id AND un.user_id = ${user?.id || 0}
    WHERE i.id = ${issueId} AND i.status = ANY(${isSuperAdmin(user?.operator || user) ? ["published", "soon", "draft", "archived"] : visibleStatuses(user)})`;
  if (!issue || page > Math.max(issue.pages, 1)) return no("Олдсонгүй", 404);
  const open = page <= freePages(issue) || page === issue.pages || hasIssueAccess(user, issue, issue.unlocked);
  if (!open) return no("Энэ хуудсыг унших эрх алга", 403);
  const r = await readPage(issueId, page).catch((e) => (console.error("magazine page read failed", issueId, page, e), null));
  if (!r) return no("Хуудас ачаалж чадсангүй", 404);
  return new Response(r.body, {
    headers: {
      "Content-Type": r.mime,
      "Cache-Control": "private, max-age=3600",
      "Content-Disposition": "inline",
      // Шинэ цонхонд нээх (document) хүсэлт хөтчийн кэшээс зураг авахгүй
      Vary: "Sec-Fetch-Dest, Cookie",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
    },
  });
}

// Уншигч хаана хүртэл уншсаныг хадгална (дараа нь тэр хуудаснаас үргэлжлүүлнэ). Урьдчилж ачаалсан хуудсыг тооцохгүй.
export async function POST(req) {
  const user = await getUser();
  if (!user) return no("", 401);
  const b = await req.json().catch(() => ({}));
  const issueId = Number(b.i);
  const page = Number(b.p);
  if (!Number.isInteger(issueId) || !Number.isInteger(page) || page < 1) return no("", 400);
  await ensureSchema();
  await sql`UPDATE magazine_unlocks u SET last_page = LEAST(${page}, i.pages) FROM magazine_issues i
            WHERE i.id = u.issue_id AND u.user_id = ${user.id} AND u.issue_id = ${issueId}`.catch(() => {});
  return new Response(null, { status: 204 });
}
