"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireSection, audit } from "@/lib/admin";
import { loadSettings, saveSettings } from "@/lib/settings";
import { streamOn, createUpload, deleteStream } from "@/lib/video";
import { DEFAULT_PRICE } from "@/lib/video-shared";

// Видео хэсгийг зөвхөн супер админ удирдана (Админ > Видео)
async function requireSuper() {
  const me = await requireSection("videos");
  if (me.role !== "superadmin") redirect("/admin");
  return me;
}

const clean = (v, n) => String(v || "").trim().slice(0, n);
const back = (path, key, msg) => redirect(`${path}${path.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(msg)}`);
const price = (v) => Math.min(100000, Math.max(0, Math.round(Number(v)) || 0));
const playlist = (v) => (Number(v) > 0 ? Number(v) : null);
const refresh = () => {
  revalidatePath("/admin/videos", "layout");
  revalidatePath("/video", "layout");
};

// Хөтчөөс дуудна: мөр үүсгээд, файлыг шууд Cloudflare руу илгээх холбоос буцаана
export async function startUpload({ title, body, playlistId, cost, featured }) {
  const me = await requireSuper();
  title = clean(title, 140);
  if (title.length < 2) return { error: "Видеоны гарчгийг бичнэ үү" };
  if (!streamOn()) return { error: "Cloudflare Stream холбогдоогүй байна (Vercel-д CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_STREAM_TOKEN тохируулна)" };
  try {
    const { uid, uploadURL } = await createUpload(title);
    const [v] = await sql`INSERT INTO videos (uid, title, body, created_by, playlist_id, price, featured)
                          VALUES (${uid}, ${title}, ${clean(body, 2000) || null}, ${me.id}, ${playlist(playlistId)}, ${cost === "" || cost == null ? DEFAULT_PRICE : price(cost)}, ${!!featured})
                          RETURNING id`;
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
  refresh();
}

export async function uploadDone() {
  await requireSuper();
  refresh();
}

export async function saveVideo(formData) {
  await requireSuper();
  const id = Number(formData.get("vid"));
  const title = clean(formData.get("title"), 140);
  if (title.length < 2) back(`/admin/videos/${id}`, "error", "Гарчиг 2-оос дээш тэмдэгт байна");
  await sql`UPDATE videos SET title = ${title}, body = ${clean(formData.get("body"), 2000) || null},
              playlist_id = ${playlist(formData.get("playlist"))}, price = ${price(formData.get("price"))},
              featured = ${formData.get("featured") === "on"}, updated_at = now()
            WHERE id = ${id}`;
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
  refresh();
  back(`/admin/videos/${id}`, "ok", on ? "Архивлалаа. Сайтад харагдахгүй" : "Архиваас гаргалаа");
}

// Устгах: Cloudflare-аас файлыг нэг мөсөн устгана (хадгалалтын зардал зогсоно)
export async function deleteVideo(formData) {
  const me = await requireSuper();
  const id = Number(formData.get("vid"));
  const [v] = await sql`SELECT uid, title FROM videos WHERE id = ${id}`;
  if (!v) redirect("/admin/videos");
  try {
    if (v.uid) await deleteStream(v.uid);
  } catch (e) {
    back(`/admin/videos/${id}`, "error", "Cloudflare-аас устгаж чадсангүй. Дахин оролдоно уу");
  }
  await sql`DELETE FROM videos WHERE id = ${id}`;
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
  await audit({ actorId: me.id, category: "settings", action: on ? "Видео хэсгийг нийтэд нээсэн" : "Видео хэсгийг нийтээс хаасан" });
  revalidatePath("/", "layout");
  back("/admin/videos", "ok", on ? "Видео хэсэг бүх хэрэглэгчид нээгдлээ" : "Видео хэсгийг хаалаа. Одоо зөвхөн танд харагдана");
}
