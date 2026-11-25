"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql, ensureSchema } from "@/lib/db";
import { getUser, needsName } from "@/lib/auth";
import { audit } from "@/lib/admin";
import { ownImage } from "@/lib/images";
import { notifyProduct } from "@/lib/notify";
import { merchantOpenFor, loadMerchant } from "@/lib/merchant";
import { loadProduct, merchantStage } from "@/lib/market";
import {
  PRODUCT_TYPES, PRODUCT_EDITABLE, MAX_IMAGES, PRICE_MIN, PRICE_MAX, PARCEL_SIZES, POST_FROM, PREP_DAYS, needsPost,
} from "@/lib/market-shared";

async function me() {
  const user = await getUser();
  if (!user) redirect("/login?next=/market/new");
  if (needsName(user)) redirect("/profile/edit");
  if (user.is_bot || !(await merchantOpenFor(user))) redirect("/");
  await ensureSchema();
  return user;
}

const txt = (f, k, n) => String(f.get(k) || "").replace(/\r/g, "").trim().slice(0, n);
const int = (f, k) => {
  const v = String(f.get(k) || "").replace(/[\s,'’]/g, "");
  return /^\d+$/.test(v) ? Number(v) : null;
};

// Маягтыг уншиж, талбар бүрийн алдааг цуглуулна. strict: редакц руу илгээх үед бүгд заавал.
async function readProduct(f, userId, strict) {
  const e = {};
  const title = txt(f, "title", 120);
  const type = PRODUCT_TYPES.includes(String(f.get("type"))) ? String(f.get("type")) : null;
  const description = txt(f, "description", 3000);
  const ids = [];
  for (const raw of f.getAll("image_ids").slice(0, MAX_IMAGES)) {
    const id = await ownImage(userId, raw);
    if (id && !ids.includes(id)) ids.push(id);
  }
  const price = int(f, "price");
  const stock = int(f, "stock");
  const wRaw = String(f.get("weight") || "").replace(",", ".").trim();
  const weight = /^\d+(\.\d+)?$/.test(wRaw) ? Math.round(Number(wRaw) * 1000) / 1000 : null;
  const size = PARCEL_SIZES.some(([k]) => k === f.get("size")) ? String(f.get("size")) : null;
  const from = POST_FROM.includes(String(f.get("from"))) ? String(f.get("from")) : null;
  const prep = PREP_DAYS.includes(Number(f.get("prep"))) ? Number(f.get("prep")) : null;
  const returnPolicy = txt(f, "return_policy", 1000) || null;
  const post = needsPost(type);

  if (title && title.length < 3) e.title = "Нэр хэт богино байна";
  if (price !== null && (price < PRICE_MIN || price > PRICE_MAX)) e.price = `Үнэ ${PRICE_MIN.toLocaleString("en-US")}–${PRICE_MAX.toLocaleString("en-US")}₮ хооронд байна`;
  if (stock !== null && stock > 100000) e.stock = "Тоо ширхэг хэт их байна";
  if (weight !== null && (weight < 0.01 || weight > 30)) e.weight = "Жин 0.01–30 кг хооронд байна";
  if (strict) {
    if (!title) e.title = "Бүтээгдэхүүний нэрээ бичнэ үү";
    if (!type) e.type = "Төрлөө сонгоно уу";
    if (description.length < 30) e.description = "Тайлбараа дор хаяж 30 тэмдэгтээр бичнэ үү";
    if (!ids.length) e.images = "Дор хаяж 1 зураг оруулна уу";
    if (price === null) e.price = e.price || "Үнээ бичнэ үү";
    if (stock === null || stock < 1) e.stock = e.stock || "Борлуулах тоо ширхэгээ бичнэ үү";
    if (post) {
      if (weight === null) e.weight = e.weight || "Илгээмжийн жинг бичнэ үү";
      if (!size) e.size = "Хайрцгийн хэмжээг сонгоно уу";
      if (!from) e.from = "Илгээх аймаг, хотоо сонгоно уу";
      if (!prep) e.prep = "Бэлтгэх хугацаагаа сонгоно уу";
    }
  }
  const delivery = post ? { method: "mongol_post", weight, size, from, prep } : { method: "digital" };
  return { e, row: { title, type, description, ids, price, stock, delivery, returnPolicy } };
}

// Хадгалах (ноорог) эсвэл редакц руу илгээх. Илгээхийн өмнө мерчантын гэрээ баталгаажсан байх ёстой.
export async function saveProduct(prev, f) {
  const user = await me();
  const pid = Number(f.get("pid")) || 0;
  const submit = f.get("intent") === "submit";
  let p = null;
  if (pid) {
    p = await loadProduct(pid);
    if (!p || p.user_id !== user.id) return { error: "Бүтээгдэхүүн олдсонгүй" };
    if (!PRODUCT_EDITABLE.includes(p.status)) return { error: "Редакц шалгаж байх үед засах боломжгүй" };
  }
  const { e, row: r } = await readProduct(f, user.id, submit);
  if (Object.keys(e).length && submit) return { error: "Улаанаар тэмдэглэсэн талбарыг засна уу", errors: e };
  // Ноорогт буруу утгыг хадгалахгүй
  if (e.price) r.price = null;
  if (e.stock) r.stock = null;
  if (e.weight) r.delivery.weight = null;
  // Нийтлэгдсэн бүтээгдэхүүнийг засвал дахин шалгуулна (ноорог болж маркетаас түр алга болно)
  const status = p?.status === "revision_required" ? "revision_required" : "draft";
  let id = pid;
  if (p) {
    await sql`UPDATE products SET title = ${r.title}, type = ${r.type}, description = ${r.description}, image_ids = ${r.ids}, price = ${r.price}, stock = ${r.stock},
                delivery = ${JSON.stringify(r.delivery)}::jsonb, return_policy = ${r.returnPolicy}, status = ${status}, updated_at = now()
              WHERE id = ${pid} AND user_id = ${user.id}`;
  } else {
    const [n] = await sql`INSERT INTO products (user_id, title, type, description, image_ids, price, stock, delivery, return_policy)
                          VALUES (${user.id}, ${r.title}, ${r.type}, ${r.description}, ${r.ids}, ${r.price}, ${r.stock}, ${JSON.stringify(r.delivery)}::jsonb, ${r.returnPolicy})
                          RETURNING id`;
    id = n.id;
  }
  const edit = `/market/${id}/edit`;
  revalidatePath("/market");
  if (!submit) {
    if (!pid) redirect(`${edit}?ok=${encodeURIComponent("Ноорог хадгалагдлаа")}`);
    return { ok: `Ноорог хадгалагдлаа${Object.keys(e).length ? ". Улаанаар тэмдэглэсэн талбарыг засна уу" : ""}`, errors: e };
  }

  // Мерчантын гэрээ: бөглөөгүй бол гэрээний алхам руу
  const m = await loadMerchant({ userId: user.id });
  const stage = merchantStage(m);
  if (stage === "blocked") return { error: "Таны борлуулах эрх түдгэлзсэн байна. Мерчант хэсгээс дэлгэрэнгүйг харна уу" };
  if (stage !== "ready") redirect(`${edit}?step=agreement#agreement`);

  const [done] = await sql`UPDATE products SET status = 'pending_review', merchant_id = ${m.id}, submitted_at = now(), review_note = NULL, updated_at = now()
                           WHERE id = ${id} AND user_id = ${user.id} AND status = ANY(${PRODUCT_EDITABLE}) RETURNING id`;
  if (!done) return { error: "Одоогийн төлөвт илгээх боломжгүй" };
  await notifyProduct({ to: "staff", kind: "product_new", actorId: user.id, productId: id, note: r.title });
  await audit({ actorId: user.id, category: "merchant", action: `Бүтээгдэхүүн редакц руу илгээсэн: ${r.title}`, targetType: "product", targetId: id });
  revalidatePath("/admin/products");
  redirect(`/market/${id}?ok=${encodeURIComponent("Редакц руу илгээлээ. Шалгаж нийтлэхэд мэдэгдэл очно")}`);
}

// Эзэн нь бүтээгдэхүүнээ маркетаас авах (нуух) эсвэл ноорог устгах
export async function ownerProduct(f) {
  const user = await me();
  const id = Number(f.get("pid")) || 0;
  const act = String(f.get("act"));
  const p = await loadProduct(id);
  if (!p || p.user_id !== user.id) redirect("/market?tab=mine");
  if (act === "hide" && p.status === "published") {
    await sql`UPDATE products SET status = 'hidden', updated_at = now() WHERE id = ${id}`;
    revalidatePath("/market");
    redirect(`/market/${id}/edit?ok=${encodeURIComponent("Маркетаас авлаа. Засаад дахин илгээж болно")}`);
  }
  if (act === "delete" && ["draft", "rejected", "hidden", "revision_required"].includes(p.status)) {
    await sql`DELETE FROM products WHERE id = ${id} AND user_id = ${user.id}`;
    revalidatePath("/market");
    redirect(`/market?tab=mine&ok=${encodeURIComponent("Устгалаа")}`);
  }
  redirect(`/market/${id}/edit`);
}
