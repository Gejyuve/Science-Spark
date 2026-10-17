"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql, ensureSchema } from "@/lib/db";
import { getUser, isStaff, isSuperAdmin, isAdmin, needsName } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { KINDS, QUICK_KINDS, INSTANT_KINDS, EVENT_TYPES, EVENT_FORMATS } from "@/lib/format";

export async function createPost(formData) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (needsName(user)) redirect("/profile/edit");
  const kind = KINDS.includes(formData.get("kind")) ? formData.get("kind") : "Нийтлэл";
  const title = String(formData.get("title") || "").trim().slice(0, 200);
  const body = String(formData.get("body") || "").trim().slice(0, 20000);
  const subtitle = String(formData.get("subtitle") || "").trim().slice(0, 250) || null;
  if (!title || !body) {
    redirect(`/write?error=${encodeURIComponent("Гарчиг болон агуулгаа бөглөнө үү")}`);
  }
  await ensureSchema();
  // Хэн бичсэн ч (хянагч, админ, супер админ ч) өөр хянагч батлах хүртэл нийтлэгдэхгүй.
  const rows = await sql`
    INSERT INTO posts (author_id, kind, title, subtitle, body, status)
    VALUES (${user.id}, ${kind}, ${title}, ${subtitle}, ${body}, 'pending')
    RETURNING id`;
  revalidatePath("/");
  redirect(`/post/${rows[0].id}`);
}

export async function addComment(formData) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (needsName(user)) redirect("/profile/edit");
  const postId = Number(formData.get("post_id"));
  const body = String(formData.get("body") || "").trim().slice(0, 2000);
  if (!Number.isInteger(postId) || !body) return;
  await ensureSchema();
  const ok = await sql`SELECT author_id FROM posts WHERE id = ${postId} AND status = 'published'`;
  if (!ok.length) return;
  await sql`INSERT INTO comments (post_id, author_id, body) VALUES (${postId}, ${user.id}, ${body})`;
  await notify({ userId: ok[0].author_id, kind: "comment", actorId: user.id, postId });
  revalidatePath(`/post/${postId}`);
  revalidatePath("/");
}

// Оч өгөх: нэг хүн нэг нийтлэлд нэг л удаа, өөртөө өгөх боломжгүй.
// Зохиогчид +1 оч очны дансанд (ledger) бичигдэнэ.
export async function sparkPost(formData) {
  const user = await getUser();
  if (!user) redirect("/login");
  const postId = Number(formData.get("post_id"));
  if (!Number.isInteger(postId)) return;
  await ensureSchema();
  const post = await sql`SELECT author_id FROM posts WHERE id = ${postId} AND status = 'published'`;
  if (!post.length || post[0].author_id === user.id) return;
  const ins = await sql`
    INSERT INTO sparks (post_id, user_id) VALUES (${postId}, ${user.id})
    ON CONFLICT DO NOTHING RETURNING post_id`;
  if (ins.length) {
    await sql`INSERT INTO points_ledger (user_id, delta, reason)
              VALUES (${post[0].author_id}, 1, ${"spark:post:" + postId + ":from:" + user.id})`;
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
  const body = String(formData.get("body") || "").trim().slice(0, 20000);
  const subtitle = String(formData.get("subtitle") || "").trim().slice(0, 250) || null;
  if (!Number.isInteger(postId) || !title || !body) redirect("/");
  await ensureSchema();
  // Засвар хийсэн нийтлэл (хэн ч бичсэн) дахин өөр хянагчийн шалгалтад орно.
  await sql`UPDATE posts SET kind = ${kind}, title = ${title}, subtitle = ${subtitle}, body = ${body},
            status = 'pending', reviewer_id = NULL, reviewed_at = NULL, review_note = NULL
            WHERE id = ${postId} AND author_id = ${user.id}`;
  revalidatePath(`/post/${postId}`);
  revalidatePath("/");
  redirect(`/post/${postId}`);
}

export async function deletePost(formData) {
  const user = await getUser();
  if (!user) redirect("/login");
  const postId = Number(formData.get("post_id"));
  if (!Number.isInteger(postId)) redirect("/");
  await ensureSchema();
  await sql`DELETE FROM posts WHERE id = ${postId} AND author_id = ${user.id}`;
  revalidatePath("/");
  redirect("/");
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
  revalidatePath(`/u/${target}`);
}

export async function reviewPost(formData) {
  const user = await getUser();
  if (!isStaff(user)) redirect("/");
  const postId = Number(formData.get("post_id"));
  const decision = formData.get("decision") === "approve" ? "published" : "rejected";
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
            RETURNING author_id`;
  if (done.length) {
    await notify({
      userId: done[0].author_id,
      kind: decision === "published" ? "approved" : "rejected",
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
  if (!note) redirect(`/post/${postId}?error=${encodeURIComponent("Хасах шалтгаанаа бичнэ үү")}`);
  await ensureSchema();
  const done = await sql`UPDATE posts SET status = 'removed', reviewer_id = ${user.id},
            reviewed_at = now(), review_note = ${note}
            WHERE id = ${postId} AND status = 'published' RETURNING author_id`;
  if (done.length) {
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
  if (needsName(user)) redirect("/profile/edit");
  const kind = String(formData.get("kind"));
  if (!QUICK_KINDS.includes(kind)) redirect("/");
  const t = (k, max) => String(formData.get(k) || "").trim().slice(0, max);
  const fail = (msg) => redirect(`/?compose=${encodeURIComponent(kind)}&error=${encodeURIComponent(msg)}`);
  const url = (v) => (v && !/^https?:\/\/\S+$/i.test(v) ? fail("Холбоос https:// -ээр эхэлнэ") : v || null);
  const short = (s) => (s.length > 90 ? s.slice(0, 90).replace(/\s+\S*$/, "") + "…" : s);

  let title, body, meta = {};
  if (kind === "Асуулт" || kind === "Бодрол") {
    body = t("body", 300);
    if (!body) fail("Агуулгаа бичнэ үү");
    title = short(body.split("\n")[0]);
    if (kind === "Бодрол") meta.source = url(t("source", 300));
  } else if (kind === "Эвент") {
    title = t("title", 200);
    body = t("body", 1000);
    meta = {
      type: EVENT_TYPES.includes(formData.get("type")) ? formData.get("type") : null,
      starts_at: t("starts_at", 20) || null,
      format: EVENT_FORMATS.includes(formData.get("format")) ? formData.get("format") : null,
      location: t("location", 200) || null,
      duration: t("duration", 60) || null,
      price: t("price", 60) || null,
      capacity: t("capacity", 10) || null,
      register: t("register", 500) || null,
      link: url(t("link", 300)),
    };
    if (!title || !body || !meta.type || !meta.starts_at || !meta.format || !meta.location || !meta.duration || !meta.price || !meta.register) {
      fail("Одтой (*) бүх талбарыг бөглөнө үү");
    }
  } else {
    title = t("title", 200);
    body = t("body", 500);
    meta = { valid_until: t("valid_until", 10) || null, contact: t("contact", 120) || null, source: url(t("source", 300)) };
    if (!title || !body) fail("Гарчиг, агуулгаа бөглөнө үү");
  }
  await ensureSchema();
  const status = INSTANT_KINDS.includes(kind) ? "published" : "pending";
  const rows = await sql`
    INSERT INTO posts (author_id, kind, title, body, status, meta)
    VALUES (${user.id}, ${kind}, ${title}, ${body}, ${status}, ${JSON.stringify(meta)}::jsonb)
    RETURNING id`;
  revalidatePath("/");
  redirect(status === "published" ? "/" : `/post/${rows[0].id}`);
}
