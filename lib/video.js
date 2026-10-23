import { sql } from "./db";
import { notify } from "./notify";
import { isStaff, isSuperAdmin, isPremium } from "./auth";
import { VIDEO_PUBLIC, VIDEO_KIND } from "./video-shared";

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

export const iframeSrc = (token, start = 0) => `https://iframe.videodelivery.net/${token}?letterboxColor=transparent${start > 5 ? `&startTime=${Math.floor(start)}s` : ""}`;
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
        await syncVideoPosts(v.id);
        await notify({ userId: v.created_by, kind: next === "ready" ? "video_ready" : "video_error", note: v.title, videoId: v.id });
        // Хэсэг нийтэд нээлттэй бол бүх видеог үзэх эрхтэй Дэмжигчдэд шинэ видеог мэдэгдэнэ
        if (next === "ready" && VIDEO_PUBLIC) await notifySupporters(v);
      } catch (e) {}
    })
  );
  return rows;
}

export { fmtDuration } from "./video-format";

// Видео хэсэг: нийтэд нээгдтэл зөвхөн супер админд (ботоор ажиллаж байхад ч)
export const canSeeVideos = (user) => VIDEO_PUBLIC || isSuperAdmin(user?.operator || user);

export const isFree = (v) => !v.price && !v.price_mnt;

// Үзэх эрх: үнэгүй видео, редакц, Дэмжигч, эсвэл очоор / төгрөгөөр нээсэн
export function hasAccess(user, v, unlocked) {
  if (isFree(v)) return true;
  if (!user) return false;
  return isStaff(user.operator || user) || isPremium(user) || !!unlocked;
}

// Зарцуулах боломжтой оч = нийт оч − видеонд зарцуулсан. Түвшин нийт очоор тогтоно (буурахгүй).
export async function sparkBalance(user) {
  if (!user) return 0;
  const [r] = await sql`SELECT COALESCE(SUM(cost), 0)::int AS spent FROM video_unlocks WHERE user_id = ${user.id}`;
  return Math.max(0, (user.points || 0) - r.spent);
}

async function notifySupporters(v) {
  try {
    await sql`INSERT INTO notifications (user_id, kind, note, video_id)
              SELECT u.id, 'video_new', ${v.title}, ${v.id} FROM users u
              WHERE u.premium_until > now() AND NOT u.is_bot AND u.id IS DISTINCT FROM ${v.created_by}::int`;
  } catch (e) {}
}

// Сонгосон видеонуудын зураг (гарын үсэгтэй түлхүүрээр)
export const thumbsFor = (rows) =>
  Promise.all(rows.map((v) => (v.uid && (v.status === "ready" || v.status === "archived") ? playToken(v.uid).then(thumbSrc).catch(() => null) : null)));

export const fmtViews = (n) => `${Number(n || 0).toLocaleString("en-US")} үзэлт`;

// Видеоны контент (posts) нийтэд харагдах эсэх: бэлэн + хэсэг нээлттэй бол published,
// архивласан бол archived, бусад үед unlisted (зөвхөн редакц харна). Бусад бүх жагсаалт published-ийг л харуулна.
export async function syncVideoPosts(videoId = null) {
  await sql`UPDATE posts p SET status = CASE
              WHEN v.status = 'archived' THEN 'archived'
              WHEN v.status = 'ready' AND ${VIDEO_PUBLIC}::boolean THEN 'published'
              ELSE 'unlisted' END
            FROM videos v
            WHERE v.post_id = p.id AND (${videoId}::int IS NULL OR v.id = ${videoId}::int)`;
}

// Видео контентын урсгал. playlist: тухайн playlist дарааллаараа; exclude: харуулахгүй контент;
// fresh: хэрэглэгчийн үзээгүйг эхэнд, санамсаргүй дарааллаар (нүүрний санал болголт, «Цааш үзэх»)
export async function videoFeed(user, { playlist = null, exclude = [], limit = 20, offset = 0, fresh = false, featured = false } = {}) {
  const uid = user?.id || 0;
  const preview = isSuperAdmin(user?.operator || user) && !VIDEO_PUBLIC;
  const rows = await sql`
    -- Картад хэрэгтэй талбарууд нүүрний урсгалтай ижил
    SELECT p.id, p.author_id, p.kind, p.title, p.subtitle, p.body, p.meta, p.image_id, p.views, p.created_at, p.category, p.status,
      u.initial, u.first_name, u.avatar_id AS avatar,
      (SELECT COUNT(*) FROM sparks WHERE post_id = p.id)::int AS sparks,
      (SELECT COUNT(*) FROM comments WHERE post_id = p.id)::int AS comments,
      COALESCE((SELECT SUM(delta) FROM points_ledger WHERE user_id = u.id), 0)::int AS author_points,
      (SELECT COUNT(*) FROM follows WHERE followee_id = u.id)::int AS author_followers,
      EXISTS (SELECT 1 FROM saves WHERE post_id = p.id AND user_id = ${uid}) AS saved,
      EXISTS (SELECT 1 FROM sparks WHERE post_id = p.id AND user_id = ${uid}) AS sparked
    FROM posts p JOIN users u ON u.id = p.author_id JOIN videos v ON v.post_id = p.id
    WHERE p.kind = ${VIDEO_KIND} AND v.status = 'ready'
      AND (p.status = 'published' OR (${preview}::boolean AND p.status = 'unlisted'))
      AND (${playlist}::int IS NULL OR v.playlist_id = ${playlist}::int)
      AND (NOT ${featured}::boolean OR v.featured)
      AND NOT (p.id = ANY(${exclude.map(Number)}::int[]))
    ORDER BY
      CASE WHEN ${fresh}::boolean THEN EXISTS (SELECT 1 FROM video_progress pr WHERE pr.video_id = v.id AND pr.user_id = ${uid}) END ASC NULLS LAST,
      CASE WHEN ${fresh}::boolean THEN EXISTS (SELECT 1 FROM post_views pv WHERE pv.post_id = p.id AND pv.viewer = ${"u:" + uid}) END ASC NULLS LAST,
      CASE WHEN ${fresh}::boolean THEN random() END,
      CASE WHEN ${playlist}::int IS NOT NULL THEN v.created_at END ASC,
      p.created_at DESC
    LIMIT ${limit} OFFSET ${offset}`;
  return withVideos(rows, user);
}

