import Link from "next/link";
import { getUser } from "@/lib/auth";
import { ensureSchema } from "@/lib/db";
import { listReports, leaderClub, taskCount, reportCount } from "@/lib/tasks";
import Shell from "../components/Shell";
import { ReportCard, ClubTabs } from "../components/TaskCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Тайлан · Science Spark" };

// Клубүүдын биелүүлсэн даалгаврын тайлангууд
export default async function Reports() {
  let user = null, reports = [], club = null, counts = {};
  try {
    user = await getUser();
    await ensureSchema();
    let nt, nr;
    [reports, club, nt, nr] = await Promise.all([listReports({ limit: 60 }), leaderClub(user?.id), taskCount(), reportCount()]);
    counts = { tasks: nt, reports: nr };
  } catch (e) {}
  return (
    <Shell user={user} active="/clubs" header={false}>
      <div className="tk-page">
        <ClubTabs on="reports" counts={counts} />
        <section className="tk-hero">
          <div>
            <h1>Тайлан</h1>
            <p>Клубүүд даалгаврыг хэрхэн биелүүлж, юу олж мэдсэнээ хуваалцдаг. Тайлан бүр редакцаар батлагдаж нийтлэгдэнэ.</p>
          </div>
          <span className="ss-grow" />
          {club && <Link href="/reports/new" className="cl-new">+ Тайлан нэмэх</Link>}
        </section>
        {reports.length ? (
          <div className="tk-grid">{reports.map((r) => <ReportCard key={r.id} r={r} />)}</div>
        ) : (
          <div className="cl-empty tk-empty">
            <p>Одоохондоо тайлан алга. Даалгавраас нэгийг сонгож клубтэйгээ хийгээд, анхны тайланг бичээрэй!</p>
            <Link href={club ? "/reports/new" : "/tasks"} className="cm-join">{club ? "+ Тайлан нэмэх" : "Даалгаврууд үзэх"}</Link>
          </div>
        )}
      </div>
    </Shell>
  );
}
