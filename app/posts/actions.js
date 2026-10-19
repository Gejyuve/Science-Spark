"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql, ensureSchema } from "@/lib/db";
import { getUser, isStaff, isSuperAdmin, isAdmin, needsName, canWrite } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { validLocal, toMin, spanText, nowLocal } from "@/lib/events";
import { audit } from "@/lib/admin";
import { SPARK_GET_WRITING, SPARK_GET_OTHER, WRITING_KINDS, writeLevel } from "@/lib/levels";
import { sparkWeight, dailyLimit, givenToday, rewardFirstSpark } from "@/lib/spark";
import { ownImage } from "@/lib/images";
import { validCategory } from "@/lib/tree";
import { cleanSources, bodyRule } from "@/lib/md";
import { walletBalance, fmtMnt } from "@/lib/money";
import { BOUNTY_MIN, BOUNTY_MAX, REFUND_AFTER_ANSWERS, lockBounty, payBounty, refundStatement } from "@/lib/bounty";
import { KINDS, QUICK_KINDS, INSTANT_KINDS, EVENT_TYPES, EVENT_FORMATS, latinShare, LATIN_LIMIT, LATIN_MSG, EVENT_BODY_MIN, ANNOUNCE_TYPES } from "@/lib/format";
import { leaderClub, CLUB_KINDS } from "@/lib/tasks";

// Нийтлэл, мэдээний нэмэлт мэдээлэл: эх сурвалжууд, ковер зургийн эх сурвалж
function articleMeta(fd) {
  const t = (k, n) => String(fd.get(k) || "").trim().replace(/\s+/g, " ").slice(0, n);
  const url = t("cover_url", 300);
  const source = t("cover_source", 150);
  return {
    sources: cleanSources(fd.get("sources")),
    cover: source ? { source, url: /^https?:\/\/\S+$/i.test(url) ? url : null } : null,
  };
}

export async function createPost(formData) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (user.restricted_at) redirect(`/?error=${encodeURIComponent("Таны эрх хязгаарлагдсан байна")}`);
  if (needsName(user)) redirect("/profile/edit");
  const kind = KINDS.includes(formData.get("kind")) ? formData.get("kind") : "Нийтлэл";
  const title = String(formData.get("title") || "").trim().slice(0, 200);
  const body = String(formData.get("body") || "").trim().slice(0, 40000);
  const subtitle = String(formData.get("subtitle") || "").trim().slice(0, 250) || null;
  const category = String(formData.get("category") || "");
  if (!canWrite(user, kind)) redirect(`/write?error=${encodeURIComponent(`${kind} бичих эрх Түвшин ${writeLevel(kind)}-д хүрэхэд нээгдэнэ`)}`);
  if (!title || !body) {
    redirect(`/write?error=${encodeURIComponent("Гарчиг болон агуулгаа бөглөнө үү")}`);
  }
  if (!validCategory(category)) redirect(`/write?error=${encodeURIComponent("Ангиллаа (дор хаяж салбар хүртэл) сонгоно уу")}`);
  const rule = bodyRule(kind, body);
  if (rule.error) redirect(`/write?error=${encodeURIComponent(rule.error)}`);
  if (!formData.get("image") || !String(formData.get("cover_source") || "").trim()) redirect(`/write?error=${encodeURIComponent("Ковер зураг болон түүний эх сурвалжийг заавал оруулна уу")}`);
  await ensureSchema();
  // Хэн бичсэн ч (хянагч, админ, супер админ ч) өөр хянагч батлах хүртэл нийтлэгдэхгүй.
  const rows = await sql`
    INSERT INTO posts (author_id, kind, title, subtitle, body, status, image_id, category, meta)
    VALUES (${user.id}, ${kind}, ${title}, ${subtitle}, ${body}, 'draft', ${await ownImage(user.id, formData.get("image"))}, ${category}, ${JSON.stringify(articleMeta(formData))}::jsonb)
    RETURNING id`;
  revalidatePath("/");
  redirect(`/post/${rows[0].id}/preview`);
}

