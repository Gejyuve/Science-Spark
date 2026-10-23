"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireSection, audit } from "@/lib/admin";
import { loadSettings, saveSettings } from "@/lib/settings";
import { notify } from "@/lib/notify";
import { notifyNewIssue, refundOrder, sendToCourier, deletePages } from "@/lib/magazine";
import { ISSUE_STATUS, MAX_PAGES } from "@/lib/magazine-shared";
import { currentPeriod } from "@/lib/spark";

// Сэтгүүлийг зөвхөн супер админ удирдана (Админ > Сэтгүүл)
async function requireSuper() {
  const me = await requireSection("magazine");
  if (me.role !== "superadmin") redirect("/admin");
  return me;
}

const clean = (v, n) => String(v || "").trim().slice(0, n);
const back = (path, key, msg) => redirect(`${path}${path.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(msg)}`);
const mnt = (v) => Math.min(10000000, Math.max(0, Math.round(Number(v) / 100) * 100 || 0));
const refresh = () => {
  revalidatePath("/admin/magazine", "layout");
  revalidatePath("/magazine", "layout");
};

// Маягтын утгуудыг шалгана. Алдаатай бол { error } буцаана.
async function issueFields(formData, id = null) {
  const f = {
    number: Math.round(Number(formData.get("number"))),
    title: clean(formData.get("title"), 140),
    body: clean(formData.get("body"), 2000) || null,
    issuedOn: /^\d{4}-\d{2}-\d{2}$/.test(String(formData.get("issued_on") || "")) ? formData.get("issued_on") : null,
    price: mnt(formData.get("price_mnt")),
    preview: Math.min(50, Math.max(0, Math.round(Number(formData.get("preview_pages")) || 0))),
    print: mnt(formData.get("print_price")),
    fee: mnt(formData.get("delivery_fee")),
  };
  if (!(f.number >= 1 && f.number <= 10000)) return { error: "Дугаарын тоог бичнэ үү" };
  if (f.title.length < 2) return { error: "Дугаарын гарчгийг бичнэ үү" };
  const [dup] = await sql`SELECT id FROM magazine_issues WHERE number = ${f.number} AND id IS DISTINCT FROM ${id}::int`;
  if (dup) return { error: `№${f.number} дугаар аль хэдийн бий` };
  return f;
}

// Шинэ дугаар үүсгэнэ (хөтөч дараа нь PDF-ийг шууд оруулна). Үнийг супер админ өөрөө бичнэ (анхны утга нь 10,000₮).
export async function createIssue(formData) {
  const me = await requireSuper();
  const f = await issueFields(formData);
  if (f.error) return f;
  const [n] = await sql`INSERT INTO magazine_issues (number, title, body, issued_on, price_mnt, preview_pages, print_price, delivery_fee, created_by)
                        VALUES (${f.number}, ${f.title}, ${f.body}, ${f.issuedOn}, ${f.price}, ${f.preview}, ${f.print}, ${f.fee}, ${me.id}) RETURNING id`;
  await audit({ actorId: me.id, category: "content", action: "Сэтгүүлийн дугаар нэмсэн", targetType: "magazine", targetId: n.id, targetLabel: `№${f.number} ${f.title}` });
  refresh();
  return { id: n.id };
}

// Дугаарын мэдээлэл, үнийг засна
export async function saveIssue(formData) {
  const me = await requireSuper();
  const id = Number(formData.get("iid")) || 0;
  const path = `/admin/magazine/${id}`;
  const f = await issueFields(formData, id);
  if (f.error) back(path, "error", f.error);
  const [u] = await sql`UPDATE magazine_issues SET number = ${f.number}, title = ${f.title}, body = ${f.body}, issued_on = ${f.issuedOn},
                          price_mnt = ${f.price}, preview_pages = ${f.preview}, print_price = ${f.print}, delivery_fee = ${f.fee}, updated_at = now()
                        WHERE id = ${id} RETURNING id`;
  if (!u) back("/admin/magazine", "error", "Дугаар олдсонгүй");
  await audit({ actorId: me.id, category: "content", action: "Сэтгүүлийн дугаар засварласан", targetType: "magazine", targetId: id, targetLabel: `№${f.number} ${f.title}` });
  refresh();
  back(path, "ok", "Хадгаллаа");
}

