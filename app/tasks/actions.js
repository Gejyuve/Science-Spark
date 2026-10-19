"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql, ensureSchema } from "@/lib/db";
import { getUser, needsName } from "@/lib/auth";
import { ownImage } from "@/lib/images";
import { cleanSources, bodyRule } from "@/lib/md";
import { latinShare, LATIN_LIMIT } from "@/lib/format";
import { TASK_KIND, REPORT_KIND, TYPE_MAX, TYPE_LEN, leaderClub } from "@/lib/tasks";
import { TASK_APPROVE_REWARD } from "@/lib/tasks-shared";
import { celebrate } from "@/lib/celebrate";

const back = (msg) => redirect(`/tasks/new?error=${encodeURIComponent(msg)}`);
const t = (fd, k, n) => String(fd.get(k) || "").trim().replace(/\s+/g, " ").slice(0, n);

// Сонгосон төрлүүд: давхардалгүй, богино, кириллээр
function cleanTypes(fd) {
  let arr = [];
  try { arr = JSON.parse(String(fd.get("types") || "[]")); } catch (e) { arr = []; }
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const x of arr) {
    const v = String(x || "").trim().replace(/\s+/g, " ").slice(0, TYPE_LEN);
    if (v && latinShare(v) <= LATIN_LIMIT && !out.some((o) => o.toLowerCase() === v.toLowerCase())) out.push(v);
  }
  return out.slice(0, TYPE_MAX);
}

// Клубын удирдагч клубынхээ нэрээр даалгавар нэмнэ. Редакц батласны дараа нийтлэгдэнэ.
export async function createTask(fd) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (user.restricted_at) back("Таны эрх хязгаарлагдсан байна");
  if (needsName(user)) redirect("/profile/edit");
  await ensureSchema();
  const club = await leaderClub(user.id);
  if (!club) back("Даалгаврыг зөвхөн клубын удирдагч клубынхээ нэрээр нэмнэ");
  const title = t(fd, "title", 200);
  const subtitle = t(fd, "subtitle", 250) || null;
  const body = String(fd.get("body") || "").trim().slice(0, 40000);
  const types = cleanTypes(fd);
  if (!fd.get("image")) back("Ковер зураг заавал оруулна уу");
  if (!title) back("Гарчгаа бичнэ үү");
  if (!types.length) back("Дор хаяж нэг төрөл сонгоно уу");
  const rule = bodyRule(TASK_KIND, body);
  if (rule.error) back(rule.error);
  const image = await ownImage(user.id, fd.get("image"));
  if (!image) back("Ковер зургаа дахин оруулна уу");
  const url = t(fd, "cover_url", 300);
  const source = t(fd, "cover_source", 150);
  const meta = {
    types,
    sources: cleanSources(fd.get("sources")),
    cover: source ? { source, url: /^https?:\/\/\S+$/i.test(url) ? url : null } : null,
  };
  const [p] = await sql`
    INSERT INTO posts (author_id, club_id, kind, title, subtitle, body, status, image_id, meta)
    VALUES (${user.id}, ${club.id}, ${TASK_KIND}, ${title}, ${subtitle}, ${body}, 'pending', ${image}, ${JSON.stringify(meta)}::jsonb)
    RETURNING id`;
  revalidatePath("/review", "layout");
  await celebrate(user, { kind: TASK_KIND, status: "pending", title, href: `/post/${p.id}`, later: [["Редакц батлахад клубт", TASK_APPROVE_REWARD]] });
  redirect(`/post/${p.id}?ok=${encodeURIComponent("Даалгавар редакц руу илгээгдлээ. Батлагдмагц «Даалгавар» хуудсанд нийтлэгдэнэ.")}`);
}

// Клуб биелүүлсэн даалгавраа тайлагнана. Редакц баталбал нийтлэл шиг нийтлэгдэж, клубууд оч авна.
export async function createReport(fd) {
  const taskId = Number(fd.get("task_id")) || 0;
  const fail = (msg) => redirect(`/reports/new?${taskId ? `task=${taskId}&` : ""}error=${encodeURIComponent(msg)}`);
  const user = await getUser();
  if (!user) redirect("/login");
  if (user.restricted_at) fail("Таны эрх хязгаарлагдсан байна");
  if (needsName(user)) redirect("/profile/edit");
  await ensureSchema();
  const club = await leaderClub(user.id);
  if (!club) fail("Тайланг зөвхөн клубын удирдагч клубынхээ нэрээр нэмнэ");
  if (!taskId) fail("Биелүүлсэн даалгавраа сонгоно уу");
  const [task] = await sql`SELECT id FROM posts WHERE id = ${taskId} AND kind = ${TASK_KIND} AND status = 'published'`;
  if (!task) fail("Сонгосон даалгавар олдсонгүй");
  const [dup] = await sql`SELECT id FROM posts WHERE task_id = ${taskId} AND club_id = ${club.id} AND kind = ${REPORT_KIND} AND status IN ('pending', 'published')`;
  if (dup) fail("Энэ даалгаврын тайланг клуб тань аль хэдийн илгээсэн байна");
  const title = t(fd, "title", 200);
  const subtitle = t(fd, "subtitle", 250) || null;
  const body = String(fd.get("body") || "").trim().slice(0, 40000);
  if (!fd.get("image")) fail("Ковер зураг заавал оруулна уу");
  if (!title) fail("Гарчгаа бичнэ үү");
  const rule = bodyRule(REPORT_KIND, body);
  if (rule.error) fail(rule.error);
  const image = await ownImage(user.id, fd.get("image"));
  if (!image) fail("Ковер зургаа дахин оруулна уу");
  const url = t(fd, "cover_url", 300);
  const source = t(fd, "cover_source", 150);
  const meta = {
    sources: cleanSources(fd.get("sources")),
    cover: source ? { source, url: /^https?:\/\/\S+$/i.test(url) ? url : null } : null,
  };
  const [p] = await sql`
    INSERT INTO posts (author_id, club_id, task_id, kind, title, subtitle, body, status, image_id, meta)
    VALUES (${user.id}, ${club.id}, ${taskId}, ${REPORT_KIND}, ${title}, ${subtitle}, ${body}, 'pending', ${image}, ${JSON.stringify(meta)}::jsonb)
    RETURNING id`;
  revalidatePath("/review", "layout");
  await celebrate(user, { kind: REPORT_KIND, status: "pending", title, href: `/post/${p.id}` });
  redirect(`/post/${p.id}?ok=${encodeURIComponent("Тайлан редакц руу илгээгдлээ. Батлагдмагц нийтлэгдэж, клуб тань даалгаврын очийг авна.")}`);
}
