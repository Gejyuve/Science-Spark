"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql, ensureSchema } from "@/lib/db";
import { getUser, displayName } from "@/lib/auth";
import { canSeeMagazine, getIssue, hasIssueAccess, payIssue, placeOrder, sendToCourier, notifySupers, courierOn } from "@/lib/magazine";
import { REQUEST_KIND, BANNER_SIZES, MAX_ORDER_QTY, UB_DISTRICTS } from "@/lib/magazine-shared";
import { MN_CITIES } from "@/lib/profile";
import { walletBalance, fmtMnt } from "@/lib/money";
import { currentPeriod } from "@/lib/spark";

const clean = (v, n) => String(v || "").trim().replace(/\s+/g, " ").slice(0, n);
const text = (v, n) => String(v || "").trim().slice(0, n);
const go = (path, key, msg, hash = "") => redirect(`${path}${path.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(msg)}${hash}`);
// Монгол утасны дугаар: 8 оронтой (зай, зураас, +976-ийг хасна)
const phoneOf = (v) => {
  const d = String(v || "").replace(/[\s\-()]/g, "").replace(/^\+?976/, "");
  return /^[5-9]\d{7}$/.test(d) ? d : null;
};
const emailOf = (v) => {
  const e = clean(v, 120);
  return !e ? "" : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
};

async function viewer() {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!canSeeMagazine(user)) redirect("/");
  await ensureSchema();
  return user;
}

// Дугаарыг хэтэвчнээс төлж онлайнаар уншина
export async function unlockIssue(formData) {
  const user = await viewer();
  const issue = await getIssue(formData.get("iid"), user);
  if (!issue || issue.status !== "published") redirect("/magazine");
  const back = (key, msg) => go(`/magazine/${issue.id}`, key, msg, "#read");
  if (hasIssueAccess(user, issue, issue.unlocked)) back("ok", "Та энэ дугаарыг унших эрхтэй. Сайхан уншаарай!");
  if (user.restricted_at) back("error", "Таны эрх хязгаарлагдсан байна");
  const bal = Number(await walletBalance(user.id));
  if (bal < issue.price_mnt) back("error", `Хэтэвчинд ${fmtMnt(issue.price_mnt)} хэрэгтэй, танд ${fmtMnt(bal)} байна. Хэтэвчээ цэнэглээд дахин оролдоорой`);
  const ok = await payIssue(user.id, issue, currentPeriod());
  if (!ok) back("error", "Төлж чадсангүй. Үлдэгдлээ шалгаад дахин оролдоно уу");
  revalidatePath(`/magazine/${issue.id}`);
  back("ok", `${fmtMnt(issue.price_mnt)}-өөр №${issue.number} дугаарыг нээлээ. Шинжлэх ухааны сэтгүүлийг дэмжсэнд баярлалаа!`);
}