// Контентын жагсаалтад видеоны мэдээлэл (зураг, хугацаа, үзсэн хэсэг, эрх) нэмнэ. Видео биш мөрөнд хүрэхгүй.
export async function withVideos(posts, user) {
  const ids = posts.filter((p) => p.kind === VIDEO_KIND).map((p) => p.id);
  if (!ids.length) return posts;
  const uid = user?.id || 0;
  const vids = await sql`
    SELECT v.id, v.post_id, v.uid, v.status, v.duration, v.price, v.price_mnt, v.playlist_id, pl.title AS playlist,
           pr.seconds, (un.user_id IS NOT NULL) AS unlocked
    FROM videos v
    LEFT JOIN video_playlists pl ON pl.id = v.playlist_id
    LEFT JOIN video_progress pr ON pr.video_id = v.id AND pr.user_id = ${uid} AND NOT pr.done
    LEFT JOIN video_unlocks un ON un.video_id = v.id AND un.user_id = ${uid}
    WHERE v.post_id = ANY(${ids}::int[])`;
  const thumbs = await thumbsFor(vids);
  const by = new Map(vids.map((v, i) => [v.post_id, { ...v, thumb: thumbs[i], access: hasAccess(user, v, v.unlocked) }]));
  for (const p of posts) if (by.has(p.id)) p.video = by.get(p.id);
  return posts;
}

// Нүүрний урсгалд хэрэглэгчийн үзээгүй видеонуудыг тогтмол давтамжтай (every-р) шигтгэнэ
export async function mixVideos(posts, user, { every = 5, max = 4 } = {}) {
  if (!VIDEO_PUBLIC) return posts;
  const have = posts.filter((p) => p.kind === VIDEO_KIND).map((p) => p.id);
  const recs = await videoFeed(user, { exclude: have, limit: max, fresh: true }).catch(() => []);
  if (!recs.length) return posts;
  const out = [];
  posts.forEach((p, i) => {
    out.push(p);
    if ((i + 1) % every === 0 && recs.length) out.push({ ...recs.shift(), suggested: true });
  });
  // Урсгал богино бол нэгийг нь төгсгөлд нь санал болгоно
  if (posts.length < every && recs.length) out.push({ ...recs.shift(), suggested: true });
  return out;
}

// Видеог очоор эсвэл хэтэвчнээс төгрөгөөр нээнэ. Нэг хүний төлбөр ээлжилнэ (давхар хасахгүй).
export async function payVideo(userId, video, method, period) {
  if (method === "mnt") {
    const [, rows] = await sql.transaction([
      sql`SELECT pg_advisory_xact_lock(8102, ${userId})`,
      sql`
        WITH bal AS (SELECT COALESCE(SUM(delta), 0) AS b FROM money_ledger WHERE account = 'wallet' AND user_id = ${userId}),
        u AS (
          INSERT INTO video_unlocks (user_id, video_id, cost, paid_mnt)
          SELECT ${userId}, ${video.id}, 0, ${video.price_mnt} FROM bal WHERE bal.b >= ${video.price_mnt}
          ON CONFLICT DO NOTHING RETURNING video_id
        ),
        w AS (INSERT INTO money_ledger (account, user_id, kind, delta, period, ref_id, note)
              SELECT 'wallet', ${userId}, 'video', ${-video.price_mnt}, ${period}, video_id, ${video.title} FROM u RETURNING 1),
        pl AS (INSERT INTO money_ledger (account, user_id, kind, delta, period, ref_id, note)
               SELECT 'platform', NULL, 'video', ${video.price_mnt}, ${period}, video_id, ${video.title} FROM u RETURNING 1)
        SELECT video_id FROM u`,
    ]);
    return rows.length > 0;
  }
  const [, rows] = await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(8103, ${userId})`,
    sql`
      WITH spent AS (SELECT COALESCE(SUM(cost), 0) AS s FROM video_unlocks WHERE user_id = ${userId}),
      pts AS (SELECT COALESCE(SUM(delta), 0) AS n FROM points_ledger WHERE user_id = ${userId})
      INSERT INTO video_unlocks (user_id, video_id, cost)
      SELECT ${userId}, ${video.id}, ${video.price} FROM spent, pts WHERE pts.n - spent.s >= ${video.price}
      ON CONFLICT DO NOTHING RETURNING video_id`,
  ]);
  return rows.length > 0;
}
