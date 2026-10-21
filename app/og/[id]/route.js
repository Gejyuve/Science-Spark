import { sql, ensureSchema } from "@/lib/db";
import { ogImage, shareText } from "@/lib/og";
import { TERM_KIND } from "@/lib/terms";

// Контентын хуваалцах зураг: гарчиг эсвэл эхний өгүүлбэр. Нийтэд нээлттэй биш бол ерөнхий зураг.
export async function GET(req, { params }) {
  const { id } = await params;
  const n = Number(String(id).replace(/\.\w+$/, ""));
  if (!Number.isInteger(n) || n <= 0) return ogImage();
  await ensureSchema();
  const [p] = await sql`SELECT kind, title, body, status FROM posts WHERE id = ${n}`;
  const open = p && (p.status === "published" || (p.kind === TERM_KIND && p.status === "discussion"));
  return open ? ogImage({ text: shareText(p), kind: p.kind }) : ogImage();
}
