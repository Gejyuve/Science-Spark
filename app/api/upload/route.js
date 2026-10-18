import { getUser } from "@/lib/auth";
import { sql, ensureSchema } from "@/lib/db";
import { sniff, MAX_BYTES, DAILY_LIMIT, blobOn, putBlob } from "@/lib/images";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const fail = (msg, status = 400) => Response.json({ error: msg }, { status });

// Зураг хүлээн авах. Хөтөч зургийг аль хэдийн жижигрүүлж, шахсан байна.
export async function POST(req) {
  const user = await getUser();
  if (!user) return fail("Нэвтэрнэ үү", 401);
  if (user.restricted_at) return fail("Таны эрх хязгаарлагдсан байна", 403);
  await ensureSchema();
  const [c] = await sql`SELECT COUNT(*)::int AS n FROM images WHERE owner_id = ${user.id} AND created_at > now() - interval '1 day'`;
  if (c.n >= DAILY_LIMIT) return fail("Өнөөдөр хэт олон зураг орууллаа. Маргааш дахин оролдоно уу.", 429);
  let form;
  try {
    form = await req.formData();
  } catch (e) {
    return fail("Зураг уншиж чадсангүй");
  }
  const file = form.get("file");
  if (!file || typeof file.arrayBuffer !== "function") return fail("Зураг сонгоно уу");
  if (file.size > MAX_BYTES) return fail("Зураг хэт том байна (1.5MB-аас бага)");
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniff(buf);
  if (!mime) return fail("Зөвхөн JPG, PNG, WEBP зураг оруулна");
  const w = Math.min(10000, Math.max(0, Number(form.get("w")) || 0)) || null;
  const h = Math.min(10000, Math.max(0, Number(form.get("h")) || 0)) || null;
  // Blob холбогдсон бол тэнд, үгүй эсвэл алдаа гарвал өмнөх шигээ өгөгдлийн санд хадгална
  let url = null;
  if (blobOn()) {
    try {
      url = await putBlob(`u${user.id}`, buf, mime);
    } catch (e) {
      console.error("blob upload failed", e?.message || e);
    }
  }
  const [r] = url
    ? await sql`INSERT INTO images (owner_id, mime, url, width, height, bytes)
                VALUES (${user.id}, ${mime}, ${url}, ${w}, ${h}, ${buf.length})
                RETURNING id`
    : await sql`INSERT INTO images (owner_id, mime, data, width, height, bytes)
                VALUES (${user.id}, ${mime}, decode(${buf.toString("base64")}, 'base64'), ${w}, ${h}, ${buf.length})
                RETURNING id`;
  return Response.json({ id: r.id, url: `/img/${r.id}` });
}