export async function addComment(formData) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (user.restricted_at) redirect(`/?error=${encodeURIComponent("Таны эрх хязгаарлагдсан байна")}`);
  if (needsName(user)) redirect("/profile/edit");
  const postId = Number(formData.get("post_id"));
  const body = String(formData.get("body") || "").trim().slice(0, 2000);
  if (!Number.isInteger(postId) || !body) return;
  await ensureSchema();
  const ok = await sql`SELECT author_id FROM posts WHERE id = ${postId} AND status IN ('published', 'discussion')`;
  if (!ok.length) return;
  // Хариулт: эцэг сэтгэгдэл мөн нийтлэлд байх ёстой. 3-аас гүн бол 2-р түвшинд залгана.
  let parent = Number(formData.get("parent_id")) || null;
  let parentAuthor = null;
  if (parent) {
    const [pc] = await sql`SELECT c.id, c.author_id, c.parent_id, pp.parent_id AS grand
                           FROM comments c LEFT JOIN comments pp ON pp.id = c.parent_id
                           WHERE c.id = ${parent} AND c.post_id = ${postId}`;
    if (!pc) parent = null;
    else {
      parentAuthor = pc.author_id;
      if (pc.parent_id && pc.grand) parent = pc.parent_id;
    }
  }
  const [c] = await sql`INSERT INTO comments (post_id, author_id, body, parent_id) VALUES (${postId}, ${user.id}, ${body}, ${parent}) RETURNING id`;
  if (parentAuthor) await notify({ userId: parentAuthor, kind: "reply", actorId: user.id, postId });
  if (ok[0].author_id !== parentAuthor) await notify({ userId: ok[0].author_id, kind: "comment", actorId: user.id, postId });
  revalidatePath(`/post/${postId}`);
  revalidatePath("/");
  redirect(`/post/${postId}#c${c.id}`);
  revalidatePath(`/post/${postId}`);
  revalidatePath("/");
}

// Өдрийн очны хязгаар дууссан бол буцаана (хуудас бүр error-г харуулдаггүй тул очны хуудас руу)
async function checkDaily(user) {
  const limit = dailyLimit(user);
  if ((await givenToday(user.id)) >= limit) {
    redirect(`/och?error=${encodeURIComponent(`Өнөөдрийн ${limit} оч дууслаа. Маргааш дахин өгөх боломжтой. Оч цөөн байх тусам илүү үнэ цэнэтэй.`)}#daily`);
  }
}

// Оч өгөх: нэг хүн нэг нийтлэлд нэг л удаа, өөртөө өгөх боломжгүй, өдрийн хязгаартай.
// Оч өгсөн хүнд оноо өгөхгүй (анхны очоос бусад). Зохиогч нийтлэл, мэдээнд +10, бусдад +5 авна; премиум оч 2 дахин.
export async function sparkPost(formData) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (user.restricted_at) redirect(`/?error=${encodeURIComponent("Таны эрх хязгаарлагдсан байна")}`);
  const postId = Number(formData.get("post_id"));
  if (!Number.isInteger(postId)) return;
  await ensureSchema();
  const post = await sql`SELECT author_id, kind, club_id FROM posts WHERE id = ${postId} AND status IN ('published', 'discussion')`;
  if (!post.length || post[0].author_id === user.id) return;
  // Клубын даалгаварт өөрийн клубын гишүүд оч өгөхгүй (клубын оч өөрөө өсгөхгүй)
  if (post[0].club_id && (await sql`SELECT 1 FROM club_members WHERE club_id = ${post[0].club_id} AND user_id = ${user.id}`).length) return;
  if ((await sql`SELECT 1 FROM sparks WHERE post_id = ${postId} AND user_id = ${user.id}`).length) return;
  await checkDaily(user);
  const w = sparkWeight(user);
  const ins = await sql`
    INSERT INTO sparks (post_id, user_id, weight) VALUES (${postId}, ${user.id}, ${w})
    ON CONFLICT DO NOTHING RETURNING post_id`;
  if (ins.length) {
    const get = (WRITING_KINDS.includes(post[0].kind) || CLUB_KINDS.includes(post[0].kind) ? SPARK_GET_WRITING : SPARK_GET_OTHER) * w;
    // Клубын даалгаварт ирсэн оч бичсэн хүнд биш, клубт очно
    if (post[0].club_id) await sql`INSERT INTO club_points (club_id, delta, reason) VALUES (${post[0].club_id}, ${get}, ${"spark:post:" + postId + ":from:" + user.id})`;
    else await sql`INSERT INTO points_ledger (user_id, delta, reason)
              VALUES (${post[0].author_id}, ${get}, ${"spark:post:" + postId + ":from:" + user.id})`;
    await rewardFirstSpark(user.id);
  }
  revalidatePath(`/post/${postId}`);
  revalidatePath("/");
}

