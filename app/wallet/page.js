import Link from "next/link";
import { redirect } from "next/navigation";
import { sql, ensureSchema } from "@/lib/db";
import { getUser, isPremium } from "@/lib/auth";
import { lockedBalance } from "@/lib/bounty";
import { walletBalance, fmtMnt, KIND_LABEL, REQUEST_KIND, REQUEST_STATUS, WITHDRAW_MIN, INCOME_TAX, TIP_FEE } from "@/lib/money";
import { requestWithdrawal } from "../san/actions";
import Shell from "../components/Shell";
import SupportModal from "../components/SupportModal";
import { supportModalProps } from "@/lib/supportModal";

export const dynamic = "force-dynamic";
export const metadata = { title: "Миний хэтэвч · Science Spark" };

const W_STATUS = { pending: "Шалгаж байна", paid: "Шилжүүлсэн", rejected: "Буцаасан" };
const day = (d) => new Date(d).toLocaleDateString("sv-SE");

// Бичээчийн хэтэвч: урамшуулал, шагнал орно. Доод дүнд хүрмэгц банкны данс руу татна.
export default async function Wallet({ searchParams }) {
  const sp = await searchParams;
  const user = await getUser();
  if (!user) redirect("/login");
  await ensureSchema();
  const [balance, history, requests, withdrawals, locked] = await Promise.all([
    walletBalance(user.id),
    sql`SELECT m.kind, m.delta, m.note, m.anonymous, m.created_at, g.initial, g.first_name
        FROM money_ledger m
        LEFT JOIN payment_requests r ON m.kind = 'tip' AND r.id = m.ref_id
        LEFT JOIN users g ON g.id = r.user_id
        WHERE m.account = 'wallet' AND m.user_id = ${user.id} ORDER BY m.id DESC LIMIT 50`,
    sql`SELECT code, kind, amount, months, status, created_at FROM payment_requests WHERE user_id = ${user.id} ORDER BY id DESC LIMIT 20`,
    sql`SELECT amount, status, note, created_at FROM withdrawals WHERE user_id = ${user.id} ORDER BY id DESC LIMIT 10`,
    lockedBalance(user.id),
  ]);
  const pending = withdrawals.find((w) => w.status === "pending");
  const [given] = await sql`SELECT COALESCE(SUM(amount), 0)::bigint AS n FROM payment_requests WHERE user_id = ${user.id} AND status = 'confirmed' AND kind <> 'topup'`;
  const toGo = Math.max(0, WITHDRAW_MIN - balance);
  const feeNote = `Уншигчдын урамшуулал, асуултын шагналаас сайтыг ажиллуулахад ${Math.round(TIP_FEE * 100)}% шимтгэл суутгадаг.`;

  return (
    <Shell user={user} header="nav">
      <div className="ss-card och san">
        {sp.error && <p className="och-note bad">{sp.error}</p>}
        {sp.ok && <p className="och-note info">{sp.ok}</p>}
        <div className="san-hero">
          <div>
            <h1>Миний хэтэвч</h1>
            <p className="och-sub">Уншигчдын урамшуулал, сарын шагнал, асуултын шагнал энд орно. Таны бичсэн бүхэн хэн нэгний сонирхлыг асааж байна.</p>
          </div>
          <div className="san-pool">
            <small>Үлдэгдэл</small>
            <b>{fmtMnt(balance)}</b>
            <small>{toGo ? `Татахад ${fmtMnt(toGo)} дутуу` : "Татах боломжтой"}</small>
            {locked > 0 && <small>Асуултын шагналд түгжсэн: {fmtMnt(locked)}</small>}
          </div>
        </div>
        <span className="och-bar san-bar"><span style={{ width: `${Math.min(100, Math.round((balance / WITHDRAW_MIN) * 100))}%` }} /></span>

        <div className="san-stats">
          <span><b>{isPremium(user) ? day(user.premium_until) : "—"}</b><small>{isPremium(user) ? "хүртэл дэмжигч" : "дэмжигч биш"}</small></span>
          <span><b>{fmtMnt(given.n)}</b><small>таны өгсөн дэмжлэг</small></span>
          <span><b>{history.filter((h) => h.kind === "prize").length}</b><small>шагнал хүртсэн</small></span>
        </div>
        <div className="san-cta">
          <SupportModal kind="topup" label="Хэтэвч цэнэглэх" className="ss-pill" autoOpen={sp.topup === "1"} {...supportModalProps(user)} />
          <SupportModal kind="premium" label={isPremium(user) ? "Дэмжлэгээ сунгах" : "Дэмжигч болох"} className="ss-pill ghost" {...supportModalProps(user)} />
          <Link href="/san" className="ss-pill ghost">Шагналын сан</Link>
        </div>

        <h2 id="withdraw">Мөнгө татах</h2>
        {pending ? (
          <p className="och-note info">{fmtMnt(pending.amount)} татах хүсэлт тань шалгагдаж байна ({day(pending.created_at)}).</p>
        ) : balance < WITHDRAW_MIN ? (
          <p className="och-hint">Хэтэвч {fmtMnt(WITHDRAW_MIN)}-д хүрмэгц банкны данс руугаа татах боломжтой. {feeNote}</p>
        ) : (
          <form action={requestWithdrawal} className="san-form">
            <label className="san-field">Дүн (₮)
              <input name="amount" inputMode="numeric" defaultValue={balance} required />
            </label>
            <label className="san-field">Банк, дансны дугаар, эзэмшигчийн нэр
              <input name="bank" required maxLength={200} placeholder="Хаан банк 5000123456 Б.Болд" />
            </label>
            <p className="och-hint">{feeNote} Хувь хүний орлогын албан татвар {Math.round(INCOME_TAX * 100)}%-ийг суутгаж, үлдсэнийг шилжүүлнэ.</p>
            <button className="ss-pill">Татах хүсэлт илгээх</button>
          </form>
        )}
        {withdrawals.length > 0 && (
          <div className="och-rules">
            {withdrawals.map((w, i) => (
              <div key={i} className="och-rule">
                <span><b>{W_STATUS[w.status]}</b><small>{day(w.created_at)}{w.note ? ` · ${w.note}` : ""}</small></span>
                <em>{fmtMnt(w.amount)}</em>
              </div>
            ))}
          </div>
        )}

        <h2>Хэтэвчийн гүйлгээ</h2>
        <div className="och-rules">
          {history.length === 0 && <p className="och-hint">Одоохондоо гүйлгээ алга. Нийтлэл, мэдээ бичиж уншигчдаас дэмжлэг аваарай.</p>}
          {history.map((h, i) => (
            <div key={i} className="och-rule">
              <span>
                <b>{KIND_LABEL[h.kind] || h.kind}{h.kind === "tip" ? ` · ${h.anonymous || !h.first_name ? "Нэрээ нууцалсан уншигч" : `${h.initial}.${h.first_name}`}` : ""}</b>
                <small>{day(h.created_at)}{h.note ? ` · ${h.note}` : ""}</small>
              </span>
              <em className={h.delta < 0 ? "neg" : "pos"}>{h.delta > 0 ? "+" : "−"}{fmtMnt(Math.abs(h.delta))}</em>
            </div>
          ))}
        </div>

        <h2>Миний дэмжлэг, цэнэглэлт</h2>
        <div className="och-rules">
          {requests.length === 0 && <p className="och-hint">Та одоохондоо дэмжлэг өгөөгүй байна.</p>}
          {requests.map((r) => (
            <Link key={r.code} href={`/san/pay/${r.code}`} className="och-rule">
              <span><b>{REQUEST_KIND[r.kind]}{r.months ? ` · ${r.months} сар` : ""}</b><small>{r.code} · {day(r.created_at)} · {REQUEST_STATUS[r.status]}</small></span>
              <em>{fmtMnt(r.amount)}</em>
            </Link>
          ))}
        </div>
      </div>
    </Shell>
  );
}
