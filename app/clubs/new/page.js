import Link from "next/link";
import { redirect } from "next/navigation";
import TopNav from "../../components/TopNav";
import { sql, ensureSchema } from "@/lib/db";
import { getUser, needsName } from "@/lib/auth";
import { membershipOf } from "@/lib/clubs";
import EntityForm from "../../components/EntityForm";
import EntityGate, { leaderInfo } from "../../components/EntityGate";

export const dynamic = "force-dynamic";
export const metadata = { title: "Клуб бүртгүүлэх · Science Spark" };

// Figma: Клубээр бүртгүүлэх / Хувь хүний бүртгэл шаардлагатай
export default async function NewClub() {
  const user = await getUser();
  if (user && needsName(user)) redirect("/profile/edit");
  let mine = null;
  if (user) { await ensureSchema(); mine = await membershipOf(user.id); }
  return (
    <div className="wr-page">
      <span className="au-blob a" aria-hidden="true" />
      <span className="au-blob b" aria-hidden="true" />
      <TopNav className="wr-nav" active="/clubs" />
      {!user ? (
        <EntityGate title="Хувь хүний бүртгэл шаардлагатай" text="Клубыг хувь хүн удирдагч болж бүртгүүлдэг. Эхлээд өөрийн бүртгэлээр нэвтэрч, дараа нь клубээ бүртгүүлээрэй." />
      ) : mine ? (
        <EntityGate title="Та аль хэдийн клубийн гишүүн байна" text={`Та «${mine.name}» клубт байгаа тул шинэ клуб бүртгүүлэх боломжгүй. Нэг хүн нэг л клубт байна.`}
          actions={<Link href={`/club/${mine.club_id}`} className="cf-btn">Клуб руугаа очих</Link>} />
      ) : (
        <EntityForm kind="club" leader={await leaderInfo(sql, user)} />
      )}
    </div>
  );
}
