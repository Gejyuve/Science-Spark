"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireSection, audit } from "@/lib/admin";
import { realUser } from "@/lib/auth";
import { notifyProduct } from "@/lib/notify";
import { loadMerchant, canSell } from "@/lib/merchant";
import { loadProduct } from "@/lib/market";
import { PRODUCT_STATUS } from "@/lib/market-shared";

const back = (path, key, msg) => redirect(`${path}?${key}=${encodeURIComponent(msg)}`);

// [зөвшөөрөгдөх төлөв, шинэ төлөв, тайлбар заавал эсэх, мэдэгдэл]
const MOVES = {
  approve: [["pending_review", "hidden"], "published", false, "product_ok"],
  revise: [["pending_review"], "revision_required", true, "product_fix"],
  reject: [["pending_review"], "rejected", true, "product_no"],
  hide: [["published"], "hidden", true, "product_hidden"],
};

// Редакц бүтээгдэхүүнийг шалгаж нийтэлнэ. Нийтлэхэд мерчант борлуулах эрхтэй (баталгаажсан, данстай, хүчинтэй гэрээтэй) байх ёстой.
export async function decideProduct(f) {
  const me = realUser(await requireSection("products"));
  const id = Number(f.get("pid")) || 0;
  const act = String(f.get("act"));
  const note = String(f.get("note") || "").trim().slice(0, 1000) || null;
  const path = `/admin/products/${id}`;
  const mv = MOVES[act];
  if (!mv) back(path, "error", "Үйлдэл буруу");
  const [from, to, needNote, kind] = mv;
  const p = await loadProduct(id);
  if (!p) back("/admin/products", "error", "Бүтээгдэхүүн олдсонгүй");
  if (!from.includes(p.status)) back(path, "error", `«${PRODUCT_STATUS[p.status]?.[0]}» төлөвөөс ийм шийдвэр гаргах боломжгүй`);
  if (needNote && !note) back(path, "error", "Борлуулагчид харагдах тайлбар бичнэ үү");
  if (act === "approve") {
    const m = p.merchant_id ? await loadMerchant({ id: p.merchant_id }) : null;
    if (!canSell(m)) back(path, "error", "Мерчант борлуулах эрхгүй байна: мерчантыг баталж, гэрээг платформын нэрийн өмнөөс баталгаажуулсны дараа нийтэлнэ үү");
  }
  const [u] = await sql`UPDATE products SET status = ${to}, review_note = ${note}, reviewed_by = ${me.id}, reviewed_at = now(),
                          published_at = CASE WHEN ${to} = 'published' THEN COALESCE(published_at, now()) ELSE published_at END, updated_at = now()
                        WHERE id = ${id} AND status = ${p.status} RETURNING id`;
  if (!u) back(path, "error", "Төлөв өөрчлөгдсөн байна. Хуудсаа шинэчилнэ үү");
  await notifyProduct({ to: p.user_id, kind, actorId: me.id, productId: id, note: act === "approve" ? p.title : note });
  await audit({ actorId: me.id, category: "merchant", action: `Бүтээгдэхүүн: ${PRODUCT_STATUS[p.status][0]} → ${PRODUCT_STATUS[to][0]} (${p.title.slice(0, 60)})`, targetType: "product", targetId: id });
  revalidatePath("/admin/products", "layout");
  revalidatePath("/market", "layout");
  back(path, "ok", `${p.title}: ${PRODUCT_STATUS[to][0]}`);
}
