import Link from "next/link";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { requireSection } from "@/lib/admin";
import { loadSettings } from "@/lib/settings";
import { streamOn, thumbsFor, refreshPending, fmtDuration, MAX_VIDEO_BYTES } from "@/lib/video";
import { DEFAULT_PRICE, DEFAULT_PRICE_MNT } from "@/lib/video-shared";
import { plainTree } from "@/lib/tree";
import { videoAuthors } from "./authors";
import { fmtDate } from "@/lib/format";
import Head, { Chip, Flash } from "../_c/Head";
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
      ? await sql`SELECT v.*, p.title AS playlist FROM videos v LEFT JOIN video_playlists p ON p.id = v.playlist_id WHERE v.status = 'archived' ORDER BY v.updated_at DESC LIMIT 200`
      : await sql`SELECT v.*, p.title AS playlist FROM videos v LEFT JOIN video_playlists p ON p.id = v.playlist_id WHERE v.status <> 'archived' ORDER BY v.created_at DESC LIMIT 200`
  );
  const thumbs = await thumbsFor(rows);
  const on = streamOn();

  return (
    <>
      <Head user={user} title="Видео" sub="Видео оруулах, playlist, онцлох видео, нээх үнэ. Дэмжигчид бүх видеог үзнэ, бусад нь очоороо нээнэ." />
      <Flash ok={ok} error={error} />
      <Refresh on={rows.some((v) => v.status === "processing")} />

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
      {on && !tab && <Uploader maxBytes={MAX_VIDEO_BYTES} playlists={playlists} tree={plainTree()} authors={await videoAuthors(user)} defaults={{ price: DEFAULT_PRICE, price_mnt: DEFAULT_PRICE_MNT }} />}

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
              <thead><tr><th>Видео</th><th>Playlist</th><th>Нээх үнэ</th><th>Үзэгч</th><th>Төлөв</th><th></th></tr></thead>
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
                    <td>{v.views}</td>
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
