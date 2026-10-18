import Link from "next/link";
import { getUser } from "@/lib/auth";
import { ensureSchema } from "@/lib/db";
import { clubBoard, PERIODS } from "@/lib/clubs";
import Shell from "../components/Shell";
import ClubMap from "../components/ClubMap";
import { Avatar, Stat, FollowBtn, followingSet } from "../components/Bits";

export const dynamic = "force-dynamic";
export const metadata = { title: "Клуб · Science Spark" };

const PER = 10;

// Figma 75:2 «Клуб»: газрын зураг ба ТОП-100 клуб
export default async function Clubs({ searchParams }) {
  const sp = await searchParams;
  const period = PERIODS[sp.t] ? sp.t : "all";
  let user = null, board = [];
  try {
    user = await getUser();
    await ensureSchema();
    board = await clubBoard(period);
  } catch (e) {}
  const following = await followingSet(user);

  // Газрын зураг: координаттай клубууд
  const onMap = board.filter((c) => c.lat != null && c.lng != null)
    .map(({ id, first_name, avatar, aimag, about, lat, lng, points, members, rank }) => ({ id, first_name, avatar, aimag, about, lat, lng, points, members, rank }));
  const aimags = new Set(onMap.map((c) => c.aimag).filter(Boolean)).size;

  const pages = Math.max(1, Math.ceil(board.length / PER));
  const page = Math.min(pages, Math.max(1, parseInt(sp.p) || 1));
  const rows = board.slice((page - 1) * PER, page * PER);
  const href = (o) => {
    const q = new URLSearchParams();
    const t = o.t ?? period, p = o.p ?? 1;
    if (t !== "all") q.set("t", t);
    if (p > 1) q.set("p", p);
    const s = q.toString();
    return "/clubs" + (s ? "?" + s : "");
  };
  const nums = pages <= 5 ? Array.from({ length: pages }, (_, i) => i + 1)
    : [...new Set([1, 2, 3, page - 1, page, page + 1, pages].filter((n) => n >= 1 && n <= pages))].sort((a, b) => a - b);
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ulaanbaatar" }).replaceAll("-", ".");

  return (
    <Shell user={user} active="/clubs" header={false}>
      <div className="cl-page">
        <ClubMap clubs={onMap} aimags={aimags} />

        <section className="cl-board">
          <div className="cl-head">
            <div>
              <h2>ТОП-100 клуб</h2>
              <p>Очоор эрэмбэлсэн · Сүүлд шинэчлэгдсэн {today}</p>
            </div>
            <nav className="cl-tabs" aria-label="Хугацаа">
              {Object.entries(PERIODS).map(([k, v]) => (
                <Link key={k} href={href({ t: k })} className={period === k ? "on" : ""} scroll={false}>{v}</Link>
              ))}
            </nav>
          </div>
          {rows.length === 0 ? (
            <p className="cl-empty">Одоохондоо бүртгэлтэй клуб алга. Клубууд бүртгүүлж, оч цуглуулахад энд эрэмбэлэгдэнэ.</p>
          ) : (
            <>
              <div className="cl-row cl-cols"><span>№</span><span>Клуб</span><span>Байршил</span><span>Өөрчлөлт</span></div>
              {rows.map((c) => (
                <div key={c.id} className="cl-row">
                  <span className={"cl-rank" + (c.rank <= 3 ? ` r${c.rank}` : "")}>{c.rank}</span>
                  <div className="ss-person">
                    <Link href={`/u/${c.id}`} className="ss-person-av"><Avatar user={c} size={40} /></Link>
                    <div>
                      <Link href={`/u/${c.id}`} className="ss-person-name"><b>{c.first_name}</b></Link>
                      <span className="ss-statrow">
                        <Stat points={period === "all" ? c.points : c.pts} followers={c.followers} followed={following.has(c.id)} />
                        <FollowBtn id={c.id} viewer={user} following={following} />
                      </span>
                    </div>
                  </div>
                  <span className="cl-place">{c.aimag ? <><img className="ic" src="/icons/f_pin.svg" width={16} height={16} alt="" />{c.aimag}</> : <i>—</i>}</span>
                  <span className={"cl-chg" + (c.change > 0 ? " up" : c.change < 0 ? " down" : "")}>
                    {c.change > 0 ? `▲ ${c.change}` : c.change < 0 ? `▼ ${-c.change}` : "–"}
                  </span>
                </div>
              ))}
              <div className="cl-foot">
                <small>Харуулж байна: {(page - 1) * PER + 1}–{(page - 1) * PER + rows.length} / {board.length}</small>
                <span className="ss-grow" />
                {pages > 1 && (
                  <nav className="cl-pages" aria-label="Хуудас">
                    {nums.map((n, i) => (
                      <span key={n} className="cl-pg">
                        {i > 0 && n - nums[i - 1] > 1 && <i>…</i>}
                        <Link href={href({ p: n })} className={n === page ? "on" : ""}>{n}</Link>
                      </span>
                    ))}
                    {page < pages && <Link href={href({ p: page + 1 })} className="cl-next">Дараах {board.length - page * PER} клуб →</Link>}
                  </nav>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </Shell>
  );
}
