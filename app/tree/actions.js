"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql, ensureSchema } from "@/lib/db";
import { getUser, isStaff, needsName } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { audit } from "@/lib/admin";
import { latinShare, LATIN_LIMIT, LATIN_MSG } from "@/lib/format";
import { nodeOf, resetTreeCache } from "@/lib/tree";

const clean = (fd, k, max) => String(fd.get(k) || "").trim().replace(/\s+/g, " ").slice(0, max);

// Шинэ ангилал санал болгох (Figma: Шинэ үг нэмэхтэй төстэй цонх). Редакц шийдвэрлэнэ.
export async function proposeCategory(prev, fd) {
  const user = await getUser();
  if (!user) return { error: "Нэвтэрнэ үү" };
  if (needsName(user)) return { error: "Эхлээд профайлаа бөглөнө үү" };
  if (user.restricted_at) return { error: "Таны эрх хязгаарлагдсан байна" };
  const parent = String(fd.get("parent") || "");
  const name = clean(fd, "name", 60);
  const en = clean(fd, "en", 80);
  const note = String(fd.get("note") || "").trim().slice(0, 500);
  const examples = clean(fd, "examples", 300) || null;
  const source = clean(fd, "source", 300) || null;
  if (!name || !en || !note) return { error: "Одтой (*) талбаруудыг бөглөнө үү" };
  const p = nodeOf(parent);
  if (!p) return { error: "Шинэ ангилал хаана байрлахыг сонгоно уу" };
  if (latinShare(name) > LATIN_LIMIT) return { error: "Ангиллын нэрийг кириллээр бичнэ үү." };
  if (latinShare(note) > LATIN_LIMIT) return { error: LATIN_MSG };
  if (note.length < 20) return { error: "Тайлбараа дор хаяж 20 тэмдэгтээр бичнэ үү" };
  if (source && !/^https?:\/\/\S+$/i.test(source)) return { error: "Эх сурвалжийн линк https:// -ээр эхэлнэ" };
  if (p.children.some((c) => c.name.toLowerCase() === name.toLowerCase())) return { error: `«${p.name}» дотор «${name}» ангилал аль хэдийн байна` };
  await ensureSchema();
  const [dup] = await sql`SELECT 1 FROM category_requests WHERE parent = ${parent} AND lower(name) = lower(${name}) AND status = 'pending'`;
  if (dup) return { error: "Энэ ангиллыг өөр хүн санал болгосон байна. Редакц хянаж байна" };
  await sql`INSERT INTO category_requests (user_id, parent, name, en, note, examples, source) VALUES (${user.id}, ${parent}, ${name}, ${en}, ${note}, ${examples}, ${source})`;
  revalidatePath("/review", "layout");
  return { ok: true, name, where: p.name };
}

const ISSUES = ["Буруу байрласан", "Нэр буруу", "Англи нэр буруу", "Давхардсан", "Дутуу ангилал", "Бусад"];

// Ангиллын логик алдаа мэдэгдэх
export async function reportCategory(prev, fd) {
  const user = await getUser();
  if (!user) return { error: "Нэвтэрнэ үү" };
  if (user.restricted_at) return { error: "Таны эрх хязгаарлагдсан байна" };
  const path = String(fd.get("path") || "") || null;
  const issue = ISSUES.includes(fd.get("issue")) ? fd.get("issue") : "Бусад";
  const body = String(fd.get("body") || "").trim().slice(0, 300);
  if (body.length < 10) return { error: "Алдааны тайлбараа дор хаяж 10 тэмдэгтээр бичнэ үү" };
  if (path && !nodeOf(path)) return { error: "Ангилал олдсонгүй" };
  await ensureSchema();
  const [open] = await sql`SELECT COUNT(*)::int AS n FROM category_reports WHERE user_id = ${user.id} AND status = 'open'`;
  if (open.n >= 10) return { error: "Таны илгээсэн мэдэгдлүүд шийдвэрлэгдэхийг хүлээнэ үү" };
  await sql`INSERT INTO category_reports (user_id, path, issue, body) VALUES (${user.id}, ${path}, ${issue}, ${body})`;
  revalidatePath("/review", "layout");
  return { ok: true };
}

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24);

// Редакц: ангиллын санал батлах / татгалзах
export async function decideCategory(fd) {
  const user = await getUser();
  if (!isStaff(user)) redirect("/");
  const id = Number(fd.get("id"));
  const approve = fd.get("decision") === "approve";
  const note = String(fd.get("note") || "").trim().slice(0, 500) || null;
  await ensureSchema();
  const [r] = await sql`SELECT * FROM category_requests WHERE id = ${id} AND status = 'pending'`;
  if (!r) redirect("/review?t=cats");
  if (approve) {
    const name = String(fd.get("name") || r.name).trim().slice(0, 60) || r.name;
    const en = String(fd.get("en") || r.en).trim().slice(0, 80) || r.en;
    const parent = nodeOf(String(fd.get("parent") || r.parent)) ? String(fd.get("parent") || r.parent) : r.parent;
    let key = slug(en) || `c${id}`;
    if (nodeOf(parent ? `${parent}/${key}` : key)) key = `${key}-${id}`;
    const path = parent ? `${parent}/${key}` : key;
    await sql`INSERT INTO categories (path, parent, name, en, created_by) VALUES (${path}, ${parent}, ${name}, ${en}, ${r.user_id}) ON CONFLICT (path) DO NOTHING`;
    await sql`UPDATE category_requests SET status = 'approved', reviewer_id = ${user.id}, review_note = ${note}, decided_at = now() WHERE id = ${id}`;
    resetTreeCache();
    await notify({ userId: r.user_id, kind: "cat_ok", actorId: user.id, note: name });
    await audit({ actorId: user.id, category: "content", action: `Ангилал нэмсэн: ${name}`, targetType: "category", targetLabel: path });
  } else {
    if (!note) redirect(`/review?t=cats&error=${encodeURIComponent("Татгалзах шалтгаанаа бичнэ үү")}`);
    await sql`UPDATE category_requests SET status = 'declined', reviewer_id = ${user.id}, review_note = ${note}, decided_at = now() WHERE id = ${id}`;
    await notify({ userId: r.user_id, kind: "cat_no", actorId: user.id, note });
  }
  revalidatePath("/tree", "layout");
  revalidatePath("/review", "layout");
  redirect("/review?t=cats");
}

// Редакц: ангиллын мэдэгдэл шийдвэрлэсэн / хаасан
export async function resolveCategoryReport(fd) {
  const user = await getUser();
  if (!isStaff(user)) redirect("/");
  const id = Number(fd.get("id"));
  const ok = fd.get("op") === "resolved";
  await ensureSchema();
  const [r] = await sql`UPDATE category_reports SET status = ${ok ? "resolved" : "dismissed"}, resolved_by = ${user.id}, resolved_at = now()
                        WHERE id = ${id} AND status = 'open' RETURNING user_id`;
  if (r && ok) await notify({ userId: r.user_id, kind: "catrep_ok", actorId: user.id });
  revalidatePath("/review", "layout");
  redirect("/review?t=cats");
}