// Хөтөч бүх хуудсыг илгээж дуусахад дуудна: хуудасны тоог хадгалж, илүү үлдсэн хуучин хуудсыг устгана
export async function finishPages(issueId, total) {
  const me = await requireSuper();
  const id = Number(issueId);
  const n = Math.round(Number(total));
  if (!(n >= 1 && n <= MAX_PAGES)) return { error: "Хуудасны тоо буруу" };
  const [have] = await sql`SELECT COUNT(*)::int AS c FROM magazine_pages WHERE issue_id = ${id} AND page <= ${n}`;
  if (have.c < n) return { error: `${n - have.c} хуудас дутуу орсон байна. Дахин оруулна уу` };
  await deletePages(id, n + 1);
  const [u] = await sql`UPDATE magazine_issues SET pages = ${n}, updated_at = now() WHERE id = ${id} RETURNING number, title`;
  if (!u) return { error: "Дугаар олдсонгүй" };
  await audit({ actorId: me.id, category: "content", action: `Сэтгүүлийн PDF оруулсан (${n} хуудас)`, targetType: "magazine", targetId: id, targetLabel: `№${u.number} ${u.title}` });
  refresh();
  return { ok: true };
}

// Төлөв: бэлтгэж байна → удахгүй гарна → нийтлэгдсэн → архив. Нийтлэхэд хэрэглэгчдэд мэдэгдэнэ.
export async function setIssueStatus(formData) {
  const me = await requireSuper();
  const id = Number(formData.get("iid"));
  const status = String(formData.get("status"));
  if (!ISSUE_STATUS[status]) back(`/admin/magazine/${id}`, "error", "Төлөв буруу");
  const [i] = await sql`SELECT * FROM magazine_issues WHERE id = ${id}`;
  if (!i) back("/admin/magazine", "error", "Дугаар олдсонгүй");
  if (status === "published" && i.pages < 1) back(`/admin/magazine/${id}`, "error", "Нийтлэхийн өмнө PDF файлаа оруулна уу");
  await sql`UPDATE magazine_issues SET status = ${status}, updated_at = now() WHERE id = ${id}`;
  if (status === "published" && i.status !== "published") await notifyNewIssue(i);
  await audit({ actorId: me.id, category: "content", action: `Сэтгүүлийн төлөв: ${ISSUE_STATUS[status][0]}`, targetType: "magazine", targetId: id, targetLabel: `№${i.number} ${i.title}` });
  refresh();
  back(`/admin/magazine/${id}`, "ok", `Төлөв: ${ISSUE_STATUS[status][0]}`);
}

// Худалдаж авсан, захиалсан хүнгүй дугаарыг л бүрмөсөн устгана (бусад үед архивлана)
export async function deleteIssue(formData) {
  const me = await requireSuper();
  const id = Number(formData.get("iid"));
  const [i] = await sql`SELECT i.number, i.title,
                          (SELECT COUNT(*) FROM magazine_unlocks WHERE issue_id = i.id)::int AS buyers,
                          (SELECT COUNT(*) FROM magazine_orders WHERE issue_id = i.id)::int AS orders
                        FROM magazine_issues i WHERE i.id = ${id}`;
  if (!i) back("/admin/magazine", "error", "Дугаар олдсонгүй");
  if (i.buyers || i.orders) back(`/admin/magazine/${id}`, "error", "Энэ дугаарыг худалдаж авсан, захиалсан хүн байгаа тул устгах боломжгүй. Архивлана уу");
  await deletePages(id, 1);
  await sql`DELETE FROM magazine_issues WHERE id = ${id}`;
  await audit({ actorId: me.id, category: "content", action: "Сэтгүүлийн дугаар устгасан", targetType: "magazine", targetId: id, targetLabel: `№${i.number} ${i.title}` });
  refresh();
  back("/admin/magazine", "ok", `№${i.number} дугаарыг устгалаа`);
}

export async function setMagazinePublic(formData) {
  const me = await requireSuper();
  const on = formData.get("on") === "1";
  const s = await loadSettings();
  await saveSettings({ ...s, magazinePublic: on });
  // Нээхэд хамгийн сүүлийн дугаарыг бүх хэрэглэгчид нэг удаа мэдэгдэнэ
  if (on) {
    const [latest] = await sql`SELECT * FROM magazine_issues WHERE status = 'published' ORDER BY number DESC, id DESC LIMIT 1`;
    if (latest) await notifyNewIssue(latest);
  }
  await audit({ actorId: me.id, category: "settings", action: on ? "Сэтгүүл хэсгийг нийтэд нээсэн" : "Сэтгүүл хэсгийг нийтээс хаасан" });
  revalidatePath("/", "layout");
  back("/admin/magazine", "ok", on ? "Сэтгүүл хэсэг бүх хэрэглэгчид нээгдлээ" : "Сэтгүүл хэсгийг хаалаа. Одоо зөвхөн танд харагдана");
}

