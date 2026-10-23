import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUser, displayName } from "@/lib/auth";
import { sql, ensureSchema } from "@/lib/db";
import { canSeeMagazine, getIssue } from "@/lib/magazine";
import { MAX_ORDER_QTY, UB_DISTRICTS } from "@/lib/magazine-shared";
import { MN_CITIES } from "@/lib/profile";
import { walletBalance, fmtMnt } from "@/lib/money";
import Shell from "../../../components/Shell";
import { IssueCover } from "../../Bits";
import OrderForm from "./OrderForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Биет хувь захиалах · Сэтгүүл · Science Spark" };

// Биет хувь захиалах: тоо ширхэг, хүлээн авагч, хаяг. Хэтэвчнээс төлөөд хүргэлтэд шууд бүртгэгдэнэ.
export default async function OrderPage({ params, searchParams }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const user = await getUser();
  if (!user) redirect("/login");
  if (!canSeeMagazine(user)) notFound();
  await ensureSchema();
  const issue = await getIssue(id, user);
  if (!issue || issue.status !== "published" || !issue.print_price) notFound();
  // Өмнөх захиалгын хаягийг дахин бөглөнө
  const [[prev], wallet] = await Promise.all([
    sql`SELECT name, phone, city, district, address FROM magazine_orders WHERE user_id = ${user.id} ORDER BY id DESC LIMIT 1`,
    walletBalance(user.id),
  ]);
  return (
    <Shell user={user} active="/magazine" header={false}>
      <div className="mz-page">
        <section className="ss-card mz-head small">
          <IssueCover issue={issue} />
          <div className="mz-info">
            <Link href={`/magazine/${issue.id}`} className="mz-crumb">№{issue.number} дугаар</Link>
            <h1>Биет хувь захиалах</h1>
            <p className="mz-meta">{issue.title} · нэг хувь {fmtMnt(issue.print_price)}{issue.delivery_fee > 0 ? ` · хүргэлт ${fmtMnt(issue.delivery_fee)}` : " · хүргэлт үнэгүй"}</p>
          </div>
        </section>
        {sp.error && <p className="adm-flash bad">{sp.error}</p>}
        <OrderForm
          issueId={issue.id}
          price={issue.print_price}
          fee={issue.delivery_fee}
          wallet={wallet}
          maxQty={MAX_ORDER_QTY}
          cities={MN_CITIES}
          districts={UB_DISTRICTS}
          init={prev || { name: displayName(user), city: "Улаанбаатар" }}
        />
      </div>
    </Shell>
  );
}
