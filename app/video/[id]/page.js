import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser, isSuperAdmin } from "@/lib/auth";
import { sql, ensureSchema } from "@/lib/db";
import { canSeeVideos, hasAccess, sparkBalance, playToken, iframeSrc, thumbsFor, fmtDuration } from "@/lib/video";
import { relTime } from "@/lib/format";
import Shell from "../../components/Shell";
import Share from "../../components/Share";
import Player from "../Player";
import { Thumb } from "../VideoCard";
import { unlockVideo } from "../actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const [v] = await sql`SELECT title FROM videos WHERE id = ${Number(id) || 0} AND status = 'ready'`.catch(() => []);
  return { title: `${v?.title || "Видео"} · Science Spark` };
}

// Видео үзэх: том тоглуулагч, гарчиг, тайлбар, дараагийн видеонууд (playlist бол дарааллаараа)
export default async function WatchVideo({ params, searchParams }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const user = await getUser();
  if (!canSeeVideos(user)) notFound();
  const vid = Number(id);
  if (!Number.isInteger(vid)) notFound();
  await ensureSchema();
  const uid = user?.id || 0;
  const [v] = await sql`
    SELECT v.*, p.title AS playlist, pr.seconds, pr.done, (u.user_id IS NOT NULL) AS unlocked
    FROM videos v
    LEFT JOIN video_playlists p ON p.id = v.playlist_id
    LEFT JOIN video_progress pr ON pr.video_id = v.id AND pr.user_id = ${uid}
    LEFT JOIN video_unlocks u ON u.video_id = v.id AND u.user_id = ${uid}
    WHERE v.id = ${vid} AND v.status = 'ready'`;
  if (!v) notFound();
  const access = hasAccess(user, v, v.unlocked);
  // Playlist бол түүний бүх видео дарааллаараа, үгүй бол сүүлийн видеонууд
  const others = await sql`
    SELECT v.id, v.title, v.uid, v.status, v.duration, v.price, v.views, v.created_at, pr.seconds, (u.user_id IS NOT NULL) AS unlocked
    FROM videos v
    LEFT JOIN video_progress pr ON pr.video_id = v.id AND pr.user_id = ${uid} AND NOT pr.done
    LEFT JOIN video_unlocks u ON u.video_id = v.id AND u.user_id = ${uid}
    WHERE v.status = 'ready' AND (${v.playlist_id}::int IS NULL AND v.id <> ${vid} OR v.playlist_id = ${v.playlist_id}::int)
    ORDER BY CASE WHEN ${v.playlist_id}::int IS NULL THEN 0 ELSE extract(epoch FROM v.created_at) END, v.created_at DESC
    LIMIT 30`;
  const [token, thumbs, balance] = await Promise.all([
    playToken(v.uid).catch(() => null),
    thumbsFor(others),
    sparkBalance(user),
  ]);
  const thumb = !access && token ? (await thumbsFor([v]))[0] : null;
  const start = v.seconds > 0 && !v.done ? v.seconds : 0;
  const idx = others.findIndex((o) => o.id === vid);

  return (
    <Shell user={user} active="/video" header={false}>
      <div className="vd-page vd-watch">
        <div className="vd-player" id="watch">
          {access && token ? (
            <Player src={iframeSrc(token, start)} title={v.title} videoId={v.id} track={!!user} />
          ) : access ? (
            <div className="vd-wait"><span aria-hidden="true">🎬</span><p>Видеог ачаалж чадсангүй. Хуудсаа дахин ачаална уу.</p></div>
          ) : (
            <div className="vd-lock">
              {thumb && <img src={thumb} alt="" />}
              <div className="vd-lock-box">
                <span className="vd-lock-ico" aria-hidden="true">🔒</span>
                <b>Энэ видеог үзэх 2 арга</b>
                {!user ? (
                  <>
                    <p>Нэвтэрч ороод Дэмжигч болох эсвэл цуглуулсан очоороо нээнэ.</p>
                    <Link href="/login" className="tm-btn">Нэвтрэх</Link>
                  </>
                ) : (
                  <>
                    <div className="vd-lock-acts">
                      <Link href="/san" className="tm-btn ghost">⚡ Дэмжигч болох<small>бүх видео нээгдэнэ</small></Link>
                      <form action={unlockVideo}>
                        <input type="hidden" name="vid" value={v.id} />
                        <button className="tm-btn" disabled={balance < v.price}>🔓 {v.price} очоор нээх<small>танд {balance.toLocaleString("en-US")} оч</small></button>
                      </form>
                    </div>
                    <p>Зарцуулсан оч таны түвшинд нөлөөлөхгүй.</p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
        {sp.ok && <p className="vd-ok">{sp.ok}</p>}
        {sp.error && <p className="vd-err card">{sp.error}</p>}

        <section className="vd-info">
          <h1>{v.title}</h1>
          <div className="vd-meta-row">
            <span className="vd-sub">{v.views} үзэлт · {relTime(v.created_at).text}{v.duration > 0 && <> · {fmtDuration(v.duration)}</>}</span>
            <span className="ss-grow" />
            {isSuperAdmin(user?.operator || user) && <Link href={`/admin/videos/${v.id}`} className="ss-pill ghost">Засах</Link>}
            <Share path={`/video/${v.id}`} title={v.title} icon="ashare" size={22} align="right" />
          </div>
          {(v.body || v.playlist) && (
            <div className="vd-desc">
              {v.playlist && <Link href={`/video?pl=${v.playlist_id}`} className="vc-pl">📚 {v.playlist}</Link>}
              {v.body && <p>{v.body}</p>}
            </div>
          )}
        </section>

        {others.length > (v.playlist_id ? 1 : 0) && (
          <section className="ss-card vd-next">
            <h2>{v.playlist ? <>📚 {v.playlist} <small>{idx + 1} / {others.length}</small></> : "Бусад видео"}</h2>
            {others.map((o, i) => (
              <Link key={o.id} href={`/video/${o.id}`} className={"vd-next-item" + (o.id === vid ? " on" : "")} aria-current={o.id === vid ? "true" : undefined}>
                {v.playlist_id && <span className="vd-next-n">{o.id === vid ? "▶" : i + 1}</span>}
                <Thumb v={o} thumb={thumbs[i]} access={hasAccess(user, o, o.unlocked)} />
                <span><b>{o.title}</b><small>{o.views} үзэлт · {relTime(o.created_at).text}</small></span>
              </Link>
            ))}
          </section>
        )}
      </div>
    </Shell>
  );
}