export async function updatePost(formData) {
  const user = await getUser();
  if (!user) redirect("/login");
  const postId = Number(formData.get("post_id"));
  const kind = KINDS.includes(formData.get("kind")) ? formData.get("kind") : "Нийтлэл";
  const title = String(formData.get("title") || "").trim().slice(0, 200);
  const body = String(formData.get("body") || "").trim().slice(0, 40000);
  const subtitle = String(formData.get("subtitle") || "").trim().slice(0, 250) || null;
  if (!Number.isInteger(postId) || !title || !body) redirect("/");
  // Өөр төрөл рүү шилжүүлэхэд тухайн төрлийн түвшин шаардана
  const [cur] = await sql`SELECT kind FROM posts WHERE id = ${postId} AND author_id = ${user.id}`;
  if (cur && cur.kind !== kind && !canWrite(user, kind)) redirect(`/post/${postId}/edit?error=${encodeURIComponent(`${kind} бичих эрх Түвшин ${writeLevel(kind)}-д хүрэхэд нээгдэнэ`)}`);
  const category = String(formData.get("category") || "");
  if (!validCategory(category)) redirect(`/post/${postId}/edit?error=${encodeURIComponent("Ангиллаа (дор хаяж салбар хүртэл) сонгоно уу")}`);
  const rule = bodyRule(kind, body);
  if (rule.error) redirect(`/post/${postId}/edit?error=${encodeURIComponent(rule.error)}`);
  if (!formData.get("image") || !String(formData.get("cover_source") || "").trim()) redirect(`/post/${postId}/edit?error=${encodeURIComponent("Ковер зураг болон түүний эх сурвалжийг заавал оруулна уу")}`);
  await ensureSchema();
  // Засвар хийсэн нийтлэл (хэн ч бичсэн) дахин өөр хянагчийн шалгалтад орно.
  const imageId = await ownImage(user.id, formData.get("image"));
  await sql`UPDATE posts SET kind = ${kind}, title = ${title}, subtitle = ${subtitle}, body = ${body}, image_id = ${imageId}, category = ${category},
            meta = COALESCE(meta, '{}'::jsonb) || ${JSON.stringify(articleMeta(formData))}::jsonb,
            status = 'draft', reviewer_id = NULL, reviewed_at = NULL, review_note = NULL
            WHERE id = ${postId} AND author_id = ${user.id}`;
  revalidatePath(`/post/${postId}`);
  revalidatePath("/");
  redirect(`/post/${postId}/preview`);
}

// Урьдчилж харсны дараа редакц руу илгээх (Figma 454:272)
export async function submitDraft(formData) {
  const user = await getUser();
  if (!user) redirect("/login");
  const postId = Number(formData.get("post_id"));
  if (!Number.isInteger(postId)) redirect("/");
  if (!formData.get("agree")) redirect(`/post/${postId}/preview?error=${encodeURIComponent("Дүрэм ба зарчмыг зөвшөөрнө үү")}`);
  await ensureSchema();
  const [dr] = await sql`SELECT kind, body FROM posts WHERE id = ${postId} AND author_id = ${user.id} AND status = 'draft'`;
  if (dr && bodyRule(dr.kind, dr.body).error) redirect(`/post/${postId}/edit?error=${encodeURIComponent(bodyRule(dr.kind, dr.body).error)}`);
  const d = await sql`UPDATE posts SET status = 'pending', created_at = now() WHERE id = ${postId} AND author_id = ${user.id} AND status = 'draft' RETURNING id`;
  revalidatePath("/review", "layout");
  revalidatePath(`/u/${user.id}`);
  redirect(d.length ? `/post/${postId}?ok=${encodeURIComponent("Редакц руу илгээлээ. Хянагдсаны дараа танд мэдэгдэл ирнэ.")}` : `/post/${postId}`);
}

export async function deletePost(formData) {
  const user = await getUser();
  if (!user) redirect("/login");
  const postId = Number(formData.get("post_id"));
  if (!Number.isInteger(postId)) redirect("/");
  await ensureSchema();
  const [b] = await sql`SELECT id FROM bounties WHERE post_id = ${postId} AND user_id = ${user.id} AND status = 'open'`;
  if (b && !REFUND_AFTER_ANSWERS) {
    const [a] = await sql`SELECT COUNT(*)::int AS n FROM comments WHERE post_id = ${postId} AND parent_id IS NULL AND author_id <> ${user.id}`;
    if (a.n > 0) redirect(`/post/${postId}?error=${encodeURIComponent("Хариулт ирсэн шагналтай асуултыг устгах боломжгүй. Хамгийн зөв хариултыг сонгож шагналаа олгоно уу.")}`);
  }
  // Шагнал байвал түгжээг тайлж хэтэвч рүү буцаагаад асуултыг устгана (нэг гүйлгээнд)
  await sql.transaction([
    refundStatement(postId, user.id),
    sql`DELETE FROM posts WHERE id = ${postId} AND author_id = ${user.id}`,
  ]);
  revalidatePath("/");
  revalidatePath("/wallet");
  redirect(b ? `/wallet?ok=${encodeURIComponent("Асуултыг устгаж, түгжсэн шагналын мөнгийг хэтэвчинд тань буцаалаа")}` : "/");
}

