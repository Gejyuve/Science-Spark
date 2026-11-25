import { getUser } from "@/lib/auth";
import { sql, ensureSchema } from "@/lib/db";
import { merchantOpenFor } from "@/lib/merchant";
import { DOC_KINDS, DOC_MAX, DOC_LIMIT, EDITABLE } from "@/lib/merchant-shared";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const fail = (msg, status = 400) => Response.json({ error: msg }, { status });

// Файлын эхний байтаар төрлийг шалгана (нэр, өргөтгөлд итгэхгүй)
function sniffDoc(buf) {
  if (buf.length < 8) return null;
  if (buf.toString("ascii", 0, 5) === "%PDF-") return "application/pdf";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  return null;
}

// Мерчантын баримт (гэрчилгээ, иргэний үнэмлэх, дансны тодорхойлолт) хүлээн авна.
// Нийтэд нээлттэй Blob-д биш, өгөгдлийн санд хадгална. Мэдээлэл засах боломжтой үед, эсвэл
// баталгаажсан мерчант данс солихдоо (bank_proof) л оруулна.
export async function POST(req) {
  const user = await getUser();
  if (!user) return fail("Нэвтэрнэ үү", 401);
  if (user.is_bot || !(await merchantOpenFor(user))) return fail("Мерчантын бүртгэл одоогоор нээгдээгүй байна", 403);
  await ensureSchema();
  const [m] = await sql`SELECT id, type, status FROM merchants WHERE user_id = ${user.id}`;
  if (!m) return fail("Эхлээд мерчантын бүртгэл эхлүүлнэ үү", 404);
  let form;
  try {
    form = await req.formData();
  } catch (e) {
    return fail("Файл уншиж чадсангүй");
  }
  const kind = String(form.get("kind") || "");
  if (!DOC_KINDS[kind] || !DOC_KINDS[kind].types.includes(m.type)) return fail("Баримтын төрлөө сонгоно уу");
  const editable = EDITABLE.includes(m.status) || (m.status === "approved" && kind === "bank_proof");
  if (!editable) return fail("Одоогийн төлөвт баримт нэмэх боломжгүй");
  const file = form.get("file");
  if (!file || typeof file.arrayBuffer !== "function") return fail("Файл сонгоно уу");
  if (file.size > DOC_MAX) return fail("Файл хэт том байна (4MB-аас бага)");
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniffDoc(buf);
  if (!mime) return fail("Зөвхөн PDF, JPG, PNG файл оруулна");
  const [c] = await sql`SELECT COUNT(*)::int AS n FROM merchant_documents WHERE merchant_id = ${m.id} AND removed_at IS NULL`;
  if (c.n >= DOC_LIMIT) return fail(`Нэг дор ${DOC_LIMIT}-аас олон баримт хадгалахгүй. Хэрэггүйг нь устгана уу`);
  const name = String(file.name || "barimt").replace(/[\\/\r\n"]/g, "_").slice(0, 120);
  const [r] = await sql`INSERT INTO merchant_documents (merchant_id, kind, file_name, mime, size, data, uploaded_by)
                        VALUES (${m.id}, ${kind}, ${name}, ${mime}, ${buf.length}, decode(${buf.toString("base64")}, 'base64'), ${user.id})
                        RETURNING id, kind, file_name, mime, size, created_at`;
  return Response.json({ doc: r });
}
