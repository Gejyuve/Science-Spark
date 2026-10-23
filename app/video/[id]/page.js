import { notFound } from "next/navigation";
import { getUser, isSuperAdmin } from "@/lib/auth";
import { sql, ensureSchema } from "@/lib/db";
import { playToken, iframeSrc, refreshPending, fmtDuration } from "@/lib/video";
import { relTime } from "@/lib/format";
import Shell from "../../components/Shell";
import Refresh from "../Refresh";
import { saveVideo, archiveVideo, deleteVideo } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Видео · Science Spark" };

export default async function WatchVideo({ params, searchParams }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const user = await getUser();
  if (!isSuperAdmin(user?.operator || user)) notFound();
  const vid = Number(id);
  if (!Number.isInteger(vid)) notFound();
  await ensureSchema();
  const [v] = await refreshPending(await sql`SELECT * FROM videos WHERE id = ${vid}`);
  if (!v) notFound();
  const token = v.status === "ready" || v.status === "archived" ? await playToken(v.uid).catch(() => null) : null;

  return (
    <Shell user={user} active="/video" header={false}>
      <div className="vd-page">
        <Refresh on={v.status === "processing"} />
        <div className="vd-player">
          {token ? (
            // Cloudflare-ийн тоглуулагч: зогсоох, үргэлжлүүлэх, дуу, бүтэн дэлгэц. Татах товчгүй, холбоос хугацаатай.
            <iframe src={iframeSrc(token)} title={v.title} loading="lazy"
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture" allowFullScreen />
          ) : (
            <div className="vd-wait">
              <span aria-hidden="true">🎬</span>
              <p>{v.status === "error" ? "Видеог боловсруулахад алдаа гарлаа. Устгаад дахин оруулна уу." : v.status === "processing" ? "Видеог боловсруулж байна. Бэлэн болмогц энд гарна." : "Видеог ачаалж чадсангүй. Дахин оролдоно уу."}</p>
            </div>
          )}
        </div>

        <section className="ss-card vd-info">
          <h1>{v.title}</h1>
          <p className="vd-sub">
            {relTime(v.created_at).text}{v.duration > 0 && <> · {fmtDuration(v.duration)}</>}
            {v.status === "archived" && <em className="vd-st gray">Архивласан</em>}
          </p>
          {v.body && <p className="vd-body">{v.body}</p>}
        </section>

        {sp.error && <p className="vd-err">{sp.error}</p>}

        <section className="ss-card vd-manage">
          <h2>Удирдах</h2>
          <form action={saveVideo} className="vd-edit">
            <input type="hidden" name="vid" value={v.id} />
            <input className="vd-in" name="title" defaultValue={v.title} maxLength={140} required />
            <textarea className="vd-in" name="body" defaultValue={v.body || ""} maxLength={2000} rows={3} placeholder="Тайлбар" />
            <button type="submit" className="tm-btn ghost">Хадгалах</button>
          </form>
          <div className="vd-acts">
            {(v.status === "ready" || v.status === "archived") && (
              <form action={archiveVideo}>
                <input type="hidden" name="vid" value={v.id} />
                <input type="hidden" name="on" value={v.status === "archived" ? "0" : "1"} />
                <button type="submit" className="tm-btn ghost">{v.status === "archived" ? "Архиваас гаргах" : "Архивлах"}</button>
              </form>
            )}
            <details className="vd-del">
              <summary className="tm-btn ghost">Устгах</summary>
              <form action={deleteVideo}>
                <input type="hidden" name="vid" value={v.id} />
                <p>Видео Cloudflare-аас нэг мөсөн устгагдана, буцааж сэргээх боломжгүй. Түр нуух бол «Архивлах»-ыг сонгоорой.</p>
                <button type="submit" className="tm-btn vd-danger">Тийм, нэг мөсөн устгах</button>
              </form>
            </details>
          </div>
          <p className="vd-hint">Архивласан видео сайтад харагдахгүй ч файл нь хадгалагдсаар (хадгалалтын төлбөр гарна). Устгавал төлбөр зогсоно.</p>
        </section>
      </div>
    </Shell>
  );
}