// Биет хувь захиалах: хэтэвчнээс төлөөд хүргэлтийн мэдээлэл тэр даруй редакц (болон тохируулсан бол хүргэлтийн систем) руу очно
export async function orderPrint(formData) {
  const user = await viewer();
  const issue = await getIssue(formData.get("iid"), user);
  if (!issue || issue.status !== "published" || !issue.print_price) redirect("/magazine");
  const path = `/magazine/${issue.id}/order`;
  if (user.restricted_at) go(path, "error", "Таны эрх хязгаарлагдсан байна");
  const qty = Math.round(Number(formData.get("qty")));
  const name = clean(formData.get("name"), 80);
  const phone = phoneOf(formData.get("phone"));
  const city = clean(formData.get("city"), 40);
  const district = clean(formData.get("district"), 60);
  const address = text(formData.get("address"), 400);
  const note = text(formData.get("note"), 300);
  if (!(qty >= 1 && qty <= MAX_ORDER_QTY)) go(path, "error", `Тоо ширхэг 1–${MAX_ORDER_QTY} хооронд байна`);
  if (name.length < 2) go(path, "error", "Хүлээн авах хүний нэрийг бичнэ үү");
  if (!phone) go(path, "error", "Утасны дугаараа 8 оронтойгоор бичнэ үү");
  if (!MN_CITIES.includes(city)) go(path, "error", "Хот, аймгаа сонгоно уу");
  if (city === "Улаанбаатар" && !UB_DISTRICTS.includes(district)) go(path, "error", "Дүүргээ сонгоно уу");
  if (address.length < 8) go(path, "error", "Хороо, байр, орц, тоот зэргийг дэлгэрэнгүй бичнэ үү");
  const total = qty * issue.print_price + issue.delivery_fee;
  const bal = Number(await walletBalance(user.id));
  if (bal < total) go(path, "error", `Хэтэвчинд ${fmtMnt(total)} хэрэгтэй, танд ${fmtMnt(bal)} байна. Хэтэвчээ цэнэглээд дахин оролдоорой`);
  const id = await placeOrder(user.id, issue, { qty, name, phone, city, district: city === "Улаанбаатар" ? district : district || null, address, note: note || null }, currentPeriod());
  if (!id) go(path, "error", "Захиалж чадсангүй. Үлдэгдлээ шалгаад дахин оролдоно уу");
  // Хүргэлтийн систем холбогдсон бол шууд илгээнэ, үгүй бол редакц жагсаалтаас хүргэлтэд өгнө
  const sent = await sendToCourier(id);
  await notifySupers({ kind: "mag_order", actorId: user.id, note: `№${issue.number} · ${qty} хувь · ${city}${sent && sent !== "sent" ? " · хүргэлт рүү илгээж чадсангүй" : ""}`, magId: issue.id });
  revalidatePath("/magazine/mine");
  go("/magazine/mine", "ok", courierOn() && sent === "sent"
    ? `Захиалга №${id} хүргэлтийн системд бүртгэгдлээ. Удахгүй хүргэгч тантай холбогдоно`
    : `Захиалга №${id} хүлээн авлаа. Редакц хүргэлтэд өгөхөд танд мэдэгдэл очно`);
}

// Дараагийн дугаарт нийтлэл, баннер байршуулах хүсэлт
export async function sendRequest(formData) {
  const user = await viewer();
  const path = "/magazine/request";
  if (user.restricted_at) go(path, "error", "Таны эрх хязгаарлагдсан байна");
  const kind = formData.get("kind") === "banner" ? "banner" : "article";
  const size = kind === "banner" && BANNER_SIZES.includes(formData.get("size")) ? formData.get("size") : null;
  const name = clean(formData.get("name"), 80);
  const org = clean(formData.get("org"), 120);
  const phone = phoneOf(formData.get("phone"));
  const email = emailOf(formData.get("email"));
  const message = text(formData.get("message"), 3000);
  if (name.length < 2) go(path, "error", "Нэрээ бичнэ үү");
  if (!phone) go(path, "error", "Утасны дугаараа 8 оронтойгоор бичнэ үү");
  if (email === null) go(path, "error", "Имэйл хаяг буруу байна");
  if (message.length < 20) go(path, "error", kind === "banner" ? "Зарынхаа тухай товч бичнэ үү (20-оос дээш тэмдэгт)" : "Нийтлэлийнхээ сэдэв, агуулгыг товч бичнэ үү (20-оос дээш тэмдэгт)");
  if (kind === "banner" && !size) go(path, "error", "Баннерын хэмжээг сонгоно уу");
  const [open] = await sql`SELECT COUNT(*)::int AS n FROM magazine_requests WHERE user_id = ${user.id} AND status = 'new'`;
  if (open.n >= 3) go(path, "error", "Танд хариу хүлээж буй 3 хүсэлт байна. Хариу ирсний дараа дахин илгээнэ үү");
  const iid = Number(formData.get("issue")) || null;
  const [target] = iid ? await sql`SELECT id, number FROM magazine_issues WHERE id = ${iid} AND status IN ('soon', 'draft')` : [null];
  await sql`INSERT INTO magazine_requests (user_id, issue_id, kind, size, name, org, phone, email, message)
            VALUES (${user.id}, ${target?.id || null}, ${kind}, ${size}, ${name}, ${org || null}, ${phone}, ${email || null}, ${message})`;
  await notifySupers({ kind: "mag_req", actorId: user.id, note: `${REQUEST_KIND[kind]}${target ? ` · №${target.number}` : ""} · ${org || name || displayName(user)}`, magId: target?.id || null });
  revalidatePath("/magazine/mine");
  go("/magazine/mine", "ok", "Хүсэлтийг тань хүлээн авлаа. Редакц шийдвэрлээд танд мэдэгдэнэ", "#requests");
}
