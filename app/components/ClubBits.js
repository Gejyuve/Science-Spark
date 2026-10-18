import Link from "next/link";
import { fmtK } from "./Bits";
import { toggleClubFollow } from "../clubs/actions";

const COLORS = ["#37C3B3", "#5B8DEF", "#F59E0B", "#E5484D", "#8E6CEF", "#00A89B", "#EF6C9C"];

export function ClubAv({ c, size = 40 }) {
  if (c.logo) return <img className="ss-avatar" src={`/img/${c.logo}`} width={size} height={size} alt="" style={{ width: size, height: size, objectFit: "cover" }} />;
  return <span className="ss-avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.42), background: COLORS[(Number(c.id) || 0) % COLORS.length] }} aria-hidden="true">{(c.name || "?")[0]}</span>;
}

export function ClubFollow({ id, viewer, followed }) {
  if (!viewer) return <Link href="/login" className="ss-follow" title="Дагах" aria-label="Дагах">+</Link>;
  if (followed) return null;
  return (
    <form action={toggleClubFollow} className="ss-follow-form">
      <input type="hidden" name="club_id" value={id} />
      <button type="submit" className="ss-follow" title="Клубыг дагах" aria-label="Клубыг дагах">+</button>
    </form>
  );
}

// Клубын нэр + оч · дагагч + дагах товч (Figma «Club info»)
export function ClubPerson({ c, viewer, follows, size = 40, points }) {
  const followed = !!follows?.has(c.id);
  return (
    <div className="ss-person">
      <Link href={`/club/${c.id}`} className="ss-person-av"><ClubAv c={c} size={size} /></Link>
      <div>
        <Link href={`/club/${c.id}`} className="ss-person-name"><b>{c.name}</b></Link>
        <span className="ss-statrow">
          <span className="ss-stat">
            <Link href="/och" className="ss-stat-och" title="Очны учир"><img src="/icons/spark.svg" width={16} height={16} alt="" /><span>{fmtK(points ?? c.points)}</span></Link>
            <i>·</i>
            <span className={"ss-fol" + (followed ? " followed" : "")} title={followed ? "Та дагаж байна" : "Дагагч"}>
              <img src="/icons/followers.svg" width={13} height={13} alt="" /><span>{fmtK(c.followers)}</span>
            </span>
          </span>
          <ClubFollow id={c.id} viewer={viewer} followed={followed} />
        </span>
      </div>
    </div>
  );
}
