"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireSection, audit } from "@/lib/admin";
import { loadSettings, saveSettings } from "@/lib/settings";
import { streamOn, createUpload, deleteStream, syncVideoPosts, MAX_VIDEO_BYTES } from "@/lib/video";
import { VIDEO_KIND } from "@/lib/video-shared";
import { validCategory } from "@/lib/tree";

// Видео хэсгийг зөвхөн супер админ удирдана (Админ > Видео)
async function requireSuper() {
  const me = await requireSection("videos");
  if (me.role !== "superadmin") redirect("/admin");
  return me;
}

const clean = (v, n) => String(v || "").trim().slice(0, n);
const back = (path, key, msg) => redirect(`${path}${path.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(msg)}`);
const price = (v) => Math.min(100000, Math.max(0, Math.round(Number(v)) || 0));
const mnt = (v) => Math.min(1000000, Math.max(0, Math.round(Number(v) / 100) * 100 || 0));
const category = (v) => (validCategory(String(v || "")) ? String(v) : null);
// Хоёр үнийг супер админ заавал өөрөө бичнэ (0 = тэр аргаар нээх сонголтгүй)
const missing = (v) => v == null || String(v).trim() === "";
async function thumbImage(v) {
  const id = Number(v);
  if (!(id > 0)) return null;
  const [img] = await sql`SELECT id FROM images WHERE id = ${id}`;
  return img ? img.id : null;
}

// Нийтлэх профайл: супер админ өөрөө эсвэл түүний удирддаг бот
async function author(me, v) {
  const id = Number(v);
  if (!id || id === me.id) return me.id;
  const [b] = await sql`SELECT id FROM users WHERE id = ${id} AND is_bot`;
  return b ? b.id : me.id;
}
const playlist = (v) => (Number(v) > 0 ? Number(v) : null);
const refresh = () => {
  revalidatePath("/admin/videos", "layout");
  revalidatePath("/video", "layout");
};

// Хөтчөөс дуудна: видео + түүний контентыг (posts, «Видео») үүсгээд файлыг шууд Cloudflare руу илгээх холбоос буцаана.
// Контент видео бэлэн болж, хэсэг нийтэд нээлттэй үед л нийтлэгдэнэ (syncVideoPosts).
export async function startUpload(f) {
  const me = await requireSuper();
  const title = clean(f.title, 140);
  if (title.length < 2) return { error: "Видеоны гарчгийг бичнэ үү" };
  if (missing(f.price) || missing(f.price_mnt)) return { error: "Очоор болон төгрөгөөр нээх үнийг бичнэ үү (сонголтгүй бол 0)" };
  const size = Number(f.size);
  if (!(size > 0) || size > MAX_VIDEO_BYTES) return { error: "Файлын хэмжээ буруу байна" };
  if (!streamOn()) return { error: "Cloudflare Stream холбогдоогүй байна (Vercel-д CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_STREAM_TOKEN тохируулна)" };
  let up;
  try {
    up = await createUpload(title, size);
  } catch (e) {
    return { error: "Cloudflare-тай холбогдож чадсангүй. Дахин оролдоно уу" };
  }
  const by = await author(me, f.author);
  const [p] = await sql`INSERT INTO posts (author_id, kind, title, subtitle, body, category, image_id, status, reviewed_at)
                        VALUES (${by}, ${VIDEO_KIND}, ${title}, ${clean(f.subtitle, 200) || null}, ${clean(f.body, 5000)}, ${category(f.category)}, ${await thumbImage(f.image)}, 'unlisted', now())
                        RETURNING id`;
  const [v] = await sql`INSERT INTO videos (uid, title, body, created_by, playlist_id, price, price_mnt, featured, post_id)
                        VALUES (${up.uid}, ${title}, ${clean(f.body, 5000) || null}, ${me.id}, ${playlist(f.playlist)},
                                ${price(f.price)}, ${mnt(f.price_mnt)},
                                ${f.featured === "on" || f.featured === true}, ${p.id})
                        RETURNING id`;
  return { id: v.id, uploadURL: up.uploadURL };
}

// Оруулалт тасарсан бол хоосон мөр, Cloudflare дээрх хоосон байрыг цэвэрлэнэ
export async function cancelUpload(id) {
  await requireSuper();
  const [v] = await sql`DELETE FROM videos WHERE id = ${Number(id)} AND status = 'processing' RETURNING uid, post_id`;
  if (v?.post_id) await sql`DELETE FROM posts WHERE id = ${v.post_id} AND kind = ${VIDEO_KIND}`;
  if (v?.uid) await deleteStream(v.uid).catch(() => {});
  refresh();
}

export async function uploadDone() {
  await requireSuper();
  refresh();
}

