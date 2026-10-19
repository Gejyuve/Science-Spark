"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql, ensureSchema } from "@/lib/db";
import { getUser, needsName } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { audit } from "@/lib/admin";
import { latinShare, LATIN_LIMIT, LATIN_MSG } from "@/lib/format";
import { celebrate, firstReward, hadFirst, FIRST_KEYS, FIRST_REWARD } from "@/lib/celebrate";
import { TERM_KIND, DISCUSS_DAYS, DEF_MAX, TERM_REWARD, canApproveWords, synonyms } from "@/lib/terms";

const clean = (fd, k, max) => String(fd.get(k) || "").trim().replace(/\s+/g, " ").slice(0, max);

// Маягтын талбаруудыг уншиж шалгана. Алдаа бол мессеж буцаана.
function readTerm(fd) {
  const title = clean(fd, "title", 80);
  const body = String(fd.get("body") || "").trim().slice(0, DEF_MAX);
  const meta = {
    en: clean(fd, "en", 120),
    ru: clean(fd, "ru", 120) || null,
    la: clean(fd, "la", 120) || null,
    synonyms: synonyms({ synonyms: clean(fd, "synonyms", 300) }).slice(0, 8),
    source: clean(fd, "source", 300) || null,
    refs: clean(fd, "refs", 300) || null,
  };
  if (!title || !meta.en || !body) return { error: "Одтой (*) талбаруудыг бөглөнө үү" };
  if (latinShare(title) > LATIN_LIMIT) return { error: "Нэр томьёог кириллээр бичнэ үү." };
  if (latinShare(body) > LATIN_LIMIT) return { error: LATIN_MSG };
  if (body.length < 20) return { error: "Тайлбараа дор хаяж 20 тэмдэгтээр бичнэ үү" };
  if (meta.source && !/^https?:\/\/\S+$/i.test(meta.source)) return { error: "Эх сурвалжийн линк https:// -ээр эхэлнэ" };
  return { title, body, meta };
}

// Шинэ үг дэвшүүлэх: шууд хэлэлцүүлэгт орно
export async function proposeTerm(prev, fd) {
  const user = await getUser();
  if (!user) return { error: "Нэвтэрнэ үү" };
  if (needsName(user)) return { error: "Эхлээд профайлаа бөглөнө үү" };
  if (user.restricted_at) return { error: "Таны эрх хязгаарлагдсан байна" };
  const t = readTerm(fd);
  if (t.error) return t;
  await ensureSchema();
  const [dup] = await sql`SELECT id, status FROM posts WHERE kind = ${TERM_KIND} AND lower(title) = lower(${t.title})
                          AND status IN ('published', 'discussion', 'pending') LIMIT 1`;
  if (dup) return { error: dup.status === "published" ? "Энэ үг Толь-д бүртгэлтэй байна" : "Энэ үг хэлэлцүүлэгт байна", dup: dup.id };
  t.meta.discuss_until = new Date(Date.now() + DISCUSS_DAYS * 86400000).toISOString();
  const [row] = await sql`INSERT INTO posts (author_id, kind, title, body, status, meta)
                          VALUES (${user.id}, ${TERM_KIND}, ${t.title}, ${t.body}, 'discussion', ${JSON.stringify(t.meta)}::jsonb)
                          RETURNING id`;
  revalidatePath("/dict");
  const later = [["Толь-д батлагдахад", TERM_REWARD]];
  if (!(await hadFirst(user.id, "word"))) later.push([FIRST_KEYS.word, FIRST_REWARD]);
  await celebrate(user, { kind: TERM_KIND, status: "discussion", title: t.title, href: `/post/${row.id}`, later });
  return { ok: true, id: row.id, title: t.title };
}