// Захиалгын төлөв: хүргэлтэд өгсөн, хүргэгдсэн, цуцлах (мөнгө буцаана), хүргэлтийн систем рүү дахин илгээх
export async function orderAction(formData) {
  const me = await requireSuper();
  const id = Number(formData.get("oid"));
  const act = String(formData.get("act"));
  const note = clean(formData.get("staff_note"), 300) || null;
  const path = "/admin/magazine?tab=orders";
  const [o] = await sql`SELECT o.*, i.number FROM magazine_orders o JOIN magazine_issues i ON i.id = o.issue_id WHERE o.id = ${id}`;
  if (!o) back(path, "error", "Захиалга олдсонгүй");
  const label = `Захиалга №${o.id} · №${o.number}`;
  if (act === "courier") {
    const s = await sendToCourier(id);
    back(path, s === "sent" ? "ok" : "error", s === "sent" ? "Хүргэлтийн систем рүү илгээлээ" : s ? "Хүргэлтийн систем хүлээж авсангүй. Дараа дахин оролдоно уу" : "Хүргэлтийн систем холбогдоогүй байна");
  }
  if (act === "cancel") {
    const r = await refundOrder(id, currentPeriod());
    if (!r) back(path, "error", "Энэ захиалгыг цуцлах боломжгүй");
    if (note) await sql`UPDATE magazine_orders SET staff_note = ${note} WHERE id = ${id}`;
    await notify({ userId: o.user_id, kind: "mag_order_cancel", actorId: me.id, note: label, magId: o.issue_id });
    await audit({ actorId: me.id, category: "settings", action: "Сэтгүүлийн захиалга цуцалж мөнгө буцаасан", targetType: "magazine_order", targetId: id, targetLabel: label });
    refresh();
    back(path, "ok", `${label} цуцалж, мөнгийг хэтэвчинд буцаалаа`);
  }
  const next = act === "sent" ? "sent" : act === "delivered" ? "delivered" : null;
  if (!next) {
    if (note !== o.staff_note) await sql`UPDATE magazine_orders SET staff_note = ${note}, updated_at = now() WHERE id = ${id}`;
    refresh();
    back(path, "ok", "Тэмдэглэл хадгаллаа");
  }
  const [u] = await sql`UPDATE magazine_orders SET status = ${next}, staff_note = COALESCE(${note}, staff_note), updated_at = now()
                        WHERE id = ${id} AND status IN ('paid', 'sent') AND status <> ${next} RETURNING id`;
  if (!u) back(path, "error", "Төлөв өөрчлөх боломжгүй");
  await notify({ userId: o.user_id, kind: next === "sent" ? "mag_order_sent" : "mag_order_done", actorId: me.id, note: label, magId: o.issue_id });
  refresh();
  back(path, "ok", next === "sent" ? `${label} хүргэлтэд гарлаа` : `${label} хүргэгдлээ`);
}

// Байршуулах хүсэлтийн хариу: хүлээн авах, татгалзах, нийтлэгдсэн гэж тэмдэглэх
export async function requestAction(formData) {
  const me = await requireSuper();
  const id = Number(formData.get("rid"));
  const act = String(formData.get("act"));
  const reply = clean(formData.get("reply"), 1000) || null;
  const path = "/admin/magazine?tab=requests";
  const next = { accept: "accepted", decline: "declined", done: "done" }[act];
  if (!next) back(path, "error", "Үйлдэл буруу");
  const [r] = await sql`UPDATE magazine_requests SET status = ${next}, reply = COALESCE(${reply}, reply), updated_at = now()
                        WHERE id = ${id} AND status <> ${next} RETURNING user_id, issue_id, kind`;
  if (!r) back(path, "error", "Хүсэлт олдсонгүй эсвэл аль хэдийн шийдсэн");
  await notify({ userId: r.user_id, kind: next === "accepted" ? "mag_req_ok" : next === "declined" ? "mag_req_no" : "mag_req_done", actorId: me.id, note: reply, magId: r.issue_id });
  refresh();
  back(path, "ok", "Хүсэлтийн хариуг илгээлээ");
}
