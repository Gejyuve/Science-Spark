"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql, ensureSchema } from "@/lib/db";
import { getUser, isStaff, canReview } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { audit } from "@/lib/admin";
import { examState, grade, sentences, SAMPLES, ERROR_TYPES, DECISIONS } from "@/lib/exam";

const go = (path, key, msg) => redirect(`${path}?${key}=${encodeURIComponent(msg)}`);

// Шалгалт илгээх
export async function submitExam(formData) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!canReview(user) || isStaff(user)) redirect("/review");
  if (user.restricted_at) go("/review", "error", "Таны эрх хязгаарлагдсан байна");
  await ensureSchema();
  const st = await examState(user);
  if (st.state !== "open") redirect("/review");
  // Хуудас нээснээс хойш жишээ солигдсон бол дахин ачаална
  if (Number(formData.get("sample")) !== st.sample) go("/review/exam", "error", "Шалгалт шинэчлэгдсэн байна. Дахин бөглөнө үү.");
  const typeKeys = ERROR_TYPES.map(([k]) => k);
  const n = sentences(SAMPLES[st.sample]).length;
  const marks = {};
  for (let i = 0; i < n; i++) {
    const v = String(formData.get(`m${i}`) || "");
    if (typeKeys.includes(v)) marks[i] = v;
  }
  const decision = String(formData.get("decision") || "");
  const note = String(formData.get("note") || "").trim().slice(0, 1000);
  if (!DECISIONS.some(([k]) => k === decision)) go("/review/exam", "error", "Шийдвэрээ сонгоно уу");
  if (note.length < 20) go("/review/exam", "error", "Бичээчид үлдээх тайлбараа дор хаяж 20 тэмдэгтээр бичнэ үү");
  const r = grade(st.sample, marks, decision);
  const [a] = await sql`INSERT INTO exam_attempts (user_id, sample, answers, result, score, passed)
            VALUES (${user.id}, ${st.sample}, ${JSON.stringify({ marks, decision, note })}::jsonb,
                    ${JSON.stringify(r)}::jsonb, ${r.score}, ${r.passed}) RETURNING id`;
  await audit({ actorId: user.id, category: "role", action: `Хянагчийн шалгалт: ${r.score} оноо, ${r.passed ? "тэнцсэн" : "тэнцээгүй"}`, targetType: "user", targetId: user.id });
  if (r.passed) {
    await sql`INSERT INTO reviewer_requests (user_id, attempt_id) VALUES (${user.id}, ${a.id})
              ON CONFLICT (user_id) WHERE status = 'pending' DO NOTHING`;
  }
  revalidatePath("/review");
  redirect(`/review/exam/${a.id}`);
}

const CHECKS_POST = 5;
const CHECKS_EVENT = 6;

// Хянагчийн шийдвэр: зөвшөөрөх (засвартай байж болно) эсвэл бичээч рүү буцаах
export async function decidePost(formData) {
  const user = await getUser();
  if (!isStaff(user)) redirect("/");
  if (user.restricted_at) go("/review", "error", "Таны эрх хязгаарлагдсан байна");
  await ensureSchema();
  const id = Number(formData.get("post_id"));
  if (!Number.isInteger(id)) redirect("/review");
  const back = `/review/${id}`;
  const [p] = await sql`SELECT id, author_id, kind, title, subtitle, body, status, original FROM posts WHERE id = ${id}`;
  if (!p || p.status !== "pending") go("/review", "error", "Энэ контент хянагдсан эсвэл олдсонгүй");
  if (p.author_id === user.id) go("/review", "error", "Өөрийн контентыг өөр хянагч хянана");
  const approve = formData.get("decision") === "approve";
  const note = String(formData.get("note") || "").trim().slice(0, 1000) || null;
  const editable = p.kind === "Нийтлэл" || p.kind === "Мэдээ";

  if (!approve) {
    if (!note) go(back, "error", "Буцаахдаа бичээчид тайлбар бичнэ үү");
    const d = await sql`UPDATE posts SET status = 'rejected', reviewer_id = ${user.id}, reviewed_at = now(), review_note = ${note}
                        WHERE id = ${id} AND status = 'pending' AND author_id <> ${user.id} RETURNING id`;
    if (d.length) {
      await audit({ actorId: user.id, category: "content", action: `${p.kind} буцаасан (${note})`, targetType: "post", targetId: id, targetLabel: p.title });
      await notify({ userId: p.author_id, kind: "rejected", actorId: user.id, postId: id, note });
    }
    revalidatePath("/review", "layout");
    go("/review", "ok", "Бичээч рүү буцаалаа");
  }

  const checks = formData.getAll("check").length;
  if (checks < (editable ? CHECKS_POST : CHECKS_EVENT)) go(back, "error", "Зөвшөөрөхийн өмнө хяналтын жагсаалтыг бүрэн тэмдэглэнэ үү");

  let title = p.title, subtitle = p.subtitle, body = p.body, original = p.original;
  if (editable) {
    title = String(formData.get("title") || "").trim().slice(0, 200);
    subtitle = String(formData.get("subtitle") || "").trim().slice(0, 250) || null;
    body = String(formData.get("body") || "").trim().slice(0, 20000);
    if (!title || !body) go(back, "error", "Гарчиг, агуулга хоосон байж болохгүй");
    const changed = title !== p.title || (subtitle || null) !== (p.subtitle || null) || body !== p.body;
    if (changed && !original) original = { title: p.title, subtitle: p.subtitle, body: p.body };
  }
  const d = await sql`UPDATE posts SET status = 'published', reviewer_id = ${user.id}, reviewed_at = now(), review_note = ${note},
                        title = ${title}, subtitle = ${subtitle}, body = ${body},
                        original = ${original ? JSON.stringify(original) : null}::jsonb
                      WHERE id = ${id} AND status = 'pending' AND author_id <> ${user.id} RETURNING id`;
  if (d.length) {
    await audit({ actorId: user.id, category: "content", action: `${p.kind} зөвшөөрсөн${original && !p.original ? " (засвартай)" : ""}`, targetType: "post", targetId: id, targetLabel: title });
    await notify({ userId: p.author_id, kind: "approved", actorId: user.id, postId: id, note });
  }
  revalidatePath("/");
  revalidatePath(`/post/${id}`);
  revalidatePath("/review", "layout");
  go("/review", "ok", "Нийтлэгдлээ");
}
