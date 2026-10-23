"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql, ensureSchema } from "@/lib/db";
import { getUser, isSuperAdmin } from "@/lib/auth";
import { streamOn, createUpload, deleteStream } from "@/lib/video";

// Видео хуудас бэлэн болтол зөвхөн супер админ удирдана (ботоор ажиллаж байхад ч өөрийн эрхээр)
async function requireSuper() {
  const user = await getUser();
  const me = user?.operator || user;
  if (!isSuperAdmin(me)) redirect("/");
  await ensureSchema();
  return me;
}

const clean = (v, n) => String(v || "").trim().slice(0, n);

// Хөтчөөс дуудна: мөр үүсгээд, файлыг шууд Cloudflare руу илгээх холбоос буцаана
export async function startUpload({ title, body }) {
  const me = await requireSuper();
  title = clean(title, 140);
  if (title.length < 2) return { error: "Видеоны гарчгийг бичнэ үү" };
  if (!streamOn()) return { error: "Cloudflare Stream холбогдоогүй байна (Vercel-д CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_STREAM_TOKEN тохируулна)" };
  try {
    const { uid, uploadURL } = await createUpload(title);
    const [v] = await sql`INSERT INTO videos (uid, title, body, created_by) VALUES (${uid}, ${title}, ${clean(body, 2000) || null}, ${me.id}) RETURNING id`;
    return { id: v.id, uploadURL };
  } catch (e) {
    return { error: "Cloudflare-тай холбогдож чадсангүй. Дахин оролдоно уу" };
  }
}

// Оруулалт тасарсан бол хоосон мөр, Cloudflare дээрх хоосон байрыг цэвэрлэнэ
export async function cancelUpload(id) {
  await requireSuper();
  const [v] = await sql`DELETE FROM videos WHERE id = ${Number(id)} AND status = 'processing' RETURNING uid`;
  if (v?.uid) await deleteStream(v.uid).catch(() => {});
  revalidatePath("/video");
}

export async function uploadDone() {
  await requireSuper();
  revalidatePath("/video");
}

export async function saveVideo(formData) {
  await requireSuper();
  const id = Number(formData.get("vid"));
  const title = clean(formData.get("title"), 140);
  if (title.length >= 2) {
    await sql`UPDATE videos SET title = ${title}, body = ${clean(formData.get("body"), 2000) || null}, updated_at = now() WHERE id = ${id}`;
  }
  revalidatePath("/video", "layout");
  redirect(`/video/${id}`);
}

// Архивлах: сайтаас нуугдана, файл Cloudflare дээр хадгалагдаж буцааж нээж болно
export async function archiveVideo(formData) {
  await requireSuper();
  const id = Number(formData.get("vid"));
  const on = formData.get("on") === "1";
  await sql`UPDATE videos SET status = ${on ? "archived" : "ready"}, updated_at = now()
            WHERE id = ${id} AND status IN ('ready', 'archived')`;
  revalidatePath("/video", "layout");
  redirect(on ? "/video?tab=archived" : `/video/${id}`);
}

// Устгах: Cloudflare-аас файлыг нэг мөсөн устгана (хадгалалтын зардал зогсоно)
export async function deleteVideo(formData) {
  await requireSuper();
  const id = Number(formData.get("vid"));
  const [v] = await sql`SELECT uid FROM videos WHERE id = ${id}`;
  if (!v) redirect("/video");
  try {
    if (v.uid) await deleteStream(v.uid);
  } catch (e) {
    redirect(`/video/${id}?error=${encodeURIComponent("Cloudflare-аас устгаж чадсангүй. Дахин оролдоно уу")}`);
  }
  await sql`DELETE FROM videos WHERE id = ${id}`;
  revalidatePath("/video", "layout");
  redirect("/video?ok=deleted");
}
