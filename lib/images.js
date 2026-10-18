import { put } from "@vercel/blob";
import { sql } from "./db";

export const MAX_BYTES = 1_500_000;
export const DAILY_LIMIT = 60;

// Файлын эхний байтаар төрлийг шалгана (нэрэнд нь итгэхгүй)
export function sniff(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

// Маягтаас ирсэн зургийн дугаарыг шалгана: тухайн хэрэглэгчийн оруулсан зураг байх ёстой
export async function ownImage(userId, raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return null;
  const r = await sql`SELECT id FROM images WHERE id = ${id} AND owner_id = ${userId}`;
  return r.length ? id : null;
}

// "50% 30%" хэлбэрийн байрлал
export const cleanPos = (v) => (/^\d{1,3}% \d{1,3}%$/.test(String(v || "")) ? String(v) : null);

export const imgUrl = (id) => (id ? `/img/${id}` : null);

// Vercel Blob холбогдсон эсэх (Vercel дээр Blob сан үүсгэхэд энэ түлхүүр автоматаар нэмэгдэнэ)
export const blobOn = () => !!process.env.BLOB_READ_WRITE_TOKEN;

const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

// Зургийг Blob-д хадгалж, хаягийг нь буцаана. fixed=true бол яг тэр нэрээр (дахин бичиж болно)
// Blob 15 секундэд хариулахгүй бол алдаа гэж үзнэ (SDK өөрөө удаан дахин оролддог)
export async function putBlob(name, buf, mime, fixed = false) {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("blob timeout")), 15000); });
  try {
    const b = await Promise.race([
      put(`img/${name}.${EXT[mime] || "bin"}`, buf, {
        access: "public",
        contentType: mime,
        addRandomSuffix: !fixed,
        allowOverwrite: fixed,
        cacheControlMaxAge: 31536000,
      }),
      timeout,
    ]);
    return b.url;
  } finally {
    clearTimeout(timer);
  }
}

// Өгөгдлийн санд байгаа хуучин зургийг Blob руу зөөж, санд эзлэх зайг чөлөөлнө
export async function moveToBlob(id, buf, mime) {
  const url = await putBlob(String(id), buf, mime, true);
  await sql`UPDATE images SET url = ${url}, data = NULL WHERE id = ${id} AND url IS NULL`;
}
