import { getUser } from "@/lib/auth";
import { sql, ensureSchema } from "@/lib/db";

export const dynamic = "force-dynamic";

// Тоглуулагч хэдэн секунд тутам үзсэн хэсгийг илгээнэ (вэб, апп хоёр ижил API ашиглана).
// Анх үзэж эхлэхэд давтагдаагүй үзэгчийн тоо 1-ээр нэмэгдэнэ.
export async function POST(req) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Нэвтэрнэ үү" }, { status: 401 });
  let b;
  try {
    b = JSON.parse(await req.text());
  } catch (e) {
    return Response.json({ error: "bad" }, { status: 400 });
  }
  const id = Number(b.id), t = Math.max(0, Math.floor(Number(b.t) || 0));
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "bad" }, { status: 400 });
  await ensureSchema();
  const [v] = await sql`SELECT duration FROM videos WHERE id = ${id} AND status = 'ready'`;
  if (!v) return Response.json({ error: "not found" }, { status: 404 });
  // Сүүлийн 15 секундэд хүрвэл бүрэн үзсэн гэж тооцож, дараа нь эхнээс нь эхлүүлнэ
  const done = !!b.ended || (v.duration > 0 && t >= v.duration - 15);
  const [r] = await sql`INSERT INTO video_progress (user_id, video_id, seconds, done) VALUES (${user.id}, ${id}, ${done ? 0 : t}, ${done})
                        ON CONFLICT (user_id, video_id) DO UPDATE SET seconds = EXCLUDED.seconds, done = EXCLUDED.done, updated_at = now()
                        RETURNING (xmax = 0) AS fresh`;
  if (r?.fresh) await sql`UPDATE videos SET views = views + 1 WHERE id = ${id}`;
  return Response.json({ ok: true });
}