// Асуулт асуухад, эсвэл дараа нь асуугч өөрөө нэмэх шагналын дүн
function bountyAmount(formData) {
  const raw = String(formData.get("bounty") || "").replace(/[\s,₮]/g, "");
  if (!raw) return 0;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < BOUNTY_MIN || n > BOUNTY_MAX) return -1;
  return n;
}

export async function addBounty(formData) {
  const user = await getUser();
  if (!user) redirect("/login");
  const postId = Number(formData.get("post_id"));
  if (!Number.isInteger(postId)) redirect("/");
  const back = (q) => redirect(`/post/${postId}?${q}`);
  const amount = bountyAmount(formData);
  if (amount <= 0) back(`error=${encodeURIComponent(`Шагналын дүнг ${fmtMnt(BOUNTY_MIN)}-${fmtMnt(BOUNTY_MAX)} хооронд оруулна уу`)}`);
  await ensureSchema();
  const [p] = await sql`SELECT id, title FROM posts WHERE id = ${postId} AND author_id = ${user.id} AND kind = 'Асуулт' AND status = 'published'`;
  if (!p) redirect(`/post/${postId}`);
  if ((await walletBalance(user.id)) < amount) back(`error=${encodeURIComponent("Хэтэвчинд тань хүрэлцэх мөнгө алга. Хэтэвчээ цэнэглээд дахин оролдоно уу.")}`);
  if (!(await lockBounty(user.id, postId, p.title, amount))) back(`error=${encodeURIComponent("Шагнал тавьж чадсангүй. Хэтэвчээ шалгана уу, эсвэл энэ асуулт аль хэдийн шагналтай байна.")}`);
  revalidatePath("/");
  revalidatePath(`/post/${postId}`);
  back(`ok=${encodeURIComponent(`${fmtMnt(amount)}-ийн шагнал тавилаа. Мэдлэгээ хуваалцах хүмүүсийг урамшуулсанд баярлалаа!`)}`);
}

// Асуугч зөв гэж үзсэн хариултаа сонгоход шагнал хариулагчийн хэтэвч рүү орно
export async function awardBounty(formData) {
  const user = await getUser();
  if (!user) redirect("/login");
  const commentId = Number(formData.get("comment_id"));
  if (!Number.isInteger(commentId)) redirect("/");
  await ensureSchema();
  const [c] = await sql`
    SELECT c.id, c.post_id, c.author_id, b.id AS bounty_id, b.amount, b.title
    FROM comments c JOIN bounties b ON b.post_id = c.post_id AND b.status = 'open' AND b.user_id = ${user.id}
    WHERE c.id = ${commentId} AND c.parent_id IS NULL`;
  if (!c) redirect("/");
  if (!c.author_id || c.author_id === user.id) redirect(`/post/${c.post_id}`);
  const ok = await payBounty({ id: c.bounty_id, amount: c.amount, title: c.title }, c.author_id, c.id);
  if (ok) await notify({ userId: c.author_id, kind: "bounty_won", actorId: user.id, postId: c.post_id });
  revalidatePath("/");
  revalidatePath(`/post/${c.post_id}`);
  redirect(`/post/${c.post_id}?ok=${encodeURIComponent(ok ? "Шагналыг олголоо. Мэдлэгээ хуваалцсан хүнийг урамшуулсанд баярлалаа!" : "Энэ асуултын шагнал аль хэдийн олгогдсон байна")}#c${c.id}`);
}

