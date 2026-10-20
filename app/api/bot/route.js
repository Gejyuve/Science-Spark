import crypto from "node:crypto";
import { sql, ensureSchema } from "@/lib/db";
import { notify } from "@/lib/notify";
import { NODES, syncTree, validCategory } from "@/lib/tree";
import { cleanSources, bodyRule } from "@/lib/md";

export const dynamic = "force-dynamic";

// Бот API: супер админы тохируулсан автомат даалгавар ботын нэрээр нийтлэл бичиж редакц руу илгээнэ.
// Нэг л түлхүүрээр (BOT_API_KEY) ажиллана. Энэ түлхүүрээр зөвхөн ботын нэрээр нийтлэл хянуулахаар илгээж болно:
// нийтлэх, мөнгө, хэрэглэгч, тохиргоонд хүрэхгүй. Нийтлэл редакц батлах хүртэл нийтлэгдэхгүй.
const DAILY_MAX = 6;

function authorized(req) {
  const key = process.env.BOT_API_KEY || "";
  if (key.length < 24) return false;
  const got = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const h = (s) => crypto.createHash("sha256").update(s).digest();
  return crypto.timingSafeEqual(h(got), h(key));
}

const fail = (error, status = 400) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

// Ботууд, ангиллууд, сүүлийн нийтлэлүүдийн гарчиг (давхардуулахгүйн тулд)
export async function GET(req) {
  if (!authorized(req)) return fail("unauthorized", 401);
  await ensureSchema();
  await syncTree(sql);
  const bots = await sql`
    SELECT u.id, u.initial, u.first_name, u.surname,
      (SELECT COUNT(*) FROM posts p WHERE p.author_id = u.id AND p.status <> 'removed')::int AS posts
    FROM users u WHERE u.is_bot AND u.restricted_at IS NULL ORDER BY u.id`;
  const titles = await sql`SELECT id, title, category, status FROM posts
                           WHERE kind = 'Нийтлэл' AND status <> 'removed' ORDER BY id DESC LIMIT 500`;
  const categories = [...NODES.values()].filter((n) => n.depth >= 2).map((n) => ({ path: n.path, name: n.name }));
  return Response.json({ bots, categories, articles: titles }, { headers: { "Cache-Control": "no-store" } });
}

// Ботын нэрээр нийтлэл редакц руу илгээнэ: { bot_id, title, subtitle?, body, category, sources[] }
export async function POST(req) {
  if (!authorized(req)) return fail("unauthorized", 401);
  let d;
  try { d = await req.json(); } catch (e) { return fail("Invalid JSON"); }
  await ensureSchema();
  await syncTree(sql);
  const [bot] = await sql`SELECT id, bot_by FROM users WHERE id = ${Number(d?.bot_id) || 0} AND is_bot AND restricted_at IS NULL`;
  if (!bot) return fail("Бот олдсонгүй", 404);
  const title = String(d.title || "").trim().slice(0, 200);
  const subtitle = String(d.subtitle || "").trim().slice(0, 250) || null;
  const body = String(d.body || "").trim().slice(0, 40000);
  const category = String(d.category || "");
  if (!title || !body) return fail("Гарчиг болон агуулгаа бөглөнө үү");
  if (!validCategory(category)) return fail("Ангилал буруу байна (дор хаяж салбар хүртэл)");
  const rule = bodyRule("Нийтлэл", body);
  if (rule.error) return fail(rule.error);
  const sources = cleanSources(JSON.stringify(Array.isArray(d.sources) ? d.sources : []));
  if (!sources.length) return fail("Дор хаяж нэг эх сурвалж оруулна уу");
  const [dup] = await sql`SELECT id FROM posts WHERE kind = 'Нийтлэл' AND status <> 'removed' AND lower(title) = lower(${title}) LIMIT 1`;
  if (dup) return fail(`Ийм гарчигтай нийтлэл байна (#${dup.id})`, 409);
  const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM posts WHERE meta->>'via' = 'bot_api' AND created_at > now() - interval '24 hours'`;
  if (n >= DAILY_MAX) return fail(`Өдөрт ${DAILY_MAX}-аас илүү нийтлэл илгээхгүй`, 429);
  const meta = { sources, cover: null, via: "bot_api" };
  const [p] = await sql`
    INSERT INTO posts (author_id, kind, title, subtitle, body, status, category, meta)
    VALUES (${bot.id}, 'Нийтлэл', ${title}, ${subtitle}, ${body}, 'pending', ${category}, ${JSON.stringify(meta)}::jsonb)
    RETURNING id`;
  // Ботыг үүсгэсэн супер админд мэдэгдэнэ (дарахад нийтлэл рүү очно). Админууд бот гэдгийг мэдэхгүй.
  await notify({ userId: bot.bot_by, kind: "bot_post", actorId: bot.id, postId: p.id });
  return Response.json({ id: p.id, url: `/post/${p.id}` }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
