import Link from "next/link";
import { getUser } from "@/lib/auth";
import { ensureSchema } from "@/lib/db";
import { listTasks, taskTypes, leaderClub, taskCount, reportCount } from "@/lib/tasks";
import Shell from "../components/Shell";
import PageHero from "../components/PageHero";
import TaskCard, { ClubTabs } from "../components/TaskCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Даалгавар · Science Spark" };

// Клубүүдийн хуваалцсан туршилт, эвент, воркшопын санаанууд
export default async function Tasks({ searchParams }) {
  const sp = await searchParams;
  const type = typeof sp.t === "string" && sp.t.length <= 40 ? sp.t : null;
  let user = null, tasks = [], types = [], club = null, counts = {};
  try {
    user = await getUser();
    await ensureSchema();
    let nt, nr;
    [tasks, types, club, nt, nr] = await Promise.all([listTasks({ type, limit: 60 }), taskTypes(), leaderClub(user?.id), taskCount(), reportCount()]);
    counts = { tasks: nt, reports: nr };
  } catch (e) {}
  const href = (t) => (t ? `/tasks?t=${encodeURIComponent(t)}` : "/tasks");
  return (
    <Shell user={user} active="/clubs" header={false}>
      <div className="tk-page">
        <ClubTabs on="tasks" counts={counts} />
        <PageHero tone="task" title="Даалгавар" text="Клубүүдийн хуваалцсан туршилт, эвент, воркшопын санаа. Клубтэйгээ хийж үзээд, өөрсдийн санаагаа нэмээрэй.">
          <Link href={user ? "/tasks/new" : "/login"} className="ph-btn solid">+ Даалгавар нэмэх</Link>
        </PageHero>
        <nav className="tk-filter" aria-label="Төрөл">
          <Link href={href(null)} className={!type ? "on" : ""} scroll={false}>Бүгд</Link>
          {types.map((t) => <Link key={t} href={href(t)} className={type === t ? "on" : ""} scroll={false}>{t}</Link>)}
        </nav>
        {tasks.length ? (
          <div className="tk-grid">{tasks.map((t) => <TaskCard key={t.id} t={t} />)}</div>
        ) : (
          <div className="cl-empty tk-empty">
            <p>{type ? `«${type}» төрлийн даалгавар одоохондоо алга.` : "Одоохондоо даалгавар алга. Анхны даалгаврыг таны клуб нэмээрэй!"}</p>
            {club && <Link href="/tasks/new" className="cm-join">+ Даалгавар нэмэх</Link>}
          </div>
        )}
      </div>
    </Shell>
  );
}
