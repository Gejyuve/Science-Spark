import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { requireSection } from "@/lib/admin";
import { playToken, iframeSrc, refreshPending, fmtDuration } from "@/lib/video";
import { fmtDate } from "@/lib/format";
import Head, { Chip, Flash } from "../../_c/Head";
import Refresh from "../Refresh";
import { saveVideo, archiveVideo, deleteVideo } from "../actions";

const STATE = { processing: ["Боловсруулж байна", "warn"], ready: ["Нийтлэгдсэн", "ok"], error: ["Алдаа гарсан", "bad"], archived: ["Архивласан", "gray"] };

// Нэг видеог засах: гарчиг, тайлбар, playlist, нээх үнэ, онцлох, архивлах, устгах
export default async function EditVideo({ params, searchParams }) {
  const user = await requireSection("videos");
  if (user.role !== "superadmin") redirect("/admin");
  const [{ id }, { ok, error }] = await Promise.all([params, searchParams]);
  const vid = Number(id);
  if (!Number.isInteger(vid)) notFound();
  const [v] = await refreshPending(await sql`SELECT * FROM videos WHERE id = ${vid}`);
  if (!v) notFound();
  const playlists = await sql`SELECT id, title FROM video_playlists ORDER BY position, id`;
  const [{ unlocks, spent }] = await sql`SELECT COUNT(*)::int AS unlocks, COALESCE(SUM(cost), 0)::int AS spent FROM video_unlocks WHERE video_id = ${vid}`;
  const token = v.status === "ready" || v.status === "archived" ? await playToken(v.uid).catch(() => null) : null;
  const st = STATE[v.status];

  return (
    <>
      <Head user={user} title={v.title} sub={<>Оруулсан {fmtDate(v.created_at)}{v.duration > 0 && <> · {fmtDuration(v.duration)}</>} · {v.views} үзэгч · {unlocks} хүн очоор нээсэн ({spent} оч)</>} />
      <Flash ok={ok} error={error} />
      <Refresh on={v.status === "processing"} />
      <div className="vd-admin-grid">
        <div className="vd-player">
          {token ? (
            <iframe src={iframeSrc(token)} title={v.title} loading="lazy" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture" allowFullScreen />
          ) : (
            <div className="vd-wait"><span aria-hidden="true">🎬</span><p>{v.status === "processing" ? "Боловсруулж байна. Бэлэн болмогц энд гарна." : v.status === "error" ? "Боловсруулахад алдаа гарлаа. Устгаад дахин оруулна уу." : "Видеог ачаалж чадсангүй."}</p></div>
          )}
        </div>
        <section className="adm-card vd-form">
          <div className="adm-card-head"><b>Мэдээлэл</b><Chip tone={st?.[1]}>{st?.[0]}</Chip>{v.status === "ready" && <Link href={`/video/${v.id}`} className="adm-btn">Сайт дээр харах</Link>}</div>
          <form action={saveVideo} className="vd-edit">
            <input type="hidden" name="vid" value={v.id} />
            <label><span>Гарчиг</span><input name="title" defaultValue={v.title} maxLength={140} required /></label>
            <label><span>Тайлбар</span><textarea name="body" defaultValue={v.body || ""} maxLength={2000} rows={5} className="vd-in" /></label>
            <div className="vd-opts">
              <label><span>Playlist</span>
                <select name="playlist" defaultValue={v.playlist_id || ""}>
                  <option value="">Playlist-гүй</option>
                  {playlists.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </label>
              <label><span>Нээх үнэ (оч, 0 = үнэгүй)</span><input name="price" type="number" min={0} max={100000} defaultValue={v.price} /></label>
              <label className="adm-check"><input type="checkbox" name="featured" defaultChecked={v.featured} /> Онцлох видео</label>
            </div>
            <button className="adm-btn teal big">Хадгалах</button>
          </form>
        </section>
      </div>

      <section className="adm-card vd-danger-zone">
        <div className="adm-card-head"><b>Архивлах, устгах</b></div>
        <p className="adm-muted">Архивласан видео сайтад харагдахгүй ч файл нь Cloudflare дээр хадгалагдсаар (хадгалалтын төлбөр гарна). Устгавал файл нэг мөсөн устаж, төлбөр зогсоно. Очоор нээсэн хүмүүсийн оч буцаагдахгүй.</p>
        <div className="adm-bar">
          {(v.status === "ready" || v.status === "archived") && (
            <form action={archiveVideo}>
              <input type="hidden" name="vid" value={v.id} />
              <input type="hidden" name="on" value={v.status === "archived" ? "0" : "1"} />
              <button className="adm-btn">{v.status === "archived" ? "Архиваас гаргах" : "Архивлах"}</button>
            </form>
          )}
          <details className="vd-del">
            <summary className="adm-btn danger">Устгах</summary>
            <form action={deleteVideo}>
              <input type="hidden" name="vid" value={v.id} />
              <p>Видео Cloudflare-аас нэг мөсөн устгагдана, буцааж сэргээх боломжгүй.</p>
              <button className="adm-btn danger-solid">Тийм, нэг мөсөн устгах</button>
            </form>
          </details>
        </div>
      </section>
    </>
  );
}
