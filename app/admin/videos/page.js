import Link from "next/link";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { requireSection } from "@/lib/admin";
import { loadSettings } from "@/lib/settings";
import { streamOn, thumbsFor, refreshPending, fmtDuration, MAX_VIDEO_BYTES } from "@/lib/video";
import { SUPPORT_VIDEOS } from "@/lib/video-shared";
import { plainTree } from "@/lib/tree";
import { videoAuthors } from "./authors";
import { fmtDate } from "@/lib/format";
import Head, { Chip, Flash, Stat } from "../_c/Head";
import Uploader from "./Uploader";
import Refresh from "./Refresh";
import { toggleFeatured, savePlaylist, deletePlaylist, setVideoPublic } from "./actions";

const STATE = { processing: ["Боловсруулж байна", "warn"], ready: ["Нийтлэгдсэн", "ok"], error: ["Алдаа гарсан", "bad"], archived: ["Архивласан", "gray"] };
const TABS = [["", "Видеонууд"], ["archived", "Архив"], ["playlists", "Playlist"]];

// Админ > Видео: оруулах, playlist, онцлох, нээх үнэ, нийтэд нээх. Зөвхөн супер админ.
export default async function AdminVideos({ searchParams }) {
  const user = await requireSection("videos");
  if (user.role !== "superadmin") redirect("/admin");
  const { tab = "", ok, error } = await searchParams;
  const settings = await loadSettings();
  const playlists = await sql`
    SELECT p.*, (SELECT COUNT(*) FROM videos v WHERE v.playlist_id = p.id AND v.status <> 'archived')::int AS n
    FROM video_playlists p ORDER BY p.position, p.id`;
  const rows = tab === "playlists" ? [] : await refreshPending(
    tab === "archived"
      ? await sql`SELECT v.*, p.title AS playlist, c.image_id, c.views AS page_views FROM videos v LEFT JOIN video_playlists p ON p.id = v.playlist_id LEFT JOIN posts c ON c.id = v.post_id WHERE v.status = 'archived' ORDER BY v.updated_at DESC LIMIT 200`
      : await sql`SELECT v.*, p.title AS playlist, c.image_id, c.views AS page_views FROM videos v LEFT JOIN video_playlists p ON p.id = v.playlist_id LEFT JOIN posts c ON c.id = v.post_id WHERE v.status <> 'archived' ORDER BY v.created_at DESC LIMIT 200`
  );
  const ov = tab ? null : await overview();
  const thumbs = await thumbsFor(rows);
  const on = streamOn();

  return (
    <>
      <Head user={user} title="Видео" sub={`Видео оруулах, playlist, онцлох видео, нээх үнэ. Дэмжигч сард ${SUPPORT_VIDEOS} видеог эрхээрээ нээнэ, бусад нь очоор эсвэл төгрөгөөр нээнэ.`} />
      <Flash ok={ok} error={error} />
      <Refresh on={rows.some((v) => v.status === "processing")} />
      {ov && <Overview s={ov.s} top={ov.top} />}

      <section className={"adm-card vd-pub" + (settings.videoPublic ? " on" : "")}>
        <span className="vd-pub-dot" aria-hidden="true" />
        <div>
          <b>{settings.videoPublic ? "Видео хэсэг бүх хэрэглэгчид нээлттэй" : "Видео хэсэг одоогоор зөвхөн танд харагдаж байна"}</b>
          <p className="adm-muted">{settings.videoPublic ? "Зүүн цэсэнд «Видео» харагдана. Шинэ видео бэлэн болоход Дэмжигчдэд мэдэгдэл очно." : "Бэлэн болмогц нээгээрэй. Нээхэд зүүн цэсэнд «Видео» гарч, хэрэглэгчид үзэж эхэлнэ."}</p>
        </div>
        <span className="ss-grow" />
        <Link href="/video" className="adm-btn">Сайт дээр харах</Link>
        <form action={setVideoPublic}>
          <input type="hidden" name="on" value={settings.videoPublic ? "0" : "1"} />
          <button className={"adm-btn " + (settings.videoPublic ? "danger" : "teal")}>{settings.videoPublic ? "Нийтээс хаах" : "Нийтэд нээх"}</button>
        </form>
      </section>

      {!on && <p className="adm-flash bad">Cloudflare Stream холбогдоогүй байна. Vercel-ийн Environment Variables хэсэгт <code>CLOUDFLARE_ACCOUNT_ID</code>, <code>CLOUDFLARE_STREAM_TOKEN</code> хоёрыг нэмээд дахин deploy хийнэ үү.</p>}
      {on && !tab && <Uploader maxBytes={MAX_VIDEO_BYTES} playlists={playlists} tree={plainTree()} authors={await videoAuthors(user)} />}

      <nav className="vd-tabs" aria-label="Видео">
        {TABS.map(([k, label]) => <Link key={k} href={k ? `/admin/videos?tab=${k}` : "/admin/videos"} className={tab === k ? "on" : ""}>{label}</Link>)}
      </nav>

      {tab === "playlists" ? (
        <section className="adm-card vd-pls">
          <p className="adm-muted">Playlist нь хэрэглэгчийн «Видео» хуудсанд дарааллаараа (бага тоо эхэнд) гарна. Видеог playlist-д оруулах, гаргахыг видео бүрийн «Засах» хэсгээс хийнэ.</p>
          {playlists.map((p) => (
            <form key={p.id} action={savePlaylist} className="vd-pl-row">
              <input type="hidden" name="pid" value={p.id} />
              <input name="position" type="number" defaultValue={p.position} aria-label="Дараалал" className="vd-pos" />
              <input name="title" defaultValue={p.title} maxLength={80} aria-label="Нэр" required />
              <input name="body" defaultValue={p.body || ""} maxLength={300} placeholder="Тайлбар" aria-label="Тайлбар" />
              <small>{p.n} видео</small>
              <button className="adm-btn">Хадгалах</button>
              <button className="adm-btn danger" formAction={deletePlaylist}>Устгах</button>
            </form>
          ))}
          <form action={savePlaylist} className="vd-pl-row new">
            <input name="position" type="number" defaultValue={playlists.length + 1} aria-label="Дараалал" className="vd-pos" />
            <input name="title" maxLength={80} placeholder="Шинэ playlist-ийн нэр" aria-label="Нэр" required />
            <input name="body" maxLength={300} placeholder="Тайлбар (заавал биш)" aria-label="Тайлбар" />
            <button className="adm-btn teal">+ Нэмэх</button>
          </form>
        </section>
      ) : (
        <section className="adm-card flush">
          {rows.length === 0 ? (
            <p className="adm-empty">{tab ? "Архивласан видео алга." : "Одоогоор видео алга. Дээрээс анхны видеогоо оруулаарай."}</p>
          ) : (
            <table className="adm-table vd-table">
              <thead><tr><th>Видео</th><th>Playlist</th><th>Нээх үнэ</th><th>Нээсэн / тоглуулсан</th><th>Төлөв</th><th></th></tr></thead>
              <tbody>
                {rows.map((v, i) => (
                  <tr key={v.id}>
                    <td>
                      <span className="vd-cell">
                        <span className="vd-mini">{thumbs[i] ? <img src={thumbs[i]} alt="" loading="lazy" /> : <i>🎬</i>}{v.duration > 0 && <small>{fmtDuration(v.duration)}</small>}</span>
                        <span><b>{v.title}</b><small>{fmtDate(v.created_at)}</small></span>
                      </span>
                    </td>
                    <td>{v.playlist || "—"}</td>
                    <td>{!v.price && !v.price_mnt ? "Үнэгүй" : [v.price && `${v.price} оч`, v.price_mnt && `${v.price_mnt.toLocaleString("en-US")}₮`].filter(Boolean).join(" · ")}</td>
                    <td>{v.page_views || 0} / {v.views}</td>
                    <td><Chip tone={STATE[v.status]?.[1]}>{STATE[v.status]?.[0] || v.status}</Chip>{v.featured && <Chip tone="warn">Онцлох</Chip>}</td>
                    <td className="adm-right">
                      <span className="adm-acts">
                        {v.status === "ready" && (
                          <form action={toggleFeatured}>
                            <input type="hidden" name="vid" value={v.id} />
                            <button className="adm-btn" title={v.featured ? "Онцлохоос хасах" : "Онцлох болгох"}>{v.featured ? "★" : "☆"}</button>
                          </form>
                        )}
                        <Link href={`/admin/videos/${v.id}`} className="adm-btn teal">Засах</Link>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </>
  );
}

const n = (x) => Number(x || 0).toLocaleString("en-US");
const hours = (sec) => (sec >= 3600 ? `${(sec / 3600).toFixed(1)} цаг` : `${Math.round(sec / 60)} мин`);

// Видео хэсгийн тойм: тоо, үзэлт, нээлт, орлого, Cloudflare-ийн хадгалалт, шилдэг видеонууд
async function overview() {
  const [[s], top] = await Promise.all([
    sql`
      WITH m AS (SELECT date_trunc('month', now() AT TIME ZONE 'Asia/Ulaanbaatar') AT TIME ZONE 'Asia/Ulaanbaatar' AS since)
      SELECT
        (SELECT COUNT(*) FROM videos WHERE status = 'ready')::int AS ready,
        (SELECT COUNT(*) FROM videos WHERE status = 'processing')::int AS processing,
        (SELECT COUNT(*) FROM videos WHERE status = 'archived')::int AS archived,
        (SELECT COUNT(*) FROM videos WHERE featured AND status = 'ready')::int AS featured,
        (SELECT COALESCE(SUM(duration), 0) FROM videos WHERE status IN ('ready', 'archived'))::int AS stored_sec,
        (SELECT COALESCE(SUM(p.views), 0) FROM posts p JOIN videos v ON v.post_id = p.id)::int AS page_views,
        (SELECT COALESCE(SUM(views), 0) FROM videos)::int AS players,
        (SELECT COUNT(*) FROM video_progress WHERE done)::int AS finished,
        (SELECT COUNT(DISTINCT user_id) FROM video_progress WHERE updated_at >= now() - interval '30 days')::int AS watchers30,
        (SELECT COUNT(*) FROM video_unlocks)::int AS unlocks,
        (SELECT COUNT(*) FROM video_unlocks, m WHERE created_at >= m.since)::int AS unlocks_m,
        (SELECT COUNT(*) FROM video_unlocks WHERE via = 'spark')::int AS by_spark,
        (SELECT COUNT(*) FROM video_unlocks WHERE via = 'mnt')::int AS by_mnt,
        (SELECT COUNT(*) FROM video_unlocks WHERE via = 'support')::int AS by_support,
        (SELECT COALESCE(SUM(cost), 0) FROM video_unlocks)::int AS sparks,
        (SELECT COALESCE(SUM(paid_mnt), 0) FROM video_unlocks)::int AS mnt,
        (SELECT COALESCE(SUM(paid_mnt), 0) FROM video_unlocks, m WHERE created_at >= m.since)::int AS mnt_m,
        (SELECT COUNT(*) FROM sparks s JOIN videos v ON v.post_id = s.post_id)::int AS likes,
        (SELECT COUNT(*) FROM comments c JOIN videos v ON v.post_id = c.post_id)::int AS comments`,
    sql`
      SELECT v.id, v.title, v.views AS players, p.views AS page_views,
        (SELECT COUNT(*) FROM video_unlocks u WHERE u.video_id = v.id)::int AS unlocks,
        (SELECT COALESCE(SUM(paid_mnt), 0) FROM video_unlocks u WHERE u.video_id = v.id)::int AS mnt,
        (SELECT COUNT(*) FROM video_progress pr WHERE pr.video_id = v.id AND pr.done)::int AS finished
      FROM videos v JOIN posts p ON p.id = v.post_id
      WHERE v.status = 'ready'
      ORDER BY p.views DESC, v.views DESC, v.created_at DESC LIMIT 5`,
  ]);
  return { s, top };
}

function Overview({ s, top }) {
  const storedMin = Math.ceil(s.stored_sec / 60);
  return (
    <>
      <div className="adm-stats">
        <Stat label="Нийтлэгдсэн видео" value={n(s.ready)} note={`${n(s.featured)} онцлох · ${n(s.archived)} архивт${s.processing ? ` · ${n(s.processing)} боловсруулж байна` : ""}`} />
        <Stat label="Нээж орсон" value={n(s.page_views)} note={`${n(s.players)} хүн тоглуулсан · ${n(s.finished)} удаа дуустал үзсэн`} />
        <Stat label="Сүүлийн 30 хоногт үзсэн" value={`${n(s.watchers30)} хүн`} note={`${n(s.likes)} оч · ${n(s.comments)} сэтгэгдэл`} />
        <Stat label="Нээлт" value={n(s.unlocks)} note={`энэ сард ${n(s.unlocks_m)} · оч ${n(s.by_spark)} · төгрөг ${n(s.by_mnt)} · Дэмжигч ${n(s.by_support)}`} />
        <Stat label="Төгрөгийн орлого" value={`${n(s.mnt)}₮`} note={`энэ сард ${n(s.mnt_m)}₮ · ${n(s.sparks)} оч зарцуулсан`} />
        <Stat label="Cloudflare-д хадгалсан" value={hours(s.stored_sec)} note={`${n(storedMin)} мин · хадгалалт ≈ $${((Math.max(1, Math.ceil(storedMin / 1000)) * 5)).toFixed(0)}/сар`} />
      </div>
      {top.length > 0 && (
        <section className="adm-card flush">
          <div className="adm-card-head"><b>Хамгийн их үзэлттэй видео</b></div>
          <table className="adm-table vd-top">
            <thead><tr><th>Видео</th><th>Нээсэн</th><th>Тоглуулсан</th><th>Дуустал үзсэн</th><th>Нээлт</th><th>Орлого</th></tr></thead>
            <tbody>
              {top.map((v) => (
                <tr key={v.id}>
                  <td><Link href={`/admin/videos/${v.id}`}><b>{v.title}</b></Link></td>
                  <td>{n(v.page_views)}</td><td>{n(v.players)}</td><td>{n(v.finished)}</td><td>{n(v.unlocks)}</td><td>{n(v.mnt)}₮</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
