import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser, displayName, realUser } from "@/lib/auth";
import { sql, ensureSchema } from "@/lib/db";
import { canSeeMagazine, getIssue, hasIssueAccess, freePages } from "@/lib/magazine";
import { walletBalance, fmtMnt } from "@/lib/money";
import Shell from "../../components/Shell";
import Reader from "../Reader";
import { IssueCover } from "../Bits";
import { unlockIssue } from "../actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const [i] = await sql`SELECT number, title FROM magazine_issues WHERE id = ${Number(id) || 0}`.catch(() => []);
  return { title: i ? `Сэтгүүл №${i.number}: ${i.title} · Science Spark` : "Сэтгүүл · Science Spark", robots: { index: false } };
}

const day = (d) => (d ? new Date(d).toLocaleDateString("sv-SE").replaceAll("-", ".") : null);

// Дугаарыг худалдаж авах сонголт (хэтэвчнээс, эсвэл QPay-ээр хэтэвчээ цэнэглээд)
function BuyBox({ issue, user, wallet }) {
  if (!user) return <Link href="/login" className="vg-opt main"><span>Нэвтрэх</span><small>Нэвтэрч ороод {fmtMnt(issue.price_mnt)}-өөр бүтнээр нь уншина</small></Link>;
  if (wallet >= issue.price_mnt)
    return (
      <form action={unlockIssue}>
        <input type="hidden" name="iid" value={issue.id} />
        <button className="vg-opt main"><span>📖 {fmtMnt(issue.price_mnt)} төлж бүтнээр нь унших</span><small>Хэтэвчнээс: танд {fmtMnt(wallet)} байна. Нэг удаа төлөөд үргэлж уншина</small></button>
      </form>
    );
  return (
    <Link href="/wallet?topup=1" className="vg-opt main">
      <span>💳 Хэтэвч цэнэглээд унших</span>
      <small>{fmtMnt(issue.price_mnt)} хэрэгтэй, хэтэвчинд {fmtMnt(wallet)} байна. QPay-ээр цэнэглэнэ</small>
    </Link>
  );
}

export default async function IssuePage({ params, searchParams }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const user = await getUser();
  if (!canSeeMagazine(user)) notFound();
  await ensureSchema();
  const issue = await getIssue(id, user);
  if (!issue) notFound();
  const access = hasIssueAccess(user, issue, issue.unlocked);
  const [[first], wallet] = await Promise.all([
    sql`SELECT width, height FROM magazine_pages WHERE issue_id = ${issue.id} AND page = 1`,
    user ? walletBalance(user.id) : 0,
  ]);
  const ratio = first?.width && first?.height ? first.width / first.height : 210 / 297;
  const free = Math.min(freePages(issue), issue.pages);
  const live = issue.status === "published";
  const buy = live && !access ? <BuyBox issue={issue} user={user} wallet={wallet} /> : null;
  const me = realUser(user);

  return (
    <Shell user={user} active="/magazine" header={false}>
      <div className="mz-page">
        <section className="ss-card mz-head">
          <IssueCover issue={issue} eager />
          <div className="mz-info">
            <Link href="/magazine" className="mz-crumb">Сэтгүүл</Link>
            <h1>№{issue.number} · {issue.title}</h1>
            <p className="mz-meta">{[day(issue.issued_on), issue.pages > 0 && `${issue.pages} хуудас`, live && (issue.price_mnt ? `Онлайн: ${fmtMnt(issue.price_mnt)}` : "Үнэгүй"), issue.print_price > 0 && `Биет хувь: ${fmtMnt(issue.print_price)}`].filter(Boolean).join(" · ")}</p>
            {issue.body && <p className="mz-body">{issue.body}</p>}
            {sp.error && <p className="adm-flash bad">{sp.error}</p>}
            {sp.ok && <p className="adm-flash ok">{sp.ok}</p>}
            {!live && <p className="vd-note">{issue.status === "soon" ? "Энэ дугаар удахгүй гарна. Нийтлэл, зар байршуулах хүсэлтээ одоо илгээгээрэй." : "Энэ дугаарыг бэлтгэж байна. Зөвхөн танд харагдаж байна."}</p>}
            <span className="mz-acts">
              {live && access && issue.pages > 0 && <a href="#read" className="mz-btn">{issue.unlocked && issue.last_page > 1 ? `${issue.last_page}-р хуудаснаас үргэлжлүүлэх` : "Унших"}</a>}
              {live && !access && <a href="#read" className="mz-btn ghost">Эхний {free} хуудсыг үнэгүй унших</a>}
              {live && issue.print_price > 0 && <Link href={`/magazine/${issue.id}/order`} className="mz-btn ghost">🚚 Биет хувь захиалах</Link>}
              {!live && <Link href="/magazine/request" className="mz-btn">Нийтлэл, зар байршуулах</Link>}
            </span>
            {buy && <div className="mz-buy">{buy}</div>}
          </div>
        </section>

        <section id="read" className="mz-read">
          {issue.pages > 0 ? (
            <Reader
              issueId={issue.id}
              pages={issue.pages}
              free={free}
              access={access}
              start={access && issue.unlocked ? issue.last_page : 1}
              saveProgress={!!issue.unlocked}
              ratio={ratio}
              mark={me ? `${displayName(me)} · #${me.id}` : ""}
              locked={
                <>
                  <b className="vg-h">Үргэлжлүүлэн уншина уу</b>
                  <p className="vg-p">Эхний {free} хуудсыг үнэгүй уншлаа. Бүтэн дугаарыг уншиж, шинжлэх ухааны сэтгүүлийг дэмжээрэй.</p>
                  {buy || <p className="vg-p">Энэ дугаар хараахан гараагүй байна.</p>}
                </>
              }
            />
          ) : (
            <p className="ss-card vd-empty">Энэ дугаарын хуудсууд хараахан ороогүй байна.</p>
          )}
          {issue.pages > 0 && me && <p className="mz-fine">Сэтгүүлийг зөвхөн сайт дээр уншина. Хуудас бүрт таны нэр бүдэг усан тэмдгээр харагдана, хуулж тараахыг хориглоно.</p>}
        </section>
      </div>
    </Shell>
  );
}
