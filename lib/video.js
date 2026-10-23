import { sql } from "./db";
import { notify } from "./notify";

// Видеог Cloudflare Stream дээр хадгалж, тоглуулна. Үнэ нь хадгалсан болон үзсэн минутаар бодогдоно.
// Vercel дээр CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_STREAM_TOKEN (Stream: Edit эрхтэй API token) хоёрыг тохируулна.
const ACCOUNT = () => process.env.CLOUDFLARE_ACCOUNT_ID;
const TOKEN = () => process.env.CLOUDFLARE_STREAM_TOKEN;
export const streamOn = () => !!(ACCOUNT() && TOKEN());

// Нэг удаад оруулах дээд хэмжээ: Cloudflare-ийн энгийн (POST) оруулалт 200MB хүртэл
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 3 * 3600;
// Тоглуулах холбоос энэ хугацааны дараа хүчингүй болно (хуулж аваад өөр газар тоглуулж чадахгүй)
const TOKEN_TTL = 4 * 3600;

async function cf(path, { method = "GET", body } = {}) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT()}/stream${path}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN()}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (method === "DELETE" && (r.ok || r.status === 404)) return null;
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.success === false) throw new Error(j.errors?.[0]?.message || `Cloudflare ${r.status}`);
  return j.result;
}

// Зөвхөн манай сайтаас тоглуулна (SITE_URL-ийн домэйн + www)
function origins() {
  try {
    const host = new URL(process.env.SITE_URL || "").hostname;
    return host ? [host, host.startsWith("www.") ? host.slice(4) : `www.${host}`] : [];
  } catch (e) {
    return [];
  }
}

// Хөтөч файлаа шууд Cloudflare руу илгээх нэг удаагийн холбоос (Vercel-ээр дамжихгүй)
export async function createUpload(title) {
  const r = await cf("/direct_upload", {
    method: "POST",
    body: { maxDurationSeconds: MAX_VIDEO_SECONDS, requireSignedURLs: true, allowedOrigins: origins(), meta: { name: title } },
  });
  return { uid: r.uid, uploadURL: r.uploadURL };
}

export const deleteStream = (uid) => cf(`/${uid}`, { method: "DELETE" });

// Гарын үсэгтэй, хугацаатай тоглуулах түлхүүр. MP4 татах боломжийг хаана.
// Нэг түлхүүрийг 1 цаг дахин ашиглана (жагсаалт ачаалах бүрт Cloudflare руу олон хүсэлт явуулахгүй)
const tokens = new Map();
export async function playToken(uid) {
  const hit = tokens.get(uid);
  if (hit && Date.now() - hit.at < 3600000) return hit.token;
  const r = await cf(`/${uid}/token`, { method: "POST", body: { exp: Math.floor(Date.now() / 1000) + TOKEN_TTL, downloadable: false } });
  tokens.set(uid, { token: r.token, at: Date.now() });
  return r.token;
}

export const iframeSrc = (token) => `https://iframe.videodelivery.net/${token}?letterboxColor=transparent`;
export const thumbSrc = (token) => `https://videodelivery.net/${token}/thumbnails/thumbnail.jpg?time=2s&height=360`;

// Боловсруулж буй видеоны төлвийг Cloudflare-аас шалгаад, бэлэн болмогц оруулсан хүнд мэдэгдэнэ
export async function refreshPending(rows) {
  const pending = rows.filter((v) => v.status === "processing" && v.uid);
  if (!pending.length || !streamOn()) return rows;
  await Promise.all(
    pending.map(async (v) => {
      try {
        const s = await cf(`/${v.uid}`);
        const state = s.status?.state;
        let next = null;
        if (s.readyToStream) next = "ready";
        else if (state === "error") next = "error";
        // Хөтөч хаагдаж оруулалт дуусаагүй бол 1 өдрийн дараа алдаа гэж тэмдэглэнэ
        else if (state === "pendingupload" && Date.now() - new Date(v.created_at).getTime() > 86400000) next = "error";
        if (!next) return;
        const duration = s.duration > 0 ? Math.round(s.duration) : null;
        const [u] = await sql`UPDATE videos SET status = ${next}, duration = ${duration}, updated_at = now()
                              WHERE id = ${v.id} AND status = 'processing' RETURNING id`;
        if (!u) return;
        Object.assign(v, { status: next, duration });
        await notify({ userId: v.created_by, kind: next === "ready" ? "video_ready" : "video_error", note: v.title });
      } catch (e) {}
    })
  );
  return rows;
}

export const fmtDuration = (s) => {
  if (!s) return "";
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
};
