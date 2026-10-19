import Link from "next/link";
import { getUser } from "@/lib/auth";
import { ensureSchema } from "@/lib/db";
import { clubBoard, PERIODS, clubFollowSet } from "@/lib/clubs";
import Shell from "../components/Shell";
import ClubMap from "../components/ClubMap";
import { ClubPerson, ClubAv } from "../components/ClubBits";
import TaskCard, { ReportCard } from "../components/TaskCard";
import Composer from "../components/Composer";
import { Avatar } from "../components/Bits";
import { listTasks, taskCount, leaderClub, listReports, reportCount } from "@/lib/tasks";

export const dynamic = "force-dynamic";
export const metadata = { title: "Клуб · Science Spark" };

const PER = 10;

// Figma 75:2 «Клуб»: газрын зураг ба ТОП-100 клуб
export default async function Clubs({ searchParams }) {
  const sp = await searchParams;
  const period = PERIODS[sp.t] ? sp.t : "all";
  let user = null, board = [], tasks = [], tasksN = 0, myClub = null, reports = [], reportsN = 0;
  try {
    user = await getUser();
    await ensureSchema();
    [board, tasks, tasksN, myClub, reports, reportsN] = await Promise.all([clubBoard(period), listTasks({ limit: 4 }), taskCount(), leaderClub(user?.id), listReports({ limit: 4 }), reportCount()]);
  } catch (e) {}
  const follows = await clubFollowSet(user);

  // Газрын зураг: координаттай клубүүд
  const onMap = board.filter((c) => c.lat != null && c.lng != null)
    .map(({ id, name, logo, city, about, lat, lng, points, members, rank }) => ({ id, name, logo, city, about, lat, lng, points, members, rank }));
  const aimags = new Set(onMap.map((c) => c.city).filter(Boolean)).size;

  // Зөвхөн эхний 10 клуб
  const rows = board.slice(0, PER);
  const href = (o) => (o.t && o.t !== "all" ? `/clubs?t=${o.t}` : "/clubs");
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ulaanbaatar" }).replaceAll("-", ".");

  return (
    <Shell user={user} active="/clubs" header={false}>
      <div className="cl-page">
        {/* Клубийн удирдагч: Даалгавар · Тайлан · Хуваалцъя */}
        {myClub && (
          <div className="ss-header static cl-composer">
            <Composer loggedIn me={<Avatar user={user} size={32} />} club={{ name: myClub.name }} clubAv={<ClubAv c={myClub} size={32} />} initialAs="club" />
          </div>
        )}

        <ClubMap clubs={onMap} aimags={aimags} />

        <section className="cl-board">
          <div className="cl-head">
            <div>
              <h2>ТОП-10 клуб</h2>
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
            <div className="cl-empty"><p>Одоохондоо бүртгэлтэй клуб алга. Клубүүд бүртгүүлж, оч цуглуулахад энд эрэмбэлэгдэнэ.</p><Link href="/clubs/new" className="cm-join">+ Клуб бүртгүүлэх</Link></div>
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
            </>
          )}
        </section>

        {/* Хамгийн доор: клубүүдын даалгавар, тайлан */}
        <section className="cl-tasks">
          <div className="cl-head">
            <div>
              <h2>Даалгавар</h2>
              <p>Клубүүдын хийж үзсэн туршилт, эвент, воркшопын санаа · {tasksN} даалгавар</p>
            </div>
            <span className="ss-grow" />
            <Link href="/tasks" className="cl-new">Бүгдийг үзэх →</Link>
          </div>
          {tasks.length ? (
            <div className="tk-grid four">{tasks.map((t) => <TaskCard key={t.id} t={t} compact />)}</div>
          ) : (
            <p className="muted">Одоохондоо даалгавар алга. Клубийн удирдагч анхны даалгаврыг нэмээрэй.</p>
          )}
        </section>

        {reports.length > 0 && (
          <section className="cl-tasks">
            <div className="cl-head">
              <div>
                <h2>Тайлан</h2>
                <p>Клубүүд даалгаврыг хэрхэн биелүүлсэн бэ · {reportsN} тайлан</p>
              </div>
              <span className="ss-grow" />
              <Link href="/reports" className="cl-new">Бүгдийг үзэх →</Link>
            </div>
            <div className="tk-grid four">{reports.map((r) => <ReportCard key={r.id} r={r} compact />)}</div>
          </section>
        )}
      </div>
    </Shell>
  );
}
