"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql, ensureSchema } from "@/lib/db";
import { getUser } from "@/lib/auth";
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
  const rows = await sql`
    INSERT INTO posts (author_id, kind, title, body) VALUES (${user.id}, ${kind}, ${title}, ${body})
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
  const post = await sql`SELECT author_id FROM posts WHERE id = ${postId}`;
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
