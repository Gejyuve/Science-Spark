import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser, isPremium } from "@/lib/auth";
import { sql, ensureSchema } from "@/lib/db";
import { canSeeVideos, videoFeed, sparkBalance, supportLeft, fmtDuration, thumbsFor } from "@/lib/video";
import { VIDEO_PUBLIC, SUPPORT_VIDEOS } from "@/lib/video-shared";
import Shell from "../components/Shell";
import PageHero from "../components/PageHero";
import PostCard from "../components/PostCard";
import { followingSet } from "../components/Bits";

export const dynamic = "force-dynamic";
export const metadata = { title: "Видео · Science Spark" };

const PAGE = 15;

// Видео: дээр нь баруун зүүн гүйдэг босоо «Онцлох» картууд, playlist-ууд,
// доор нь нүүрний урсгалтай ижил том видео картууд үргэлжилнэ
export default async function VideoPage({ searchParams }) {
  const sp = await searchParams;
  const user = await getUser();
  if (!canSeeVideos(user)) notFound();
  await ensureSchema();
  const page = Math.max(1, Number(sp.page) || 1);
  const preview = !VIDEO_PUBLIC;
  const [pl] = sp.pl ? await sql`SELECT id, title, body FROM video_playlists WHERE id = ${Number(sp.pl) || 0}` : [null];
  if (sp.pl && !pl) notFound();
  const [featured, feed, playlists, balance, following] = await Promise.all([
    pl ? [] : videoFeed(user, { featured: true, limit: 12 }),
    videoFeed(user, { playlist: pl?.id ?? null, limit: page * PAGE + 1 }),
    pl ? [] : sql`
      SELECT p.id, p.title, p.body, COUNT(v.id)::int AS n,
             (ARRAY_AGG(v.uid ORDER BY v.created_at))[1] AS uid,
             (ARRAY_AGG(c.image_id ORDER BY v.created_at))[1] AS image_id
      FROM video_playlists p
      JOIN videos v ON v.playlist_id = p.id AND v.status = 'ready'
      JOIN posts c ON c.id = v.post_id AND (c.status = 'published' OR (${preview}::boolean AND c.status = 'unlisted'))
      GROUP BY p.id ORDER BY p.position, p.id`,
    user ? sparkBalance(user) : 0,
    followingSet(user),
  ]);
  const [plThumbs, left] = await Promise.all([thumbsFor(playlists.map((p) => ({ uid: p.uid, image_id: p.image_id, status: "ready" }))), supportLeft(user)]);
  const more = feed.length > page * PAGE;
  const shown = feed.slice(0, page * PAGE);

  return (
    <Shell user={user} active="/video" header={false}>
      <div className="vd-page">
        <PageHero tone="video" title={pl ? pl.title : "Видео"} text={pl ? pl.body || "Эхнээс нь дарааллаар нь үзээрэй." : `Шинжлэх ухааны лекц, туршилт, ярилцлага. Дэмжигч сар бүр хүссэн ${SUPPORT_VIDEOS} видеогоо нээнэ, бусад видеог очоор эсвэл төгрөгөөр нээнэ.`}>
          {user && !isPremium(user) && <Link href="/san" className="ph-btn solid">Дэмжигч болох</Link>}
          {left !== null && <span className="ph-btn"><span className="e">⚡</span><b>Энэ сард нээх эрх</b><small>{left}/{SUPPORT_VIDEOS}</small></span>}
          {user && <span className="ph-btn"><span className="e">✦</span><b>Зарцуулах оч</b><small>{balance.toLocaleString("en-US")}</small></span>}
        </PageHero>
        {preview && <p className="vd-note">Видео хэсэг одоогоор зөвхөн супер админд харагдаж байна. <Link href="/admin/videos">Админ &gt; Видео</Link>-оос нийтэд нээнэ.</p>}

        {featured.length > 0 && (
          <section className="vd-sec">
            <h2 className="vd-h">Онцлох</h2>
            <div className="vf-row">
              {featured.map((p) => (
                <Link key={p.id} href={`/post/${p.id}`} className="vf-card">
                  {p.video?.thumb ? <img src={p.video.thumb} alt="" loading="lazy" /> : <i aria-hidden="true">🎬</i>}
                  {p.video?.duration > 0 && <small className="vf-dur">{fmtDuration(p.video.duration)}</small>}
                  <span className="vf-text">
                    <b>{p.title}</b>
                    <small>{p.initial}.{p.first_name} · {(p.views || 0).toLocaleString("en-US")} үзэлт</small>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {playlists.length > 0 && (
          <section className="vd-sec">
            <h2 className="vd-h">Playlist</h2>
            <div className="vd-row">
              {playlists.map((p, i) => (
                <Link key={p.id} href={`/video?pl=${p.id}`} className="vd-tile vd-pl">
                  <span className="vc-thumb">
                    {plThumbs[i] ? <img src={plThumbs[i]} alt="" loading="lazy" /> : <i aria-hidden="true">📚</i>}
                    <span className="vd-pl-count"><b>{p.n}</b>видео</span>
                  </span>
                  <b>{p.title}</b>
                  {p.body && <small>{p.body}</small>}
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="vd-sec">
          {!pl && (featured.length > 0 || playlists.length > 0) && <h2 className="vd-h">Бүх видео</h2>}
          {shown.length === 0 ? (
            <p className="ss-card vd-empty">Одоогоор видео алга. Удахгүй нэмэгдэнэ.</p>
          ) : (
            <div className="vd-feed">
              {shown.map((p) => <PostCard key={p.id} p={p} viewer={user} following={following} />)}
            </div>
          )}
          {more && <Link href={`/video?${pl ? `pl=${pl.id}&` : ""}page=${page + 1}`} scroll={false} className="vd-more">Цааш үзэх</Link>}
        </section>
      </div>
    </Shell>
  );
}
