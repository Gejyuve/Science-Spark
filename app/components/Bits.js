import Link from "next/link";
import { cache } from "react";
import { relTime } from "@/lib/format";
import { sql } from "@/lib/db";
import { levelFor } from "@/lib/levels";
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
  if (user?.avatar) {
    return <img className="ss-avatar" src={`/img/${user.avatar}`} width={size} height={size} alt="" style={{ width: size, height: size, objectFit: "cover" }} />;
  }
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

export function Stat({ points = 0, followers = 0, followed = false, link = true }) {
  const pts = (
    <>
      <img src="/icons/spark.svg" width={16} height={16} alt="" />
      <span>{fmtK(points)}</span>
    </>
  );
  return (
    <span className="ss-stat">
      {link ? <Link href="/och" className="ss-stat-och" title="Очны учир">{pts}</Link> : pts}
      <i>·</i>
      <span className={"ss-fol" + (followed ? " followed" : "")} title={followed ? "Та дагаж байна" : undefined}>
        <img src="/icons/followers.svg" width={13} height={13} alt="" />
        <span>{fmtK(followers)}</span>
      </span>
    </span>
  );
}

// Огноо эсвэл "3 цаг" — дүрстэй
export function When({ d, size = 14, className = "ss-date", align = "right" }) {
  const r = relTime(d);
  const exact = new Date(d).toLocaleString("sv-SE", { timeZone: "Asia/Ulaanbaatar" }).slice(0, 16).replaceAll("-", ".");
  return (
    <span className={className + " tip" + (align === "left" ? " tip-l" : "")} data-tip={`Нийтлэгдсэн: ${exact}`} tabIndex={0}>
      <img className="ic" src={`/icons/${r.recent ? "f_clock" : "date16"}.svg`} width={size} height={size} alt="" />
      {r.text}
    </span>
  );
}

// Нэвтэрсэн хүний дагаж буй хүмүүсийн жагсаалт (нэг хуудсанд нэг удаа)
// Нэг хүсэлтийн дотор хуудас ба баруун самбар хоёулаа дуудна: React cache нэг л удаа асуулга явуулна
const followsOf = cache(async (id) => {
  try {
    const r = await sql`SELECT followee_id FROM follows WHERE follower_id = ${id}`;
    return new Set(r.map((x) => x.followee_id));
  } catch (e) {
    return new Set();
  }
});
export async function followingSet(viewer) {
  return viewer ? followsOf(viewer.id) : new Set();
}

// Дагах "+" товч (Figma: товч профайлын очны тооны хажууд)
export function FollowBtn({ id, viewer, following }) {
  if (viewer && viewer.id === id) return null;
  if (!viewer) {
    return <Link href="/login" className="ss-follow" title="Дагах" aria-label="Дагах">+</Link>;
  }
  if (following?.has(id)) return null; // дагасан бол товч алга болж, дагагчийн тоо саарал болно
  return (
    <form action={toggleFollow} className="ss-follow-form">
      <input type="hidden" name="user_id" value={id} />
      <button type="submit" className="ss-follow" title="Дагах" aria-label="Дагах">
        +
      </button>
    </form>
  );
}

// Дэмжигчдийн жагсаалт: цөөхөн тул бүгдийг нэг асуулгаар авч 60 сек хадгална
const SUP_TTL = 60000;
let supCache = { at: 0, ids: null };
export const supporterSet = cache(async () => {
  if (supCache.ids && Date.now() - supCache.at < SUP_TTL) return supCache.ids;
  try {
    const rows = await sql`SELECT id FROM users WHERE premium_until > now()`;
    supCache = { at: Date.now(), ids: new Set(rows.map((r) => r.id)) };
  } catch (e) {
    return supCache.ids || new Set();
  }
  return supCache.ids;
});

// Нэрний хажуугийн тэмдэг: түвшин, дэмжигч бол аянга
// Тэмдэг саарал байж, хулгана ойртоход эсвэл хааяа анивчихад өнгөө гаргана. seed нь анивчих мөчийг хүн бүрт ялгана.
export function NameBadges({ points = 0, supporter = false, size = 16, seed = points }) {
  const l = levelFor(points);
  if (!l.n && !supporter) return null;
  return (
    <span className="ss-nbadges" style={{ "--nb-d": `-${(Number(seed) * 7.3) % 16}s` }}>
      {l.n > 0 && <img src={`/icons/lv${l.n}.svg`} width={size} height={size} alt={`Түвшин ${l.n} · ${l.name}`} title={`Түвшин ${l.n} · ${l.name}`} />}
      {supporter && <img src="/icons/bolt.svg" width={size} height={size} alt="Дэмжигч" title="Шинжлэх ухааныг дэмжигч" />}
    </span>
  );
}

// Товч профайл: зураг, нэр, түвшин · дэмжигч тэмдэг, оч · дагагч, дагах товч
export async function Person({ id, initial, first_name, avatar = null, points = 0, followers = 0, size = 40, viewer, following, className = "" }) {
  const supporter = (await supporterSet()).has(id);
  return (
    <div className={"ss-person " + className}>
      <Link href={`/u/${id}`} className="ss-person-av"><Avatar user={{ id, first_name, avatar }} size={size} /></Link>
      <div>
        <span className="ss-person-line">
          <Link href={`/u/${id}`} className="ss-person-name"><b>{first_name ? (initial ? `${initial}.${first_name}` : first_name) : "Шинэ хэрэглэгч"}</b></Link>
          <NameBadges points={points} supporter={supporter} seed={id} />
        </span>
        <span className="ss-statrow">
          <Stat points={points} followers={followers} followed={!!following?.has(id)} />
          <FollowBtn id={id} viewer={viewer} following={following} />
        </span>
      </div>
    </div>
  );
}