export async function saveVideo(formData) {
  const me = await requireSuper();
  const id = Number(formData.get("vid"));
  const title = clean(formData.get("title"), 140);
  if (title.length < 2) back(`/admin/videos/${id}`, "error", "Гарчиг 2-оос дээш тэмдэгт байна");
  const body = clean(formData.get("body"), 5000);
  if (missing(formData.get("price")) || missing(formData.get("price_mnt"))) back(`/admin/videos/${id}`, "error", "Очоор болон төгрөгөөр нээх үнийг бичнэ үү (сонголтгүй бол 0)");
  const [v] = await sql`UPDATE videos SET title = ${title}, body = ${body || null},
              playlist_id = ${playlist(formData.get("playlist"))}, price = ${price(formData.get("price"))}, price_mnt = ${mnt(formData.get("price_mnt"))},
              featured = ${formData.get("featured") === "on"}, updated_at = now()
            WHERE id = ${id} RETURNING post_id`;
  if (v?.post_id) {
    await sql`UPDATE posts SET title = ${title}, subtitle = ${clean(formData.get("subtitle"), 200) || null}, body = ${body},
                category = ${category(formData.get("category"))}, image_id = ${await thumbImage(formData.get("image"))}, author_id = ${await author(me, formData.get("author"))}
              WHERE id = ${v.post_id}`;
  }
  refresh();
  back(`/admin/videos/${id}`, "ok", "Хадгаллаа");
}

// Онцлох видеог жагсаалтаас нэг товчоор асаах, унтраах
export async function toggleFeatured(formData) {
  await requireSuper();
  await sql`UPDATE videos SET featured = NOT featured, updated_at = now() WHERE id = ${Number(formData.get("vid"))}`;
  refresh();
  redirect("/admin/videos");
}

// Архивлах: сайтаас нуугдана, файл Cloudflare дээр хадгалагдаж буцааж нээж болно
export async function archiveVideo(formData) {
  await requireSuper();
  const id = Number(formData.get("vid"));
  const on = formData.get("on") === "1";
  await sql`UPDATE videos SET status = ${on ? "archived" : "ready"}, featured = CASE WHEN ${on} THEN false ELSE featured END, updated_at = now()
            WHERE id = ${id} AND status IN ('ready', 'archived')`;
  await syncVideoPosts(id);
  refresh();
  back(`/admin/videos/${id}`, "ok", on ? "Архивлалаа. Сайтад харагдахгүй" : "Архиваас гаргалаа");
}

// Устгах: Cloudflare-аас файлыг нэг мөсөн устгана (хадгалалтын зардал зогсоно)
export async function deleteVideo(formData) {
  const me = await requireSuper();
  const id = Number(formData.get("vid"));
  const [v] = await sql`SELECT uid, title, post_id FROM videos WHERE id = ${id}`;
  if (!v) redirect("/admin/videos");
  try {
    if (v.uid) await deleteStream(v.uid);
  } catch (e) {
    back(`/admin/videos/${id}`, "error", "Cloudflare-аас устгаж чадсангүй. Дахин оролдоно уу");
  }
  await sql`DELETE FROM videos WHERE id = ${id}`;
  // Видеоны контент (сэтгэгдэл, оч) хамт устна
  if (v.post_id) await sql`DELETE FROM posts WHERE id = ${v.post_id} AND kind = ${VIDEO_KIND}`;
  await audit({ actorId: me.id, category: "content", action: "Видео устгасан", targetType: "video", targetId: id, targetLabel: v.title });
  refresh();
  back("/admin/videos", "ok", "Видеог нэг мөсөн устгалаа");
}

export async function savePlaylist(formData) {
  await requireSuper();
  const id = Number(formData.get("pid")) || 0;
  const title = clean(formData.get("title"), 80);
  if (title.length < 2) back("/admin/videos?tab=playlists", "error", "Playlist-ийн нэрийг бичнэ үү");
  const body = clean(formData.get("body"), 300) || null;
  const position = Math.round(Number(formData.get("position"))) || 0;
  if (id) await sql`UPDATE video_playlists SET title = ${title}, body = ${body}, position = ${position} WHERE id = ${id}`;
  else await sql`INSERT INTO video_playlists (title, body, position) VALUES (${title}, ${body}, ${position})`;
  refresh();
  back("/admin/videos?tab=playlists", "ok", id ? "Playlist-ийг хадгаллаа" : "Шинэ playlist нэмлээ");
}

// Playlist устгахад доторх видеонууд устахгүй, зүгээр л playlist-гүй болно
export async function deletePlaylist(formData) {
  await requireSuper();
  await sql`DELETE FROM video_playlists WHERE id = ${Number(formData.get("pid"))}`;
  refresh();
  back("/admin/videos?tab=playlists", "ok", "Playlist-ийг устгалаа. Доторх видеонууд хэвээр үлдэнэ");
}

// Видео хэсгийг бүх хэрэглэгчид нээх, буцааж хаах (зүүн цэсэнд «Видео» гарна)
export async function setVideoPublic(formData) {
  const me = await requireSuper();
  const on = formData.get("on") === "1";
  const s = await loadSettings();
  await saveSettings({ ...s, videoPublic: on });
  await syncVideoPosts();
  await audit({ actorId: me.id, category: "settings", action: on ? "Видео хэсгийг нийтэд нээсэн" : "Видео хэсгийг нийтээс хаасан" });
  revalidatePath("/", "layout");
  back("/admin/videos", "ok", on ? "Видео хэсэг бүх хэрэглэгчид нээгдлээ" : "Видео хэсгийг хаалаа. Одоо зөвхөн танд харагдана");
}
