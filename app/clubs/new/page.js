import Link from "next/link";
import { redirect } from "next/navigation";
import TopNav from "../../components/TopNav";
import { sql, ensureSchema } from "@/lib/db";
import { getUser, needsName, displayName } from "@/lib/auth";
import { membershipOf } from "@/lib/clubs";
import ClubForm from "./ClubForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Клуб бүртгүүлэх · Science Spark" };

// Figma: Клубээр бүртгүүлэх / Хувь хүний бүртгэл шаардлагатай
export default async function NewClub() {
  const user = await getUser();
  if (user && needsName(user)) redirect("/profile/edit");
  let mine = null, job = "";
  if (user) {
    await ensureSchema();
    mine = await membershipOf(user.id);
    job = (await sql`SELECT job FROM profiles WHERE user_id = ${user.id}`)[0]?.job || "";
  }
  return (
    <div className="wr-page">
      <span className="au-blob a" aria-hidden="true" />
      <span className="au-blob b" aria-hidden="true" />
      <TopNav className="wr-nav" active="/clubs" />
      {!user ? (
        <section className="pf-card cf-gate">
          <img src="/icons/tclub.svg" width={56} height={56} alt="" />
          <b>Хувь хүний бүртгэл шаардлагатай</b>
          <p>Клубыг хувь хүн удирдагч болж бүртгүүлдэг. Эхлээд өөрийн бүртгэлээр нэвтэрч, дараа нь клубээ бүртгүүлээрэй.</p>
          <div><Link href="/login" className="cf-btn">Нэвтрэх</Link><Link href="/register" className="cf-btn ghost">Бүртгүүлэх</Link></div>
        </section>
      ) : mine ? (
        <section className="pf-card cf-gate">
          <img src="/icons/tclub.svg" width={56} height={56} alt="" />
          <b>Та аль хэдийн клубын гишүүн байна</b>
          <p>Та «{mine.name}» клубт байгаа тул шинэ клуб бүртгүүлэх боломжгүй. Нэг хүн нэг л клубт байна.</p>
          <div><Link href={`/club/${mine.club_id}`} className="cf-btn">Клуб руугаа очих</Link></div>
        </section>
      ) : (
        <ClubForm leader={{ id: user.id, name: displayName(user), full: [user.surname, user.first_name].filter(Boolean).join(" "), avatar: user.avatar || null, job, email: user.email }} />
      )}
    </div>
  );
}
