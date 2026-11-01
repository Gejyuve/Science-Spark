import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { ensureSchema } from "@/lib/db";
import { memberClub, taskTypes } from "@/lib/tasks";
import { createTask } from "../actions";
import TaskForm from "../../components/TaskForm";
import TopNav from "../../components/TopNav";
import { ClubAv } from "../../components/ClubBits";

export const dynamic = "force-dynamic";
export const metadata = { title: "Даалгавар нэмэх · Science Spark" };

export default async function NewTask({ searchParams }) {
  const user = await getUser();
  if (!user) redirect("/login");
  const { error } = await searchParams;
  await ensureSchema();
  const club = await memberClub(user.id);
  return (
    <div className="wr-page">
      <span className="au-blob a" aria-hidden="true" />
      <span className="au-blob b" aria-hidden="true" />
      <TopNav className="wr-nav" />
      {club ? (
        <>
          <TaskForm action={createTask} club={club} avatar={<ClubAv c={club} size={28} />} types={await taskTypes()} error={error} />
          <div className="wr-mobile">
            <img src="/icons/logo.svg" width={56} height={56} alt="" />
            <b>Даалгавар нэмэх самбар зөвхөн компьютерээс ажиллана</b>
            <p>Алхам, зураг, эх сурвалж оруулахад том дэлгэц хэрэгтэй. Компьютерээсээ нэвтэрч нэмээрэй.</p>
            <Link href="/tasks" className="wr-go">Даалгаврууд руу</Link>
          </div>
        </>
      ) : (
        <section className="wr-lock">
          <img src="/icons/logo.svg" width={64} height={64} alt="" />
          <h1>Даалгаврыг клубийн гишүүд нэмнэ</h1>
          <p>Даалгавар бол клубүүдийн бие биетэйгээ хуваалцдаг туршилт, эвент, воркшопын санаа. Клубийн гишүүн бүр клубийнхээ нэрээр нэмж, удирдагч зөвшөөрсний дараа редакц руу илгээгдэнэ. Бусад клуб ашиглах тусам клубт оч нэмэгдэнэ.</p>
          <div className="wr-lock-acts">
            <Link href="/tasks" className="wr-go">Даалгаврууд үзэх</Link>
            <Link href="/clubs" className="wr-lock-link">Клубт нэгдэх</Link>
          </div>
        </section>
      )}
    </div>
  );
}
