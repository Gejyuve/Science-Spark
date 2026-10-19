import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { ensureSchema } from "@/lib/db";
import { leaderClub, taskOptions, AUTHOR_SHARE } from "@/lib/tasks";
import { createReport } from "../../tasks/actions";
import ReportForm from "../../components/ReportForm";
import TopNav from "../../components/TopNav";
import { ClubAv } from "../../components/ClubBits";

export const dynamic = "force-dynamic";
export const metadata = { title: "Тайлан нэмэх · Science Spark" };

export default async function NewReport({ searchParams }) {
  const user = await getUser();
  if (!user) redirect("/login");
  const { error, task } = await searchParams;
  await ensureSchema();
  const club = await leaderClub(user.id);
  const tasks = club ? await taskOptions(club.id) : [];
  return (
    <div className="wr-page">
      <span className="au-blob a" aria-hidden="true" />
      <span className="au-blob b" aria-hidden="true" />
      <TopNav className="wr-nav" />
      {club ? (
        <>
          <ReportForm action={createReport} club={club} avatar={<ClubAv c={club} size={28} />} tasks={tasks}
            initial={Number(task) || 0} error={error} share={AUTHOR_SHARE} />
          <div className="wr-mobile">
            <img src="/icons/logo.svg" width={56} height={56} alt="" />
            <b>Тайлан бичих самбар зөвхөн компьютерээс ажиллана</b>
            <p>Зураг, алхам, ажиглалтаа оруулахад том дэлгэц хэрэгтэй. Компьютерээсээ нэвтэрч бичээрэй.</p>
            <Link href="/reports" className="wr-go">Тайлангууд руу</Link>
          </div>
        </>
      ) : (
        <section className="wr-lock">
          <img src="/icons/logo.svg" width={64} height={64} alt="" />
          <h1>Тайланг клубийн удирдагч нэмнэ</h1>
          <p>Клуб тань даалгаврыг биелүүлсний дараа удирдагч нь клубийн нэрээр тайлан бичнэ. Редакц баталмагц клуб даалгаврын очийг авна.</p>
          <div className="wr-lock-acts">
            <Link href="/tasks" className="wr-go">Даалгаврууд үзэх</Link>
            <Link href="/clubs/new" className="wr-lock-link">Клуб бүртгүүлэх</Link>
          </div>
        </section>
      )}
    </div>
  );
}