export async function toggleFollow(formData) {
  const user = await getUser();
  if (!user) redirect("/login");
  const target = Number(formData.get("user_id"));
  if (!Number.isInteger(target) || target === user.id) return;
  await ensureSchema();
  const del = await sql`DELETE FROM follows WHERE follower_id = ${user.id} AND followee_id = ${target} RETURNING 1`;
  if (!del.length) {
    const ins = await sql`INSERT INTO follows (follower_id, followee_id) VALUES (${user.id}, ${target})
                          ON CONFLICT DO NOTHING RETURNING 1`;
    if (ins.length) await notify({ userId: target, kind: "follow", actorId: user.id });
  }
  revalidatePath("/", "layout");
}

export async function reviewPost(formData) {
  const user = await getUser();
  if (!isStaff(user)) redirect("/");
  const postId = Number(formData.get("post_id"));
  const approve = formData.get("decision") === "approve";
  const [k] = await sql`SELECT kind FROM posts WHERE id = ${Number(formData.get("post_id")) || 0}`;
  const decision = !approve ? "rejected" : k && ["Нийтлэл", "Мэдээ"].includes(k.kind) ? "approved" : "published";
  const note = String(formData.get("note") || "").trim().slice(0, 1000) || null;
  if (!Number.isInteger(postId)) return;
  if (decision === "rejected" && !note) {
    redirect(`/review?error=${encodeURIComponent("Татгалзахдаа шалтгаанаа бичнэ үү")}`);
  }
  await ensureSchema();
  // Өөрийнхөө нийтлэлийг өөрөө батлахгүй.
  const done = await sql`UPDATE posts SET status = ${decision}, reviewer_id = ${user.id},
            reviewed_at = now(), review_note = ${note}
            WHERE id = ${postId} AND author_id <> ${user.id} AND status = 'pending'
            RETURNING author_id, title`;
  if (done.length) {
    await audit({ actorId: user.id, category: "content", action: decision !== "rejected" ? "Нийтлэл баталсан" : `Нийтлэл буцаасан (${note})`, targetType: "post", targetId: postId, targetLabel: done[0].title });
    await notify({
      userId: done[0].author_id,
      kind: decision === "approved" ? "reviewed" : decision === "published" ? "approved" : "rejected",
      actorId: user.id,
      postId,
      note,
    });
  }
  revalidatePath("/review");
  revalidatePath("/");
  redirect("/review");
}

export async function setRole(formData) {
  const user = await getUser();
  if (!isSuperAdmin(user)) redirect("/");
  const target = Number(formData.get("user_id"));
  const role = String(formData.get("role"));
  // Супер админ эрхийг зөвхөн SUPER_ADMIN_EMAILS-ээр олгоно, энд томилохгүй.
  if (!Number.isInteger(target) || !["user", "reviewer", "admin"].includes(role)) return;
  if (target === user.id) return; // өөрийн эрхийг өөрчлөхгүй
  await ensureSchema();
  await sql`UPDATE users SET role = ${role} WHERE id = ${target} AND role <> 'superadmin'`;
  revalidatePath("/admin");
}

// Админ / супер админ: нийтлэгдсэн нийтлэлийг нийтээс хасна (устгахгүй, зохиогч засаад дахин илгээж болно).
export async function removePost(formData) {
  const user = await getUser();
  if (!isAdmin(user)) redirect("/");
  const postId = Number(formData.get("post_id"));
  const note = String(formData.get("note") || "").trim().slice(0, 1000);
  if (!Number.isInteger(postId)) redirect("/");
  if (!note) redirect(`/post/${postId}?error=${encodeURIComponent("Нуух шалтгаанаа бичнэ үү")}`);
  await ensureSchema();
  const done = await sql`UPDATE posts SET status = 'removed', reviewer_id = ${user.id},
            reviewed_at = now(), review_note = ${note}
            WHERE id = ${postId} AND status = 'published' RETURNING author_id, title`;
  if (done.length) {
    await audit({ actorId: user.id, category: "content", action: `Контент нуусан (${note})`, targetType: "post", targetId: postId, targetLabel: done[0].title });
    await notify({ userId: done[0].author_id, kind: "removed", actorId: user.id, postId, note });
  }
  revalidatePath(`/post/${postId}`);
  revalidatePath("/");
  redirect(`/post/${postId}`);
}

// Сэтгэгдэл устгах: өөрийнхөө сэтгэгдлийг, эсвэл админ бол хэнийх ч.
export async function deleteComment(formData) {
  const user = await getUser();
  if (!user) redirect("/login");
  const id = Number(formData.get("comment_id"));
  if (!Number.isInteger(id)) return;
  await ensureSchema();
  const rows = isAdmin(user)
    ? await sql`DELETE FROM comments WHERE id = ${id} RETURNING post_id`
    : await sql`DELETE FROM comments WHERE id = ${id} AND author_id = ${user.id} RETURNING post_id`;
  if (rows.length) {
    revalidatePath(`/post/${rows[0].post_id}`);
    revalidatePath("/");
  }
}

