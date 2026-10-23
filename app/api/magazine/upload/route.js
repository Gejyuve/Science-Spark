import { getUser, isSuperAdmin } from "@/lib/auth";
import { sql, ensureSchema } from "@/lib/db";
import { sniff } from "@/lib/images";
import { storePage, PAGE_MAX_BYTES } from "@/lib/magazine";
import { MAX_PAGES } from "@/lib/magazine-shared";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const fail = (msg, status = 400) => Response.json({ error: msg }, { status });

// Сэтгүүлийн нэг хуудас хүлээн авна. Хөтөч PDF-ийн хуудсыг аль хэдийн WEBP зураг болгосон байна. Зөвхөн супер админ.
export async function POST(req) {
  const user = await getUser();
  if (!isSuperAdmin(user?.operator || user)) return fail("Зөвхөн супер админ", 403);
  await ensureSchema();
  let form;
  try {
    form = await req.formData();
  } catch (e) {
    return fail("Файл уншиж чадсангүй");
  }
  const issueId = Number(form.get("issue"));
  const page = Number(form.get("page"));
  if (!Number.isInteger(page) || page < 1 || page > MAX_PAGES) return fail("Хуудасны дугаар буруу");
  const [issue] = await sql`SELECT id FROM magazine_issues WHERE id = ${issueId}`;
  if (!issue) return fail("Дугаар олдсонгүй", 404);
  const file = form.get("file");
  if (!file || typeof file.arrayBuffer !== "function") return fail("Зураг алга");
  if (file.size > PAGE_MAX_BYTES) return fail("Хуудасны зураг хэт том байна");
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniff(buf);
  if (!mime) return fail("Зөвхөн JPG, PNG, WEBP");
  const w = Math.min(10000, Math.max(0, Number(form.get("w")) || 0)) || null;
  const h = Math.min(10000, Math.max(0, Number(form.get("h")) || 0)) || null;
  try {
    await storePage(issueId, page, buf, mime, w, h);
  } catch (e) {
    console.error("magazine page store failed", e?.message || e);
    return fail("Хадгалж чадсангүй. Дахин оролдоно уу", 500);
  }
  return Response.json({ ok: true });
}
