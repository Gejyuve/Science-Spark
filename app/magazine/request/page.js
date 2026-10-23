import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUser, displayName } from "@/lib/auth";
import { ensureSchema } from "@/lib/db";
import { canSeeMagazine, upcomingIssues } from "@/lib/magazine";
import { BANNER_SIZES } from "@/lib/magazine-shared";
import Shell from "../../components/Shell";
import PageHero from "../../components/PageHero";
import RequestForm from "./RequestForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Нийтлэл, зар байршуулах · Сэтгүүл · Science Spark" };

// Дараагийн дугаарт нийтлэл эсвэл баннер зар байршуулах хүсэлт
export default async function RequestPage({ searchParams }) {
  const sp = await searchParams;
  const user = await getUser();
  if (!user) redirect("/login");
  if (!canSeeMagazine(user)) notFound();
  await ensureSchema();
  const next = await upcomingIssues();
  return (
    <Shell user={user} active="/magazine" header={false}>
      <div className="mz-page">
        <PageHero tone="magazine" title="Нийтлэл, зар байршуулах" text="Дараагийн дугаарт нийтлэлээ хэвлүүлэх эсвэл байгууллагынхаа баннер зарыг байршуулах хүсэлтээ илгээгээрэй. Редакц танд хариу өгч, нөхцөлийг утсаар тохирно.">
          <Link href="/magazine" className="ph-btn">Сэтгүүл рүү буцах</Link>
        </PageHero>
        {sp.error && <p className="adm-flash bad">{sp.error}</p>}
        <RequestForm issues={next} sizes={BANNER_SIZES} name={displayName(user)} email={user.email || ""} kind={sp.kind === "banner" ? "banner" : "article"} />
      </div>
    </Shell>
  );
}
