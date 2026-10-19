import Link from "next/link";
import { ClubAv } from "./ClubBits";
import { fmtK } from "./Bits";
import { fmtDate } from "@/lib/format";

// Даалгаврын карт: ковер, төрлүүд, гарчиг, нэмсэн клуб
export default function TaskCard({ t, compact }) {
  const types = Array.isArray(t.meta?.types) ? t.meta.types : [];
  return (
    <article className={"tk-card" + (compact ? " compact" : "")}>
      <Link href={`/post/${t.id}`} className="tk-cover" tabIndex={-1} aria-hidden="true">
        {t.image_id ? <img src={`/img/${t.image_id}`} alt="" loading="lazy" /> : <span />}
      </Link>
      <div className="tk-body">
        {types.length > 0 && (
          <span className="tk-tags">{types.slice(0, compact ? 2 : 4).map((x) => <Link key={x} href={`/tasks?t=${encodeURIComponent(x)}`}>{x}</Link>)}</span>
        )}
        <Link href={`/post/${t.id}`} className="tk-title">{t.title}</Link>
        {!compact && t.subtitle && <p className="tk-sub">{t.subtitle}</p>}
        <div className="tk-foot">
          <Link href={`/club/${t.club_id}`} className="tk-club"><ClubAv c={{ id: t.club_id, name: t.club_name, logo: t.club_logo }} size={22} /><span>{t.club_name}</span></Link>
          <span className="ss-grow" />
          <span className="tk-stat" title="Оч"><img src="/icons/spark.svg" width={14} height={14} alt="" />{fmtK(t.sparks)}</span>
          {!compact && <small>{fmtDate(t.created_at)}</small>}
        </div>
      </div>
    </article>
  );
}
