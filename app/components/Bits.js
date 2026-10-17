import Link from "next/link";
import { relTime } from "@/lib/format";
import { sql } from "@/lib/db";
import { toggleFollow } from "../posts/actions";

// Жижиг дахин ашиглах хэсгүүд: аватар, оч/дагагчийн тоо
const COLORS = ["#37C3B3", "#5B8DEF", "#F59E0B", "#E5484D", "#8E6CEF", "#00A89B", "#EF6C9C"];

export function fmtK(n) {
  n = Number(n) || 0;
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

export function Avatar({ user, size = 40 }) {
  const id = Number(user?.id) || 0;
  const letter = (user?.first_name || "?")[0];
  return (
    <span
      className="ss-avatar"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42), background: COLORS[id % COLORS.length] }}
      aria-hidden="true"
    >
      {letter}
    </span>
  );
}

export function Stat({ points = 0, followers = 0 }) {
  return (
    <span className="ss-stat">
      <img src="/icons/spark.svg" width={16} height={16} alt="" />
      <span>{fmtK(points)}</span>
      <i>·</i>
      <img src="/icons/followers.svg" width={13} height={13} alt="" />
      <span>{fmtK(followers)}</span>
    </span>
  );
}

// Огноо эсвэл "3 цаг" — дүрстэй
export function When({ d, size = 14, className = "ss-date" }) {
  const r = relTime(d);
  return (
    <span className={className} title={new Date(d).toLocaleString("sv-SE", { timeZone: "Asia/Ulaanbaatar" }).slice(0, 16)}>
      <img className="ic" src={`/icons/${r.recent ? "f_clock" : "date16"}.svg`} width={size} height={size} alt="" />
      {r.text}
    </span>
  );
}

// Нэвтэрсэн хүний дагаж буй хүмүүсийн жагсаалт (нэг хуудсанд нэг удаа)
export async function followingSet(viewer) {
  if (!viewer) return new Set();
  try {
    const r = await sql`SELECT followee_id FROM follows WHERE follower_id = ${viewer.id}`;
    return new Set(r.map((x) => x.followee_id));
  } catch (e) {
    return new Set();
  }
}

// Дагах "+" товч (Figma: товч профайлын очны тооны хажууд)
export function FollowBtn({ id, viewer, following }) {
  if (viewer && viewer.id === id) return null;
  if (!viewer) {
    return <Link href="/login" className="ss-follow" title="Дагах" aria-label="Дагах">+</Link>;
  }
  const on = following?.has(id);
  return (
    <form action={toggleFollow} className="ss-follow-form">
      <input type="hidden" name="user_id" value={id} />
      <button type="submit" className={"ss-follow" + (on ? " on" : "")} title={on ? "Дагахаа болих" : "Дагах"} aria-label={on ? "Дагахаа болих" : "Дагах"}>
        {on ? "✓" : "+"}
      </button>
    </form>
  );
}

// Товч профайл: зураг, нэр, оч · дагагч, дагах товч
export function Person({ id, initial, first_name, points = 0, followers = 0, size = 40, viewer, following, className = "" }) {
  return (
    <div className={"ss-person " + className}>
      <Link href={`/u/${id}`} className="ss-person-av"><Avatar user={{ id, first_name }} size={size} /></Link>
      <div>
        <Link href={`/u/${id}`} className="ss-person-name"><b>{first_name ? `${initial}.${first_name}` : "Шинэ хэрэглэгч"}</b></Link>
        <span className="ss-statrow">
          <Stat points={points} followers={followers} />
          <FollowBtn id={id} viewer={viewer} following={following} />
        </span>
      </div>
    </div>
  );
}
