import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser, isSuperAdmin } from "@/lib/auth";
import { sql, ensureSchema } from "@/lib/db";
import { streamOn, playToken, thumbSrc, refreshPending, fmtDuration, MAX_VIDEO_BYTES } from "@/lib/video";
import { relTime } from "@/lib/format";
import Shell from "../components/Shell";
import PageHero from "../components/PageHero";
import Uploader from "./Uploader";
import Refresh from "./Refresh";

export const dynamic = "force-dynamic";
export const metadata = { title: "Видео · Science Spark" };

const STATE = { processing: ["Боловсруулж байна", "wait"], error: ["Алдаа гарсан", "bad"], archived: ["Архивласан", "gray"] };

// Видео хуудас: бэлэн болтол зөвхөн супер админд харагдана (бусдад 404)
export default async function VideoPage({ searchParams }) {
  const sp = await searchParams;
  const user = await getUser();
  if (!isSuperAdmin(user?.operator || user)) notFound();
  await ensureSchema();
  const tab = sp.tab === "archived" ? "archived" : "";
  const rows = await refreshPending(
    tab ? await sql`SELECT * FROM videos WHERE status = 'archived' ORDER BY updated_at DESC LIMIT 100`
      : await sql`SELECT * FROM videos WHERE status <> 'archived' ORDER BY created_at DESC LIMIT 100`
  );
  const [{ n: archived }] = await sql`SELECT COUNT(*)::int AS n FROM videos WHERE status = 'archived'`;
  // Зураг харуулахад ч гарын үсэгтэй түлхүүр хэрэгтэй
  const thumbs = await Promise.all(rows.map((v) => (v.status === "ready" || v.status === "archived" ? playToken(v.uid).then(thumbSrc).catch(() => null) : null)));
  const on = streamOn();

  return (
    <Shell user={user} active="/video" header={false}>
      <div className="vd-page">
        <PageHero tone="video" title="Видео" text="Шинжлэх ухааны видео лекц, туршилт, ярилцлага. Одоогоор зөвхөн супер админд харагдаж байна." />
        <Refresh on={rows.some((v) => v.status === "processing")} />

        {sp.ok === "deleted" && <p className="vd-ok">Видеог нэг мөсөн устгалаа.</p>}
        {!on && (
          <p className="vd-err card">Cloudflare Stream холбогдоогүй байна. Vercel-ийн Environment Variables хэсэгт <code>CLOUDFLARE_ACCOUNT_ID</code>, <code>CLOUDFLARE_STREAM_TOKEN</code> хоёрыг нэмээд дахин deploy хийнэ үү.</p>
        )}
        {on && !tab && <Uploader maxBytes={MAX_VIDEO_BYTES} />}

        <nav className="vd-tabs" aria-label="Видео">
          <Link href="/video" className={tab ? "" : "on"}>Видеонууд</Link>
          <Link href="/video?tab=archived" className={tab ? "on" : ""}>Архив{archived > 0 && <em>{archived}</em>}</Link>
        </nav>

        {rows.length === 0 ? (
          <p className="ss-card vd-empty">{tab ? "Архивласан видео алга." : "Одоогоор видео алга. Дээрээс анхны видеогоо оруулаарай."}</p>
        ) : (
          <div className="vd-grid">
            {rows.map((v, i) => {
              const st = STATE[v.status];
              const body = (
                <>
                  <span className="vd-thumb">
                    {thumbs[i] ? <img src={thumbs[i]} alt="" loading="lazy" /> : <i aria-hidden="true">🎬</i>}
                    {v.duration > 0 && <small>{fmtDuration(v.duration)}</small>}
                  </span>
                  <span className="vd-meta">
                    <b>{v.title}</b>
                    <small>{relTime(v.created_at).text}{st && <em className={"vd-st " + st[1]}>{st[0]}</em>}</small>
                  </span>
                </>
              );
              return v.status === "processing"
                ? <div key={v.id} className="vd-item">{body}</div>
                : <Link key={v.id} href={`/video/${v.id}`} className="vd-item">{body}</Link>;
            })}
          </div>
        )}
      </div>
    </Shell>
  );
}