// Хэлэлцүүлэгт санал өгөх. Дахин дарвал саналаа буцаана.
export async function voteTerm(fd) {
  const user = await getUser();
  if (!user) redirect("/login");
  const id = Number(fd.get("post_id"));
  const vote = Number(fd.get("vote")) > 0 ? 1 : -1;
  const back = String(fd.get("back") || `/post/${id}`);
  if (!Number.isInteger(id)) redirect("/dict");
  await ensureSchema();
  const [p] = await sql`SELECT author_id FROM posts WHERE id = ${id} AND kind = ${TERM_KIND} AND status = 'discussion'`;
  if (p && p.author_id !== user.id && !user.restricted_at) {
    const del = await sql`DELETE FROM term_votes WHERE post_id = ${id} AND user_id = ${user.id} AND vote = ${vote} RETURNING 1`;
    if (!del.length) {
      await sql`INSERT INTO term_votes (post_id, user_id, vote) VALUES (${id}, ${user.id}, ${vote})
                ON CONFLICT (post_id, user_id) DO UPDATE SET vote = EXCLUDED.vote, created_at = now()`;
    }
  }
  revalidatePath("/dict");
  revalidatePath(`/post/${id}`);
  redirect(back.startsWith("/") ? back : `/post/${id}`);
}

// Зөвшөөрөгч: засвар хадгалах / батлах / буцаах
export async function decideTerm(fd) {
  const user = await getUser();
  if (!canApproveWords(user)) redirect("/");
  const id = Number(fd.get("post_id"));
  const action = String(fd.get("action"));
  const back = (k, m) => redirect(`/review/word/${id}?${k}=${encodeURIComponent(m)}`);
  if (!Number.isInteger(id)) redirect("/review?t=words");
  await ensureSchema();
  const [p] = await sql`SELECT * FROM posts WHERE id = ${id} AND kind = ${TERM_KIND} AND status IN ('discussion', 'pending')`;
  if (!p) redirect("/review?t=words");
  if (p.author_id === user.id) back("error", "Өөрийн нэмсэн үгийг зөвшөөрөх боломжгүй");

  if (action === "save" || action === "approve") {
    const t = readTerm(fd);
    if (t.error) back("error", t.error);
    const meta = { ...(p.meta || {}), ...t.meta };
    const changed = t.title !== p.title || t.body !== p.body || JSON.stringify(t.meta) !== JSON.stringify({
      en: p.meta?.en || "", ru: p.meta?.ru || null, la: p.meta?.la || null, synonyms: synonyms(p.meta), source: p.meta?.source || null, refs: p.meta?.refs || null,
    });
    const original = changed && !p.original ? JSON.stringify({ title: p.title, body: p.body, meta: p.meta }) : null;
    await sql`UPDATE posts SET title = ${t.title}, body = ${t.body}, meta = ${JSON.stringify(meta)}::jsonb,
              original = COALESCE(original, ${original}::jsonb) WHERE id = ${id}`;
    if (action === "save") {
      if (changed) await notify({ userId: p.author_id, kind: "term_edit", actorId: user.id, postId: id });
      back("ok", "Засвар хадгалагдлаа");
    }
  }
  if (action === "approve") {
    const m = (await sql`SELECT meta FROM posts WHERE id = ${id}`)[0].meta || {};
    m.approved_at = new Date().toISOString();
    await sql`UPDATE posts SET status = 'published', reviewer_id = ${user.id}, reviewed_at = now(), review_note = NULL,
              meta = ${JSON.stringify(m)}::jsonb WHERE id = ${id}`;
    await sql`INSERT INTO points_ledger (user_id, delta, reason) VALUES (${p.author_id}, ${TERM_REWARD}, ${"term_approved:" + id})`;
    await firstReward(p.author_id, "word");
    await notify({ userId: p.author_id, kind: "term_ok", actorId: user.id, postId: id });
    await audit({ actorId: user.id, category: "content", action: "Шинэ үг баталсан", targetType: "post", targetId: id, targetLabel: p.title });
  } else if (action === "reject") {
    const note = String(fd.get("note") || "").trim().slice(0, 500);
    if (note.length < 5) back("error", "Буцаах шалтгаанаа бичнэ үү");
    await sql`UPDATE posts SET status = 'rejected', reviewer_id = ${user.id}, reviewed_at = now(), review_note = ${note} WHERE id = ${id}`;
    await notify({ userId: p.author_id, kind: "term_no", actorId: user.id, postId: id, note });
    await audit({ actorId: user.id, category: "content", action: "Шинэ үг буцаасан", targetType: "post", targetId: id, targetLabel: p.title });
  }
  revalidatePath("/dict");
  revalidatePath(`/post/${id}`);
  revalidatePath("/review");
  redirect("/review?t=words");
}
