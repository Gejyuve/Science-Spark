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

export const imgUrl = (id) => (id ? `/img/${id}` : null);
