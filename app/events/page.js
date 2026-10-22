import Link from "next/link";
import { getUser } from "@/lib/auth";
import { sql, ensureSchema } from "@/lib/db";
import { EVENT_TYPES } from "@/lib/format";
import { nowLocal, monthGrid, addMonths, WD_SHORT, fmtEventRange, endLocal, spanText, validLocal, hueFor, daysIn } from "@/lib/events";
import Shell from "../components/Shell";
import PostCard from "../components/PostCard";
import { followingSet } from "../components/Bits";
import Cover, { TONE } from "../components/EventCover";

export const dynamic = "force-dynamic";
export const metadata = { title: "Эвент · Science Spark" };

const MONTHS_AHEAD = 7;


export default async function Events({ searchParams }) {
  const sp = await searchParams;
  const now = nowLocal();
  const months = Array.from({ length: MONTHS_AHEAD }, (_, k) => addMonths(now.y, now.m, k));
  const sel = /^\d{4}-\d{2}$/.test(sp.m || "") ? { y: +sp.m.slice(0, 4), m: +sp.m.slice(5) } : { y: now.y, m: now.m };
  const type = EVENT_TYPES.includes(sp.type) ? sp.type : "";
  const grid = monthGrid(sel.y, sel.m);
  let user = null, inMonth = [], upcoming = [];
  try {
    user = await getUser();
    await ensureSchema();
    const first = months[0], last = months[months.length - 1];
    const lo = [`${first.y}-${String(first.m).padStart(2, "0")}-01`, grid[0].key].sort()[0];
    const hiM = `${last.y}-${String(last.m).padStart(2, "0")}-${daysIn(last.y, last.m)}`;
    const hi = [hiM, grid[grid.length - 1].key].sort()[1] + "T99";
    // Харагдах хугацаатай давхцах бүх эвент (олон өдрийн эвент ч орно)
    inMonth = await sql`
      SELECT id, title, meta FROM posts
      WHERE kind = 'Эвент' AND status = 'published'
        AND meta->>'starts_at' < ${hi}
        AND COALESCE(meta->>'ends_at', meta->>'starts_at') >= ${lo}
      ORDER BY meta->>'starts_at', id`;
    upcoming = await sql`
      SELECT p.id, p.author_id, p.kind, p.title, p.body, p.meta, p.image_id, p.views, p.created_at, u.initial, u.first_name, u.avatar_id AS avatar,
        (SELECT COUNT(*) FROM sparks WHERE post_id = p.id)::int AS sparks,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id)::int AS comments,
        COALESCE((SELECT SUM(delta) FROM points_ledger WHERE user_id = u.id), 0)::int AS author_points,
        (SELECT COUNT(*) FROM follows WHERE followee_id = u.id)::int AS author_followers,
        EXISTS (SELECT 1 FROM saves WHERE post_id = p.id AND user_id = ${user ? user.id : 0}) AS saved,
        EXISTS (SELECT 1 FROM sparks WHERE post_id = p.id AND user_id = ${user ? user.id : 0}) AS sparked
      FROM posts p JOIN users u ON u.id = p.author_id
      WHERE p.kind = 'Эвент' AND p.status = 'published' AND COALESCE(p.meta->>'ends_at', p.meta->>'starts_at') >= ${now.day}
        AND (${type} = '' OR p.meta->>'type' = ${type})
      ORDER BY p.meta->>'starts_at' LIMIT 30`;
  } catch (e) {}
  // Эвент бүрийн эхлэх, дуусах өдөр
  const evs = inMonth
    .filter((e) => validLocal(e.meta?.starts_at))
    .map((e) => ({ ...e, s: e.meta.starts_at.slice(0, 10), e: endLocal(e.meta).slice(0, 10) }));
  // Сар бүрт хэдэн эвент давхцаж байгаа
  const followSet = await followingSet(user);
  const perMonth = {};
  for (const x of months) {
    const k = `${x.y}-${String(x.m).padStart(2, "0")}`;
    perMonth[k] = evs.filter((e) => e.s <= `${k}-31` && e.e >= `${k}-01`).length;
  }
  // Сонгосон сарын тор дээрх эвентүүд: тус бүрт өөр өнгө, өдөр дамнасан эвент нэг эгнээнд
  const shown = evs.filter((e) => e.s <= grid[grid.length - 1].key && e.e >= grid[0].key)
    .sort((a, b) => a.s.localeCompare(b.s) || b.e.localeCompare(a.e) || a.meta.starts_at.localeCompare(b.meta.starts_at) || a.id - b.id);
  shown.forEach((e, i) => (e.hue = hueFor(i)));
  const lanes = {};
  for (const e of shown) {
    const days = grid.filter((c) => c.key >= e.s && c.key <= e.e).map((c) => c.key);
    let L = 0;
    while (days.some((d) => lanes[d]?.[L])) L++;
    for (const d of days) (lanes[d] ||= [])[L] = e;
  }
  const MAX_LANES = 3;
  const q = (o) => "/events?" + new URLSearchParams(Object.entries({ m: `${sel.y}-${String(sel.m).padStart(2, "0")}`, type, ...o }).filter(([, v]) => v));

  return (
    <Shell user={user} active="/events" header="nav">
      <div className="ss-card ev-months">
        {months.map((x, i) => {
          const key = `${x.y}-${String(x.m).padStart(2, "0")}`;
          const on = x.y === sel.y && x.m === sel.m;
          const yearStart = i === 0 || x.m === 1;
          return (
            <Link key={key} href={q({ m: key })} className={"ev-month" + (on ? " on" : "") + (perMonth[key] ? " has" : "")}>
              {yearStart && <i>{x.y} он</i>}
              <b>{x.m}</b>
              <small>{perMonth[key] ? `${perMonth[key]} эвент` : "сар"}</small>
            </Link>
          );
        })}
      </div>

      <div className="ss-card ev-cal">
        <div className="ev-cal-head">
          <b>{sel.y} оны {sel.m}-р сар</b>
          <Link href={user ? "/?compose=Эвент" : "/login"} className="ev-add">+ Эвент нэмэх</Link>
          <span className="ss-grow" />
          <Link href={q({ m: (() => { const p = addMonths(sel.y, sel.m, -1); return `${p.y}-${String(p.m).padStart(2, "0")}`; })() })} className="ev-nav" aria-label="Өмнөх сар">‹</Link>
          <Link href={q({ m: (() => { const p = addMonths(sel.y, sel.m, 1); return `${p.y}-${String(p.m).padStart(2, "0")}`; })() })} className="ev-nav" aria-label="Дараах сар">›</Link>
        </div>
        <div className="ev-grid">
          {WD_SHORT.map((w) => <span key={w} className="ev-wd">{w}</span>)}
          {grid.map((c, idx) => {
            const slots = lanes[c.key] || [];
            const hidden = slots.slice(MAX_LANES).filter(Boolean).length;
            const today = c.key === now.day;
            const col = idx % 7;
            return (
              <div key={c.key} className={"ev-day" + (c.out ? " out" : "") + (today ? " today" : "") + (c.key < now.day ? " past" : "")}>
                <span className="ev-num">{c.d}</span>
                {slots.slice(0, MAX_LANES).map((e, L) => {
                  if (!e) return <span key={L} className="ev-slot" />;
                  const head = c.key === e.s || col === 0;
                  const tail = c.key === e.e || col === 6;
                  return (
                    <Link key={L} href={`/post/${e.id}`} style={{ "--h": e.hue }}
                      className={"ev-chip" + (head ? " head" : " cont") + (tail ? " tail" : " more")}
                      title={`${e.title} · ${fmtEventRange(e.meta)}`}>
                      {head ? e.title : "\u00a0"}
                    </Link>
                  );
                })}
                {hidden > 0 && <small className="ev-more">+{hidden}</small>}
              </div>
            );
          })}
        </div>
      </div>

      {shown.length > 0 && (
        <div className="ss-card ev-legend">
          <b>{sel.m}-р сарын эвентүүд ({shown.length})</b>
          <ul>
            {shown.map((e) => (
              <li key={e.id}>
                <i style={{ "--h": e.hue }} />
                <Link href={`/post/${e.id}`}>{e.title}</Link>
                <small>{fmtEventRange(e.meta)}</small>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="ev-bar">
        <b>Ойрын эвентүүд</b>
        <span className="ss-grow" />
        <small>Нийт {upcoming.length} эвент</small>
      </div>
      <div className="ev-filters">
        <Link href={q({ type: "" })} className={type ? "" : "on"}>Бүгд</Link>
        {EVENT_TYPES.map((t) => <Link key={t} href={q({ type: t })} className={type === t ? "on" : ""}>{t}</Link>)}
      </div>

      {upcoming.length === 0 && (
        <div className="ss-card"><p className="ss-empty">{type ? `Ойрын хугацаанд «${type}» эвент алга.` : "Ойрын хугацаанд эвент алга. Эхний эвентийг та зарлаарай ✦"}</p></div>
      )}
      {upcoming.map((e) => <PostCard key={e.id} p={e} viewer={user} following={followSet} />)}
    </Shell>
  );
}
