"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql, ensureSchema } from "@/lib/db";
import { getUser, needsName } from "@/lib/auth";
import { ownImage } from "@/lib/images";
import { cleanSources, bodyRule } from "@/lib/md";
import { latinShare, LATIN_LIMIT } from "@/lib/format";
import { TASK_KIND, REPORT_KIND, TYPE_MAX, TYPE_LEN, LEADER_WAIT, LEADER_NO, leaderClub, memberClub } from "@/lib/tasks";
import { TASK_CLUB_TYPE } from "@/lib/clubs-shared";
import { TASK_APPROVE_REWARD } from "@/lib/tasks-shared";
import { celebrate } from "@/lib/celebrate";
import { notify } from "@/lib/notify";

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

// Клубийн гишүүн бүр клубийнхээ нэрээр даалгавар нэмнэ. Удирдагчийн нэмсэн даалгавар шууд редакц руу,
// гишүүнийх эхлээд клубийн удирдагч руу очно; удирдагч зөвшөөрвөл редакц руу илгээгдэнэ.
export async function createTask(fd) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (user.restricted_at) back("Таны эрх хязгаарлагдсан байна");
  if (needsName(user)) redirect("/profile/edit");
  await ensureSchema();
  const club = await memberClub(user.id);
  if (!club) back("Даалгаврыг клубийн гишүүд клубийнхээ нэрээр нэмнэ");
  const toLeader = !club.is_leader && !!club.leader_id;
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
    VALUES (${user.id}, ${club.id}, ${TASK_KIND}, ${title}, ${subtitle}, ${body}, ${toLeader ? LEADER_WAIT : "pending"}, ${image}, ${JSON.stringify(meta)}::jsonb)
    RETURNING id`;
  if (toLeader) {
    await notify({ userId: club.leader_id, kind: "task_club", actorId: user.id, postId: p.id, clubId: club.id });
    revalidatePath(`/club/${club.id}`);
  } else revalidatePath("/review", "layout");
  await celebrate(user, { kind: TASK_KIND, status: "pending", title, href: `/post/${p.id}`, later: [["Редакц батлахад клубт", TASK_APPROVE_REWARD]] });
  redirect(`/post/${p.id}?ok=${encodeURIComponent(toLeader
    ? "Даалгавар клубийн удирдагч руу илгээгдлээ. Удирдагч зөвшөөрвөл редакц руу очиж, батлагдмагц «Даалгавар» хуудсанд нийтлэгдэнэ."
    : "Даалгавар редакц руу илгээгдлээ. Батлагдмагц «Даалгавар» хуудсанд нийтлэгдэнэ.")}`);
}

// Клубийн удирдагч гишүүний нэмсэн даалгаврыг зөвшөөрч редакц руу илгээх, эсвэл засвар хийхээр буцаах
export async function leaderDecideTask(fd) {
  const postId = Number(fd.get("post_id")) || 0;
  const go = (k, msg) => redirect(`/post/${postId}?${k}=${encodeURIComponent(msg)}`);
  const user = await getUser();
  if (!user) redirect("/login");
  if (user.restricted_at) go("error", "Таны эрх хязгаарлагдсан байна");
  await ensureSchema();
  const club = await leaderClub(user.id);
  const [p] = await sql`SELECT id, author_id, club_id, title, status FROM posts WHERE id = ${postId} AND kind = ${TASK_KIND}`;
  if (!p || !club || p.club_id !== club.id) go("error", "Энэ даалгаврыг зөвхөн клубийн удирдагч шийднэ");
  if (p.status !== LEADER_WAIT) go("error", "Энэ даалгаврыг аль хэдийн шийдсэн байна");
  const ok = fd.get("decision") === "ok";
  const note = String(fd.get("note") || "").trim().replace(/\s+/g, " ").slice(0, 500) || null;
  if (!ok && !note) go("error", "Юуг засах хэрэгтэйг тайлбарлаж бичнэ үү");
  // Хүлээгдэж буй хэвээр байвал л шийднэ (давхар дарахаас сэргийлнэ)
  const done = ok
    ? await sql`UPDATE posts SET status = 'pending', review_note = NULL, created_at = now() WHERE id = ${postId} AND status = ${LEADER_WAIT} RETURNING id`
    : await sql`UPDATE posts SET status = ${LEADER_NO}, review_note = ${note} WHERE id = ${postId} AND status = ${LEADER_WAIT} RETURNING id`;
  if (!done.length) go("error", "Энэ даалгаврыг аль хэдийн шийдсэн байна");
  await notify({ userId: p.author_id, kind: ok ? "task_club_ok" : "task_club_no", actorId: user.id, postId, clubId: club.id, note: ok ? null : note });
  revalidatePath("/review", "layout");
  revalidatePath(`/club/${club.id}`);
  go("ok", ok ? "Даалгаврыг зөвшөөрч редакц руу илгээлээ. Редакц батлахад «Даалгавар» хуудсанд нийтлэгдэнэ." : "Даалгаврыг засвар хийхээр гишүүнд буцаалаа.");
}

// Клуб биелүүлсэн даалгавраа тайлагнана. Редакц баталбал нийтлэл шиг нийтлэгдэж, клубүүд оч авна.
export async function createReport(fd) {
  const taskId = Number(fd.get("task_id")) || 0;
  const fail = (msg) => redirect(`/reports/new?${taskId ? `task=${taskId}&` : ""}error=${encodeURIComponent(msg)}`);
  const user = await getUser();
  if (!user) redirect("/login");
  if (user.restricted_at) fail("Таны эрх хязгаарлагдсан байна");
  if (needsName(user)) redirect("/profile/edit");
  await ensureSchema();
  const club = await leaderClub(user.id);
  if (!club) fail("Тайланг зөвхөн клубийн удирдагч клубийнхээ нэрээр нэмнэ");
  if (club.club_type !== TASK_CLUB_TYPE) fail("Даалгавар биелүүлж оч авах эрх зөвхөн ЕБС-ийн клубт байна (Клубүүдийн код)");
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
