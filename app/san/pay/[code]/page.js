import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { sql, ensureSchema } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { bankInfo, fmtMnt, REQUEST_KIND, REQUEST_STATUS } from "@/lib/money";
import { cancelSupport } from "../../actions";
import Shell from "../../../components/Shell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Шилжүүлэг · Science Spark" };

// Төлбөрийн систем холбогдох хүртэл: код бичиж данс руу шилжүүлнэ, редакц баталгаажуулна
export default async function Pay({ params }) {
  const { code } = await params;
  const user = await getUser();
  if (!user) redirect("/login");
  await ensureSchema();
  const [r] = await sql`SELECT r.*, w.initial AS w_initial, w.first_name AS w_first_name
                        FROM payment_requests r LEFT JOIN users w ON w.id = r.writer_id
                        WHERE r.code = ${String(code)} AND r.user_id = ${user.id}`;
  if (!r) notFound();
  const bank = bankInfo();
  const what = r.kind === "premium" ? `Премиум · ${r.months} сар` : r.kind === "tip" ? `${r.w_initial}.${r.w_first_name}-д хандив` : REQUEST_KIND[r.kind];

  return (
    <Shell user={user} header="nav">
      <div className="ss-card och san">
        <Link href="/wallet" className="san-back">← Миний хэтэвч</Link>
        <h1>{r.status === "confirmed" ? "Баярлалаа! 💚" : "Шилжүүлгээ хийнэ үү"}</h1>
        <p className="och-sub">
          {r.status === "confirmed"
            ? "Таны дэмжлэг баталгаажлаа. Та Монголын шинжлэх ухааны бичээчид, ирээдүйн залуу судлаачдыг дэмжлээ."
            : "Доорх кодыг гүйлгээний утганд заавал бичээрэй. Шилжүүлэг ирмэгц редакц шалгаж баталгаажуулна."}
        </p>
        <div className="san-pay">
          <div><small>Төрөл</small><b>{what}</b></div>
          <div><small>Дүн</small><b>{fmtMnt(r.amount)}</b></div>
          <div className="san-code"><small>Гүйлгээний утга</small><b>{r.code}</b></div>
          <div><small>Төлөв</small><b>{REQUEST_STATUS[r.status] || r.status}</b></div>
        </div>
        {r.status === "pending" && (
          <>
            {bank
              ? <p className="och-note info"><b>Шилжүүлэх данс:</b> {bank}</p>
              : <p className="och-note warn">Дансны мэдээлэл удахгүй нэмэгдэнэ. Одоохондоо редакцтай холбогдоно уу.</p>}
            <form action={cancelSupport} className="san-cta">
              <input type="hidden" name="code" value={r.code} />
              <Link href="/wallet" className="ss-pill">Шилжүүлсэн</Link>
              <button className="ss-pill ghost">Цуцлах</button>
            </form>
          </>
        )}
        {r.status !== "pending" && <div className="san-cta"><Link href="/san" className="ss-pill">Шагналын сан руу</Link></div>}
      </div>
    </Shell>
  );
}
