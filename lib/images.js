import { put, get } from "@vercel/blob";
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

// Vercel Blob холбогдсон эсэх. Хуучин сан түлхүүрээр (BLOB_READ_WRITE_TOKEN),
// шинэ сан Vercel-ийн OIDC-оор (BLOB_STORE_ID) холбогддог
export const blobOn = () => !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);

const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

// Blob удаан бол хүлээлгэхгүй (SDK өөрөө удаан дахин оролддог)
function withTimeout(p, ms = 15000) {
  let timer;
  const t = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("blob timeout")), ms); });
  return Promise.race([p, t]).finally(() => clearTimeout(timer));
}

// Сан Public эсвэл Private байж болно. Эхлээд public-аар оролдож, болохгүй бол private-аар
let access = null;

// Зургийг Blob-д хадгалж, хаягийг нь буцаана. fixed=true бол яг тэр нэрээр (дахин бичиж болно)
export async function putBlob(name, buf, mime, fixed = false) {
  const opts = (a) => ({ access: a, contentType: mime, addRandomSuffix: !fixed, allowOverwrite: fixed, cacheControlMaxAge: 31536000 });
  const path = `img/${name}.${EXT[mime] || "bin"}`;
  if (access) return (await withTimeout(put(path, buf, opts(access)))).url;
  try {
    const b = await withTimeout(put(path, buf, opts("public")));
    access = "public";
    return b.url;
  } catch (e) {
    if (e.message === "blob timeout") throw e;
    const b = await withTimeout(put(path, buf, opts("private")));
    access = "private";
    return b.url;
  }
}

// Blob-оос зургийг уншина. Private сангийн зургийг түлхүүрээр уншина
export async function readBlob(url) {
  if (!/\.private\.blob\./.test(url)) {
    const res = await fetch(url);
    if (res.ok) return res.body;
  }
  const r = await get(url, { access: "private" });
  return r ? r.stream : null;
}

// Өгөгдлийн санд байгаа хуучин зургийг Blob руу зөөж, санд эзлэх зайг чөлөөлнө
export async function moveToBlob(id, buf, mime) {
  const url = await putBlob(String(id), buf, mime, true);
  await sql`UPDATE images SET url = ${url}, data = NULL WHERE id = ${id} AND url IS NULL`;
}
