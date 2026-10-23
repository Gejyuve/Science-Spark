import Link from "next/link";
import { When } from "../components/Bits";
import Share from "../components/Share";
import { fmtDuration } from "@/lib/video";

// Видеоны зураг: үргэлжлэх хугацаа, үзсэн хэсгийн зурвас, нээх үнэ
export function Thumb({ v, thumb, access, big = false }) {
  const pct = v.seconds > 0 && v.duration > 0 ? Math.min(100, Math.round((v.seconds / v.duration) * 100)) : 0;
  return (
    <span className={"vc-thumb" + (big ? " big" : "")}>
      {thumb ? <img src={thumb} alt="" loading="lazy" /> : <i aria-hidden="true">🎬</i>}
      <b className="vc-play" aria-hidden="true" />
      {!access && <em className="vc-lock">🔒 {v.price} оч</em>}
      {access && !v.price && <em className="vc-lock free">Үнэгүй</em>}
      {v.duration > 0 && <small>{fmtDuration(v.duration)}</small>}
      {pct > 0 && <i className="vc-prog" style={{ width: `${pct}%` }} aria-label={`${pct}% үзсэн`} />}
    </span>
  );
}

// Урсгал дахь видео карт: нийтлэлийн карттай ижил бүтэц (ангилал, огноо, гарчиг, тайлбар, зураг, үйлдлийн мөр)
export default function VideoCard({ v, thumb, access }) {
  const href = `/video/${v.id}`;
  const text = v.body ? (v.body.length > 220 ? v.body.slice(0, 220) + "…" : v.body) : "";
  return (
    <article className="ss-card pc vc">
      <Link href={href} className="pc-link" aria-hidden="true" tabIndex={-1} />
      <div className="ss-card-top">
        <span className="evc-crumb">
          <Link href="/video" className="ss-kind">Видео</Link>
          {v.playlist && <><i>·</i><Link href={`/video?pl=${v.playlist_id}`} className="pc-cat">{v.playlist}</Link></>}
        </span>
        <When d={v.created_at} />
      </div>
      <Link href={href} className="ss-card-body">
        <h2>{v.title}</h2>
        {text && <p>{text}</p>}
        <Thumb v={v} thumb={thumb} access={access} />
      </Link>
      <div className="ss-actionbar">
        <span className="ss-count tip" data-tip={`${v.views} хүн үзсэн`}><img className="ic" src="/icons/eye.svg" width={22} height={22} alt="Үзэлт" />{v.views}</span>
        <Link href={href} className="ss-pill">{v.seconds > 0 ? "Үргэлжлүүлэх" : access ? "Үзэх" : "Нээх"}</Link>
        <span className="ss-grow" />
        <Share path={href} title={v.title} icon="ashare" size={24} align="right" />
      </div>
    </article>
  );
}
