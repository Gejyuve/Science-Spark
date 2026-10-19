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
        {t.meta?.reward > 0 && <em className="tk-reward" title="Биелүүлсэн клубт олгох оч"><img src="/icons/spark.svg" width={13} height={13} alt="" />{t.meta.reward}</em>}
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
          {!compact && t.done > 0 && <span className="tk-stat" title="Биелүүлсэн клуб">✓ {t.done}</span>}
          {!compact && <small>{fmtDate(t.created_at)}</small>}
        </div>
      </div>
    </article>
  );
}

// Тайлангийн карт: ковер, биелүүлсэн даалгавар, гарчиг, клуб
export function ReportCard({ r, compact }) {
  return (
    <article className={"tk-card rp-card" + (compact ? " compact" : "")}>
      <Link href={`/post/${r.id}`} className="tk-cover" tabIndex={-1} aria-hidden="true">
        {r.image_id ? <img src={`/img/${r.image_id}`} alt="" loading="lazy" /> : <span />}
      </Link>
      <div className="tk-body">
        {r.task_id && <Link href={`/post/${r.task_id}`} className="rp-task">✓ {r.task_title}</Link>}
        <Link href={`/post/${r.id}`} className="tk-title">{r.title}</Link>
        {!compact && r.subtitle && <p className="tk-sub">{r.subtitle}</p>}
        <div className="tk-foot">
          <Link href={`/club/${r.club_id}`} className="tk-club"><ClubAv c={{ id: r.club_id, name: r.club_name, logo: r.club_logo }} size={22} /><span>{r.club_name}</span></Link>
          <span className="ss-grow" />
          <span className="tk-stat" title="Оч"><img src="/icons/spark.svg" width={14} height={14} alt="" />{fmtK(r.sparks)}</span>
          {!compact && <small>{fmtDate(r.created_at)}</small>}
        </div>
      </div>
    </article>
  );
}

// «Клуб» ангилал: Даалгавар ба Тайлан
export function ClubTabs({ on, counts = {} }) {
  return (
    <nav className="tk-tabs" aria-label="Клуб">
      <Link href="/tasks" className={on === "tasks" ? "on" : ""}>Даалгавар{counts.tasks != null && <em>{counts.tasks}</em>}</Link>
      <Link href="/reports" className={on === "reports" ? "on" : ""}>Тайлан{counts.reports != null && <em>{counts.reports}</em>}</Link>
    </nav>
  );
}
