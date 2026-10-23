import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser, isPremium } from "@/lib/auth";
import { sql, ensureSchema } from "@/lib/db";
import { canSeeVideos, hasAccess, thumbsFor, sparkBalance } from "@/lib/video";
import { VIDEO_PUBLIC } from "@/lib/video-shared";
import Shell from "../components/Shell";
import PageHero from "../components/PageHero";
import VideoCard, { Thumb } from "./VideoCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Видео · Science Spark" };

const PAGE = 20;

// Хэрэглэгч бүрийн нээсэн, үзсэн байдлыг нэг асуулгаар нэмнэ
const withViewer = (uid) => sql`
  SELECT v.id, v.title, v.body, v.uid, v.status, v.duration, v.price, v.views, v.featured, v.created_at, v.playlist_id,
         p.title AS playlist, pr.seconds, (u.user_id IS NOT NULL) AS unlocked
  FROM videos v
  LEFT JOIN video_playlists p ON p.id = v.playlist_id
  LEFT JOIN video_progress pr ON pr.video_id = v.id AND pr.user_id = ${uid} AND NOT pr.done
  LEFT JOIN video_unlocks u ON u.video_id = v.id AND u.user_id = ${uid}
  WHERE v.status = 'ready'`;

// Видео: онцлох, playlist хоёр л тусдаа хэсэгтэй, бусад нь доош гүйлгэх урсгал (YouTube-тэй төстэй)
export default async function VideoPage({ searchParams }) {
  const sp = await searchParams;
  const user = await getUser();
  if (!canSeeVideos(user)) notFound();
  await ensureSchema();
  const uid = user?.id || 0;
  const plId = Number(sp.pl) || 0;
  const page = Math.max(1, Number(sp.page) || 1);
  const base = await withViewer(uid);
  const playlists = await sql`
    SELECT p.id, p.title, p.body, COUNT(v.id)::int AS n,
           (SELECT v2.id FROM videos v2 WHERE v2.playlist_id = p.id AND v2.status = 'ready' ORDER BY v2.created_at LIMIT 1) AS first_id
    FROM video_playlists p JOIN videos v ON v.playlist_id = p.id AND v.status = 'ready'
    GROUP BY p.id ORDER BY p.position, p.id`;
  const pl = plId ? playlists.find((p) => p.id === plId) : null;
  if (plId && !pl) notFound();

  const featured = pl ? [] : base.filter((v) => v.featured).sort((a, b) => b.created_at - a.created_at).slice(0, 5);
  const all = pl
    ? base.filter((v) => v.playlist_id === pl.id).sort((a, b) => a.created_at - b.created_at)
    : base.sort((a, b) => b.created_at - a.created_at);
  const feed = all.slice(0, page * PAGE);
  const covers = playlists.map((p) => base.find((v) => v.id === p.first_id)).filter(Boolean);
  const shown = [...new Map([...featured, ...feed, ...covers].map((v) => [v.id, v])).values()];
  const thumbs = Object.fromEntries((await thumbsFor(shown)).map((t, i) => [shown[i].id, t]));
  const access = (v) => hasAccess(user, v, v.unlocked);
  const balance = user ? await sparkBalance(user) : 0;
  const [top, ...rest] = featured;

  return (
    <Shell user={user} active="/video" header={false}>
      <div className="vd-page">
        <PageHero tone="video" title={pl ? pl.title : "Видео"} text={pl ? pl.body || `${pl.n} видео, эхнээс нь дарааллаар нь үзээрэй.` : "Шинжлэх ухааны лекц, туршилт, ярилцлага. Дэмжигчид бүх видеог үзнэ, бусад нь цуглуулсан очоороо нээнэ."}>
          {user && !isPremium(user) && <Link href="/san" className="ph-btn solid">Дэмжигч болох</Link>}
          {user && <span className="ph-btn"><span className="e">✦</span><b>Зарцуулах оч</b><small>{balance.toLocaleString("en-US")}</small></span>}
        </PageHero>
        {!VIDEO_PUBLIC && <p className="vd-note">Видео хэсэг одоогоор зөвхөн супер админд харагдаж байна. <Link href="/admin/videos">Админ &gt; Видео</Link>-оос нийтэд нээнэ.</p>}

        {top && (
          <section className="vd-sec">
            <h2 className="vd-h">⭐ Онцлох</h2>
            <Link href={`/video/${top.id}`} className="ss-card vc-feature">
              <Thumb v={top} thumb={thumbs[top.id]} access={access(top)} big />
              <span className="vc-feature-text">
                {top.playlist && <small className="vc-pl">{top.playlist}</small>}
                <b>{top.title}</b>
                {top.body && <span className="vc-desc">{top.body.length > 260 ? top.body.slice(0, 260) + "…" : top.body}</span>}
                <span className="vc-meta">{top.views} үзэлт</span>
                <span className="ss-pill">{top.seconds > 0 ? "Үргэлжлүүлэх" : access(top) ? "▶ Үзэх" : `🔒 ${top.price} очоор нээх`}</span>
              </span>
            </Link>
            {rest.length > 0 && (
              <div className="vd-row">
                {rest.map((v) => (
                  <Link key={v.id} href={`/video/${v.id}`} className="vd-tile">
                    <Thumb v={v} thumb={thumbs[v.id]} access={access(v)} />
                    <b>{v.title}</b>
                    <small>{v.views} үзэлт</small>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        {!pl && playlists.length > 0 && (
          <section className="vd-sec">
            <h2 className="vd-h">📚 Playlist</h2>
            <div className="vd-row">
              {playlists.map((p) => {
                const c = covers.find((v) => v.id === p.first_id);
                return (
                  <Link key={p.id} href={`/video?pl=${p.id}`} className="vd-tile vd-pl">
                    <span className="vc-thumb">
                      {c && thumbs[c.id] ? <img src={thumbs[c.id]} alt="" loading="lazy" /> : <i aria-hidden="true">📚</i>}
                      <span className="vd-pl-count"><b>{p.n}</b>видео</span>
                    </span>
                    <b>{p.title}</b>
                    {p.body && <small>{p.body}</small>}
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <section className="vd-sec">
          {!pl && (top || playlists.length > 0) && <h2 className="vd-h">🎬 Бүх видео</h2>}
          {feed.length === 0 ? (
            <p className="ss-card vd-empty">Одоогоор видео алга. Удахгүй нэмэгдэнэ.</p>
          ) : (
            <div className="vd-feed">
              {feed.map((v) => <VideoCard key={v.id} v={v} thumb={thumbs[v.id]} access={access(v)} />)}
            </div>
          )}
          {all.length > feed.length && (
            <Link href={`/video?${pl ? `pl=${pl.id}&` : ""}page=${page + 1}`} scroll={false} className="vd-more">Цааш үзэх</Link>
          )}
        </section>
      </div>
    </Shell>
  );
}
