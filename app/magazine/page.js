import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/auth";
import { ensureSchema } from "@/lib/db";
import { canSeeMagazine, listIssues, hasIssueAccess } from "@/lib/magazine";
import { MAGAZINE_PUBLIC } from "@/lib/magazine-shared";
import Shell from "../components/Shell";
import Showcase from "./Showcase";

export const dynamic = "force-dynamic";
export const metadata = { title: "Сэтгүүл · Science Spark" };

// Сэтгүүл: толгойгүй, дугаарууд агаарт хөвж буй 3D үзэсгэлэн (чирж эргүүлнэ). Хуучнаас шинэ рүү зүүнээс баруун тийш.
export default async function MagazinePage() {
  const user = await getUser();
  if (!canSeeMagazine(user)) notFound();
  await ensureSchema();
  const issues = (await listIssues(user))
    .map((i) => ({
      id: i.id, number: i.number, title: i.title, status: i.status, pages: i.pages, price_mnt: i.price_mnt,
      print_price: i.print_price, preview_pages: i.preview_pages, unlocked: !!i.unlocked, own: hasIssueAccess(user, i, i.unlocked),
    }))
    .reverse();

  return (
    <Shell user={user} active="/magazine" header={false}>
      <div className="mz-page">
        {!MAGAZINE_PUBLIC && <p className="vd-note">Сэтгүүл хэсэг одоогоор зөвхөн супер админд харагдаж байна. <Link href="/admin/magazine">Админ &gt; Сэтгүүл</Link>-ээс нийтэд нээнэ.</p>}
        {issues.length === 0
          ? <p className="ss-card vd-empty">Одоогоор дугаар алга. Удахгүй нэмэгдэнэ.</p>
          : <Showcase issues={issues} loggedIn={!!user} />}
      </div>
    </Shell>
  );
}
