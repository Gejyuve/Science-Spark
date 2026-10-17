import { sql, ensureSchema } from "@/lib/db";
import { icsFile } from "@/lib/events";

export const dynamic = "force-dynamic";

// Эвентийг утас, Outlook, Apple календарьт нэмэх .ics файл
export async function GET(req, { params }) {
  const { id } = await params;
  const n = Number(id);
  if (!Number.isInteger(n)) return new Response("Олдсонгүй", { status: 404 });
  await ensureSchema();
  const [p] = await sql`SELECT id, title, body, meta FROM posts WHERE id = ${n} AND kind = 'Эвент' AND status = 'published'`;
  const url = new URL(`/post/${n}`, req.url).toString();
  const ics = p && icsFile({ id: p.id, title: p.title, body: p.body, meta: p.meta || {}, url });
  if (!ics) return new Response("Олдсонгүй", { status: 404 });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="science-spark-event-${p.id}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