export async function markAllRead() {
  const user = await getUser();
  if (!user) redirect("/login");
  await ensureSchema();
  await sql`UPDATE notifications SET read_at = now() WHERE user_id = ${user.id} AND read_at IS NULL`;
  revalidatePath("/notifications");
  revalidatePath("/");
}

// Нүүрний дээд хэсгээс: Асуулт, Бодрол (шууд нийтлэгдэнэ), Эвент, Зарлал (редакц батална)
export async function quickPost(formData) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (user.restricted_at) redirect(`/?error=${encodeURIComponent("Таны эрх хязгаарлагдсан байна")}`);
  if (needsName(user)) redirect("/profile/edit");
  const kind = String(formData.get("kind"));
  if (!QUICK_KINDS.includes(kind)) redirect("/");
  const t = (k, max) => String(formData.get(k) || "").trim().slice(0, max);
  const fail = (msg) => redirect(`/?compose=${encodeURIComponent(kind)}&error=${encodeURIComponent(msg)}`);
  const url = (v) => (v && !/^https?:\/\/\S+$/i.test(v) ? fail("Холбоос https:// -ээр эхэлнэ") : v || null);
  const short = (s) => (s.length > 90 ? s.slice(0, 90).replace(/\s+\S*$/, "") + "…" : s);

  let title, body, meta = {}, bounty = 0;
  if (kind === "Асуулт" || kind === "Бодрол") {
    body = t("body", 300);
    if (!body) fail("Агуулгаа бичнэ үү");
    title = short(body.split("\n")[0]);
    if (kind === "Асуулт") bounty = bountyAmount(formData);
    if (bounty < 0) fail(`Шагналын дүнг ${fmtMnt(BOUNTY_MIN)}-${fmtMnt(BOUNTY_MAX)} хооронд оруулна уу`);
    if (bounty > 0 && (await walletBalance(user.id)) < bounty) fail("Хэтэвчинд тань хүрэлцэх мөнгө алга. Хэтэвчээ цэнэглээд дахин оролдоно уу.");
    if (kind === "Бодрол") meta.source = url(t("source", 300));
  } else if (kind === "Эвент") {
    title = t("title", 200);
    body = t("body", 1000);
    meta = {
      type: EVENT_TYPES.includes(formData.get("type")) ? formData.get("type") : null,
      starts_at: t("starts_at", 20) || null,
      format: EVENT_FORMATS.includes(formData.get("format")) ? formData.get("format") : null,
      location: t("location", 200) || null,
      ends_at: t("ends_at", 20) || null,
      price: t("price", 60) || null,
      capacity: t("capacity", 10) || null,
      register: t("register", 500) || null,
      link: url(t("link", 300)),
    };
    if (!title || !body || !meta.type || !meta.starts_at || !meta.ends_at || !meta.format || !meta.location || !meta.price || !meta.register) {
      fail("Одтой (*) бүх талбарыг бөглөнө үү");
    }
    if (body.length < EVENT_BODY_MIN) fail(`Эвентийн тайлбарыг дор хаяж ${EVENT_BODY_MIN} тэмдэгтээр бичнэ үү`);
    if (!validLocal(meta.starts_at) || !validLocal(meta.ends_at)) fail("Эхлэх, дуусах огноо цагийг зөв оруулна уу");
    const span = toMin(meta.ends_at) - toMin(meta.starts_at);
    if (span <= 0) fail("Дуусах цаг эхлэх цагаас хойш байх ёстой");
    if (span > 60 * 1440) fail("Эвент 60 хоногоос урт байж болохгүй");
    if (meta.starts_at <= nowLocal().iso) fail("Эхлэх огноо, цаг өнгөрсөн байна. Ирээдүйн цаг сонгоно уу");
    meta.duration = spanText(meta.starts_at, meta.ends_at);
  } else {
    title = t("title", 200);
    body = t("body", 500);
    meta = {
      type: ANNOUNCE_TYPES.includes(formData.get("type")) ? formData.get("type") : null,
      valid_until: t("valid_until", 10) || null,
      contact: t("contact", 120) || null,
      location: t("location", 200) || null,
      link: url(t("link", 300)),
    };
    if (!title || !body || !meta.type || !meta.valid_until || !meta.contact) fail("Одтой (*) бүх талбарыг бөглөнө үү");
    if (body.length < EVENT_BODY_MIN) fail(`Зарлалын агуулгыг дор хаяж ${EVENT_BODY_MIN} тэмдэгтээр бичнэ үү`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.valid_until)) fail("Хүчинтэй хугацааг зөв сонгоно уу");
    if (meta.valid_until < nowLocal().iso.slice(0, 10)) fail("Хүчинтэй хугацаа өнгөрсөн байна. Өнөөдрөөс хойшхи өдөр сонгоно уу");
  }
  // Тайлбар текстүүд: 30%-аас илүү латин бол хүлээж авахгүй (гарчиг, нэрэнд хамаарахгүй)
  if (latinShare(body) > LATIN_LIMIT || (meta.register && latinShare(meta.register) > LATIN_LIMIT)) fail(LATIN_MSG);
  await ensureSchema();
  if (kind === "Эвент") meta.program = await ownImage(user.id, formData.get("program"));
  // Клубын удирдагч бодрол, эвент, зарлалыг клубынхээ нэрээр хуваалцаж болно
  let clubId = null;
  if (formData.get("as_club") && kind !== "Асуулт") {
    const club = await leaderClub(user.id);
    if (!club) fail("Клубын нэрээр зөвхөн клубын удирдагч хуваалцана");
    clubId = club.id;
  }
  const imageId = kind === "Асуулт" ? null : await ownImage(user.id, formData.get("image"));
  // Эвент, зарлалд ковер зураг заавал
  if ((kind === "Эвент" || kind === "Зарлал") && !imageId) fail("Ковер зураг оруулна уу");
  const status = INSTANT_KINDS.includes(kind) ? "published" : "pending";
  const rows = await sql`
    INSERT INTO posts (author_id, club_id, kind, title, body, status, meta, image_id)
    VALUES (${user.id}, ${clubId}, ${kind}, ${title}, ${body}, ${status}, ${JSON.stringify(meta)}::jsonb, ${imageId})
    RETURNING id`;
  revalidatePath("/");
  if (bounty > 0) {
    const ok = await lockBounty(user.id, rows[0].id, title, bounty);
    redirect(`/post/${rows[0].id}?${ok ? "ok" : "error"}=${encodeURIComponent(ok ? `Асуулт ${fmtMnt(bounty)}-ийн шагналтай нийтлэгдлээ. Мэдлэгээ хуваалцах хүмүүсийг урамшуулсанд баярлалаа!` : "Асуулт нийтлэгдсэн ч шагнал тавьж чадсангүй. Хэтэвчээ шалгаад доороос дахин тавина уу.")}`);
  }
  redirect(status === "published" ? "/" : `/post/${rows[0].id}`);
}

