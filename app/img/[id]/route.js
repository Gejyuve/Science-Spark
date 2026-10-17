import { sql, ensureSchema } from "@/lib/db";

// Зураг харуулах. Зураг өөрчлөгддөггүй тул удаан хадгалуулна (cache).
export async function GET(req, { params }) {
  const { id } = await params;
  const n = Number(String(id).replace(/\.\w+$/, ""));
  if (!Number.isInteger(n) || n <= 0) return new Response("Олдсонгүй", { status: 404 });
  await ensureSchema();
  const [r] = await sql`SELECT mime, encode(data, 'base64') AS b64 FROM images WHERE id = ${n}`;
  if (!r) return new Response("Олдсонгүй", { status: 404 });
  return new Response(Buffer.from(r.b64, "base64"), {
    headers: {
      "Content-Type": r.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
