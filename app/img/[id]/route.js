import { after } from "next/server";
import { sql, ensureSchema } from "@/lib/db";
import { blobOn, moveToBlob, readBlob } from "@/lib/images";

// Зураг харуулах. Зураг өөрчлөгддөггүй тул удаан хадгалуулна (cache).
export async function GET(req, { params }) {
  const { id } = await params;
  const n = Number(String(id).replace(/\.\w+$/, ""));
  if (!Number.isInteger(n) || n <= 0) return new Response("Олдсонгүй", { status: 404 });
  await ensureSchema();
  const [r] = await sql`SELECT mime, url, CASE WHEN url IS NULL THEN encode(data, 'base64') END AS b64 FROM images WHERE id = ${n}`;
  if (!r) return new Response("Олдсонгүй", { status: 404 });
  let body;
  if (r.url) {
    // Blob-оос авч дамжуулна: хаяг нь өөрчлөгдөхгүй, хөтөч дээрх зураг засагч ч ажилласаар байна
    body = await readBlob(r.url).catch((e) => (console.error("blob read failed", n, e), null));
    if (!body) return new Response("Зураг ачаалж чадсангүй", { status: 502 });
  } else {
    body = Buffer.from(r.b64, "base64");
    // Хуучин зургийг хариу илгээсний дараа Blob руу зөөнө
    if (blobOn()) after(() => moveToBlob(n, body, r.mime).catch((e) => console.error("blob move failed", n, e)));
  }
  return new Response(body, {
    headers: {
      "Content-Type": r.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