// Бичээч: редакцаар зөвшөөрөгдсөн нийтлэл, мэдээгээ өөрөө нийтэлнэ
export async function publishOwn(formData) {
  const user = await getUser();
  if (!user) redirect("/login");
  const postId = Number(formData.get("post_id"));
  if (!Number.isInteger(postId)) redirect("/");
  await ensureSchema();
  const d = await sql`UPDATE posts SET status = 'published', created_at = now()
                      WHERE id = ${postId} AND author_id = ${user.id} AND status = 'approved' RETURNING title`;
  if (d.length) await audit({ actorId: user.id, category: "content", action: "Бичээч нийтэлсэн", targetType: "post", targetId: postId, targetLabel: d[0].title });
  revalidatePath("/");
  revalidatePath(`/post/${postId}`);
  redirect(`/post/${postId}`);
}

// Хариултад лайк дарах / буцаах. Өөрийн хариултад дарах боломжгүй.
export async function likeComment(formData) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (user.restricted_at) redirect(`/?error=${encodeURIComponent("Таны эрх хязгаарлагдсан байна")}`);
  const id = Number(formData.get("comment_id"));
  if (!Number.isInteger(id)) return;
  await ensureSchema();
  const [c] = await sql`SELECT c.author_id, c.post_id FROM comments c JOIN posts p ON p.id = c.post_id
                        WHERE c.id = ${id} AND p.status IN ('published', 'discussion')`;
  if (!c || c.author_id === user.id) return;
  // Хариултад оч: хариултын эзэнд +5 (премиум оч 2 дахин). Буцаавал олгосон очийг (хуучин дүрмийн
  // өгсөн хүний +5-ыг ч) бүртгэлээс үлдэгдлээр нь тооцож буцаана.
  const del = await sql`DELETE FROM comment_likes WHERE comment_id = ${id} AND user_id = ${user.id} RETURNING 1`;
  if (del.length) {
    const got = `spark:comment:${id}:from:${user.id}`, gotBack = `unspark:comment:${id}:from:${user.id}`;
    const gave = `spark_give:comment:${id}`, gaveBack = `unspark_give:comment:${id}`;
    await sql`INSERT INTO points_ledger (user_id, delta, reason)
              SELECT ${c.author_id}, -s, ${gotBack} FROM (SELECT COALESCE(SUM(delta), 0)::int AS s FROM points_ledger
                WHERE user_id = ${c.author_id} AND reason IN (${got}, ${gotBack})) t WHERE s > 0`;
    await sql`INSERT INTO points_ledger (user_id, delta, reason)
              SELECT ${user.id}, -s, ${gaveBack} FROM (SELECT COALESCE(SUM(delta), 0)::int AS s FROM points_ledger
                WHERE user_id = ${user.id} AND reason IN (${gave}, ${gaveBack})) t WHERE s > 0`;
  } else {
    await checkDaily(user);
    const w = sparkWeight(user);
    const ins = await sql`INSERT INTO comment_likes (comment_id, user_id, weight) VALUES (${id}, ${user.id}, ${w}) ON CONFLICT DO NOTHING RETURNING 1`;
    if (ins.length) {
      await sql`INSERT INTO points_ledger (user_id, delta, reason)
                VALUES (${c.author_id}, ${SPARK_GET_OTHER * w}, ${"spark:comment:" + id + ":from:" + user.id})`;
      await rewardFirstSpark(user.id);
    }
  }
  revalidatePath(`/post/${c.post_id}`);
  revalidatePath("/");
}

