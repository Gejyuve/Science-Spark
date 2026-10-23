import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/auth";
import { ensureSchema } from "@/lib/db";
import { canSeeMagazine, listIssues, hasIssueAccess } from "@/lib/magazine";
import { MAGAZINE_PUBLIC } from "@/lib/magazine-shared";
import { fmtMnt } from "@/lib/money";
import Shell from "../components/Shell";
import PageHero from "../components/PageHero";
import { IssueMock } from "./Bits";

export const dynamic = "force-dynamic";
export const metadata = { title: "Сэтгүүл · Science Spark" };

// Сэтгүүл: гарсан дугаарууд (нүүр зургаар), удахгүй гарах дугаар, байршуулах хүсэлт, биет хувь захиалга
export default async function MagazinePage() {
  const user = await getUser();
  if (!canSeeMagazine(user)) notFound();
  await ensureSchema();
  const issues = await listIssues(user);
  const soon = issues.filter((i) => i.status === "soon" || i.status === "draft");
  const out = issues.filter((i) => i.status === "published");

  return (
    <Shell user={user} active="/magazine" header={false}>
      <div className="mz-page">
        <PageHero tone="magazine" title="Сэтгүүл" text="Science Spark сэтгүүлийн дугаарууд. Эхний хуудсуудыг үнэгүй уншаад, бүтэн дугаарыг онлайнаар уншаарай. Биет хувийг гэртээ хүргүүлж авах боломжтой.">
          <Link href="/magazine/request" className="ph-btn solid">Нийтлэл, зар байршуулах</Link>
          {user && <Link href="/magazine/mine" className="ph-btn"><span className="e">📦</span><b>Миний сэтгүүл</b></Link>}
        </PageHero>
        {!MAGAZINE_PUBLIC && <p className="vd-note">Сэтгүүл хэсэг одоогоор зөвхөн супер админд харагдаж байна. <Link href="/admin/magazine">Админ &gt; Сэтгүүл</Link>-ээс нийтэд нээнэ.</p>}

        {soon.length > 0 && (
          <section className="mz-soon">
            {soon.map((i) => (
              <div key={i.id} className="ss-card mz-soon-card">
                <span className="mz-soon-badge">{i.status === "draft" ? "Бэлтгэж байна · зөвхөн танд" : "Удахгүй гарна"}</span>
                <b>№{i.number} · {i.title}</b>
                {i.body && <p>{i.body}</p>}
                <span className="mz-acts">
                  <Link href="/magazine/request" className="mz-btn">Энэ дугаарт нийтлэл, зар байршуулах</Link>
                  {i.pages > 0 && <Link href={`/magazine/${i.id}`} className="mz-btn ghost">Урьдчилж харах</Link>}
                </span>
              </div>
            ))}
          </section>
        )}

        <section className="vd-sec">
          <h2 className="vd-h">Гарсан дугаарууд</h2>
          {out.length === 0 ? (
            <p className="ss-card vd-empty">Одоогоор нийтлэгдсэн дугаар алга. Удахгүй нэмэгдэнэ.</p>
          ) : (
            <div className="mz-grid">
              {out.map((i) => {
                const own = hasIssueAccess(user, i, i.unlocked);
                return (
                  <Link key={i.id} href={`/magazine/${i.id}`} className="mz-tile">
                    <IssueMock issue={i} />
                    <b>№{i.number} · {i.title}</b>
                    <small>{own ? (i.unlocked ? "✓ Таны уншдаг дугаар" : "Бүтнээр нь унших боломжтой") : `${fmtMnt(i.price_mnt)} · ${i.pages} хуудас`}</small>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </Shell>
  );
}
