import { getUser, realUser, isSuperAdmin } from "@/lib/auth";
import { sql, ensureSchema } from "@/lib/db";
import { audit } from "@/lib/admin";
import { EDITABLE } from "@/lib/merchant-shared";

export const dynamic = "force-dynamic";

const NO_CACHE = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const fail = (msg, status = 404) => Response.json({ error: msg }, { status, headers: NO_CACHE });

// Баримтыг зөвхөн тухайн мерчантын эзэн болон супер админ үзнэ. Бусад хүнд «олдсонгүй» гэж хариулна.
export async function GET(req, { params }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return fail("Нэвтэрнэ үү", 401);
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) return fail("Олдсонгүй");
  await ensureSchema();
  const real = realUser(user);
  const sup = isSuperAdmin(real);
  const [d] = await sql`SELECT d.id, d.file_name, d.mime, encode(d.data, 'base64') AS b64, d.merchant_id, m.user_id
                        FROM merchant_documents d JOIN merchants m ON m.id = d.merchant_id
                        WHERE d.id = ${n} AND (d.removed_at IS NULL OR ${sup})`;
  if (!d || (!sup && d.user_id !== user.id)) return fail("Олдсонгүй");
  if (sup && d.user_id !== real.id) {
    await audit({ actorId: real.id, category: "merchant", action: `Мерчантын баримт үзсэн: ${d.file_name}`, targetType: "merchant", targetId: d.merchant_id });
  }
  const buf = Buffer.from(d.b64, "base64");
  return new Response(buf, {
    headers: {
      ...NO_CACHE,
      "Content-Type": d.mime,
      "Content-Length": String(buf.length),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(d.file_name)}`,
    },
  });
}

// Мерчант засах боломжтой үедээ өөрийн баримтыг хасна (түүхэнд removed_at-тай үлдэнэ)
export async function DELETE(req, { params }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return fail("Нэвтэрнэ үү", 401);
  await ensureSchema();
  const [d] = await sql`UPDATE merchant_documents d SET removed_at = now()
                        FROM merchants m
                        WHERE d.id = ${Number(id) || 0} AND m.id = d.merchant_id AND m.user_id = ${user.id}
                          AND d.removed_at IS NULL AND m.status = ANY(${EDITABLE})
                          AND NOT EXISTS (SELECT 1 FROM merchant_bank_accounts b WHERE b.proof_doc_id = d.id AND b.status <> 'pending')
                        RETURNING d.id`;
  if (!d) return fail("Энэ баримтыг хасах боломжгүй", 400);
  return Response.json({ ok: true });
}