// Хадгалах / хадгалснаас хасах
export async function toggleSave(formData) {
  const user = await getUser();
  if (!user) redirect("/login");
  const postId = Number(formData.get("post_id"));
  if (!Number.isInteger(postId)) return;
  await ensureSchema();
  const del = await sql`DELETE FROM saves WHERE post_id = ${postId} AND user_id = ${user.id} RETURNING 1`;
  if (!del.length) {
    const ok = await sql`SELECT 1 FROM posts WHERE id = ${postId} AND status IN ('published', 'discussion')`;
    if (ok.length) await sql`INSERT INTO saves (post_id, user_id) VALUES (${postId}, ${user.id}) ON CONFLICT DO NOTHING`;
  }
  revalidatePath(`/post/${postId}`);
  revalidatePath("/");
  revalidatePath(`/u/${user.id}`);
}

// Логик алдаа мэдэгдэх: редакцад очно. Нэг хүн нэг нийтлэлд нэг нээлттэй мэдэгдэлтэй.
export async function reportLogic(formData) {
  const user = await getUser();
  if (!user) redirect("/login");
  const postId = Number(formData.get("post_id"));
  if (!Number.isInteger(postId)) redirect("/");
  const back = (k, m) => redirect(`/post/${postId}?${k}=${encodeURIComponent(m)}`);
  if (user.restricted_at) back("error", "Таны эрх хязгаарлагдсан байна");
  const body = String(formData.get("body") || "").trim().slice(0, 200);
  if (body.length < 10) back("error", "Алдааны тайлбараа дор хаяж 10 тэмдэгтээр бичнэ үү");
  await ensureSchema();
  const [p] = await sql`SELECT author_id, title FROM posts WHERE id = ${postId} AND status = 'published'`;
  if (!p) back("error", "Нийтлэл олдсонгүй");
  if (p.author_id === user.id) back("error", "Өөрийн нийтлэлийг засах боломжтой");
  const r = await sql`INSERT INTO logic_reports (post_id, user_id, body) VALUES (${postId}, ${user.id}, ${body})
                      ON CONFLICT (post_id, user_id) WHERE status = 'open' DO NOTHING RETURNING id`;
  if (!r.length) back("error", "Та энэ нийтлэлд мэдэгдэл илгээсэн байна. Шийдвэрлэгдэхийг хүлээнэ үү");
  await audit({ actorId: user.id, category: "content", action: "Логик алдаа мэдэгдсэн", targetType: "post", targetId: postId, targetLabel: p.title });
  back("ok", "Баярлалаа! Таны мэдэгдэл редакцад очлоо. Шийдвэрлэгдэхэд мэдэгдэл ирнэ.");
}
