import Link from "next/link";
import { getUser } from "@/lib/auth";
import { ensureSchema } from "@/lib/db";
import { clubBoard, PERIODS, clubFollowSet } from "@/lib/clubs";
import Shell from "../components/Shell";
import ClubMap from "../components/ClubMap";
import { ClubPerson, ClubAv } from "../components/ClubBits";
import TaskCard from "../components/TaskCard";
import { Avatar } from "../components/Bits";
import { listTasks, taskCount, leaderClub } from "@/lib/tasks";

export const dynamic = "force-dynamic";
export const metadata = { title: "Клуб · Science Spark" };

const PER = 10;

// Figma 75:2 «Клуб»: газрын зураг ба ТОП-100 клуб
export default async function Clubs({ searchParams }) {
  const sp = await searchParams;
  const period = PERIODS[sp.t] ? sp.t : "all";
  let user = null, board = [], tasks = [], tasksN = 0, myClub = null;
  try {
    user = await getUser();
    await ensureSchema();
    [board, tasks, tasksN, myClub] = await Promise.all([clubBoard(period), listTasks({ limit: 4 }), taskCount(), leaderClub(user?.id)]);
  } catch (e) {}
  const follows = await clubFollowSet(user);

  // Газрын зураг: координаттай клубууд
  const onMap = board.filter((c) => c.lat != null && c.lng != null)
    .map(({ id, name, logo, city, about, lat, lng, points, members, rank }) => ({ id, name, logo, city, about, lat, lng, points, members, rank }));
  const aimags = new Set(onMap.map((c) => c.city).filter(Boolean)).size;

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
        {/* Клубын нүүр: бичих, асуухын оронд даалгавар нэмэх */}
        <Link href={user ? "/tasks/new" : "/login"} className="cl-compose">
          {myClub ? <ClubAv c={myClub} size={36} /> : user ? <Avatar user={user} size={36} /> : <img src="/icons/person.svg" width={36} height={36} alt="" />}
          <span>{myClub ? `${myClub.name} клубын туршилт, эвент, воркшопоо бусад клубтэй хуваалцаарай` : "Клубуудын хийж үзсэн туршилт, эвент, воркшопын санааг хуваалцах орон зай"}</span>
          <b className="cm-join">+ Даалгавар нэмэх</b>
        </Link>

        <section className="cl-tasks">
          <div className="cl-head">
            <div>
              <h2>Даалгавар</h2>
              <p>Клубуудын хуваалцсан санаа · {tasksN} даалгавар</p>
            </div>
            <span className="ss-grow" />
            <Link href="/tasks" className="cl-new">Бүгдийг үзэх →</Link>
          </div>
          {tasks.length ? (
            <div className="tk-grid four">{tasks.map((t) => <TaskCard key={t.id} t={t} compact />)}</div>
          ) : (
            <p className="muted">Одоохондоо даалгавар алга. Клубын удирдагч анхны даалгаврыг нэмээрэй.</p>
          )}
        </section>

        <ClubMap clubs={onMap} aimags={aimags} />

        <section className="cl-board">
          <div className="cl-head">
            <div>
              <h2>ТОП-100 клуб</h2>
              <p>Очоор эрэмбэлсэн · Сүүлд шинэчлэгдсэн {today}</p>
            </div>
            <span className="ss-grow" />
            <Link href="/clubs/new" className="cl-new">+ Клуб бүртгүүлэх</Link>
            <nav className="cl-tabs" aria-label="Хугацаа">
              {Object.entries(PERIODS).map(([k, v]) => (
                <Link key={k} href={href({ t: k })} className={period === k ? "on" : ""} scroll={false}>{v}</Link>
              ))}
            </nav>
          </div>
          {rows.length === 0 ? (
            <div className="cl-empty"><p>Одоохондоо бүртгэлтэй клуб алга. Клубууд бүртгүүлж, оч цуглуулахад энд эрэмбэлэгдэнэ.</p><Link href="/clubs/new" className="cm-join">+ Клуб бүртгүүлэх</Link></div>
          ) : (
            <>
              <div className="cl-row cl-cols"><span>№</span><span>Клуб</span><span>Байршил</span><span>Өөрчлөлт</span></div>
              {rows.map((c) => (
                <div key={c.id} className="cl-row">
                  <span className={"cl-rank" + (c.rank <= 3 ? ` r${c.rank}` : "")}>{c.rank}</span>
                  <ClubPerson c={c} viewer={user} follows={follows} points={period === "all" ? c.points : c.pts} />
                  <span className="cl-place">{c.city ? <><img className="ic" src="/icons/f_pin.svg" width={16} height={16} alt="" />{c.city}</> : <i>—</i>}</span>
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
