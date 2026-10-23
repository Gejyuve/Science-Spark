import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { requireSection } from "@/lib/admin";
import { playToken, iframeSrc, refreshPending, fmtDuration } from "@/lib/video";
import { fmtDate } from "@/lib/format";
import Head, { Chip, Flash } from "../../_c/Head";
import Refresh from "../Refresh";
import { saveVideo, archiveVideo, deleteVideo } from "../actions";
import { VideoFields } from "../Uploader";
import { videoAuthors } from "../authors";
import { plainTree } from "@/lib/tree";

const STATE = { processing: ["Боловсруулж байна", "warn"], ready: ["Нийтлэгдсэн", "ok"], error: ["Алдаа гарсан", "bad"], archived: ["Архивласан", "gray"] };

// Нэг видеог засах: гарчиг, тайлбар, playlist, нээх үнэ, онцлох, архивлах, устгах
export default async function EditVideo({ params, searchParams }) {
  const user = await requireSection("videos");
  if (user.role !== "superadmin") redirect("/admin");
  const [{ id }, { ok, error }] = await Promise.all([params, searchParams]);
  const vid = Number(id);
  if (!Number.isInteger(vid)) notFound();
  const [v] = await refreshPending(await sql`
    SELECT v.*, p.subtitle, p.category, p.author_id, p.image_id, p.body AS post_body, p.views AS page_views, p.status AS post_status
    FROM videos v LEFT JOIN posts p ON p.id = v.post_id WHERE v.id = ${vid}`);
  if (!v) notFound();
  const playlists = await sql`SELECT id, title FROM video_playlists ORDER BY position, id`;
  const [{ unlocks, spent, paid }] = await sql`SELECT COUNT(*)::int AS unlocks, COALESCE(SUM(cost), 0)::int AS spent, COALESCE(SUM(paid_mnt), 0)::int AS paid FROM video_unlocks WHERE video_id = ${vid}`;
  const authors = await videoAuthors(user);
  const token = v.status === "ready" || v.status === "archived" ? await playToken(v.uid).catch(() => null) : null;
  const st = STATE[v.status];

  return (
    <>
      <Head user={user} title={v.title} sub={<>Оруулсан {fmtDate(v.created_at)}{v.duration > 0 && <> · {fmtDuration(v.duration)}</>} · {v.page_views || 0} хүн нээсэн · {v.views} хүн тоглуулсан · {unlocks} хүн нээсэн ({spent} оч, {paid.toLocaleString("en-US")}₮)</>} />
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
          <div className="adm-card-head"><b>Мэдээлэл</b><Chip tone={st?.[1]}>{st?.[0]}</Chip>{v.post_id && v.status === "ready" && <Link href={`/post/${v.post_id}`} className="adm-btn">Сайт дээр харах</Link>}</div>
          <form action={saveVideo} className="vd-edit">
            <input type="hidden" name="vid" value={v.id} />
            <VideoFields v={{ ...v, body: v.post_body ?? v.body }} tree={plainTree()} authors={authors} playlists={playlists} />
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
