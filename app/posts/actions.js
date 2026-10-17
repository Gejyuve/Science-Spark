"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql, ensureSchema } from "@/lib/db";
import { getUser, isStaff, isSuperAdmin } from "@/lib/auth";
import { KINDS } from "@/lib/format";

export async function createPost(formData) {
  const user = await getUser();
  if (!user) redirect("/login");
  const kind = KINDS.includes(formData.get("kind")) ? formData.get("kind") : "Нийтлэл";
  const title = String(formData.get("title") || "").trim().slice(0, 200);
  const body = String(formData.get("body") || "").trim().slice(0, 20000);
  if (!title || !body) {
    redirect(`/write?error=${encodeURIComponent("Гарчиг болон агуулгаа бөглөнө үү")}`);
  }
  await ensureSchema();
  // Хэн бичсэн ч (хянагч, админ, супер админ ч) өөр хянагч батлах хүртэл нийтлэгдэхгүй.
  const rows = await sql`
    INSERT INTO posts (author_id, kind, title, body, status)
    VALUES (${user.id}, ${kind}, ${title}, ${body}, 'pending')
    RETURNING id`;
  revalidatePath("/");
  redirect(`/post/${rows[0].id}`);
}

export async function addComment(formData) {
  const user = await getUser();
  if (!user) redirect("/login");
  const postId = Number(formData.get("post_id"));
  const body = String(formData.get("body") || "").trim().slice(0, 2000);
  if (!Number.isInteger(postId) || !body) return;
  await ensureSchema();
  const ok = await sql`SELECT 1 FROM posts WHERE id = ${postId} AND status = 'published'`;
  if (!ok.length) return;
  await sql`INSERT INTO comments (post_id, author_id, body) VALUES (${postId}, ${user.id}, ${body})`;
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
  if (!Number.isInteger(postId) || !title || !body) redirect("/");
  await ensureSchema();
  // Засвар хийсэн нийтлэл (хэн ч бичсэн) дахин өөр хянагчийн шалгалтад орно.
  await sql`UPDATE posts SET kind = ${kind}, title = ${title}, body = ${body},
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
    await sql`INSERT INTO follows (follower_id, followee_id) VALUES (${user.id}, ${target}) ON CONFLICT DO NOTHING`;
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
  await sql`UPDATE posts SET status = ${decision}, reviewer_id = ${user.id},
            reviewed_at = now(), review_note = ${note}
            WHERE id = ${postId} AND author_id <> ${user.id} AND status = 'pending'`;
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
