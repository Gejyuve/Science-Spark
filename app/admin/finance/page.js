import Link from "next/link";
import { sql } from "@/lib/db";
import { requireSection, ago } from "@/lib/admin";
import { poolBalance, periodSummary, fmtMnt, KIND_LABEL, EXPENSE_KINDS, REQUEST_KIND, PAYMENT_FEE, INCOME_TAX, bankInfo } from "@/lib/money";
import { currentPeriod, prevPeriod, periodLabel, monthBoard, splitPrizes } from "@/lib/spark";
import { confirmPayment, cancelPayment, addExpense, payWithdrawal, rejectWithdrawal, closeMonth } from "./actions";
import Head, { Stat, Flash, Tabs, Chip, who } from "../_c/Head";

const TABS = [["", "Төлбөр"], ["withdraw", "Татах хүсэлт"], ["expense", "Зардал"], ["close", "Сар хаах"]];

export default async function Finance({ searchParams }) {
  const user = await requireSection("finance");
  const sp = await searchParams;
  const tab = TABS.some(([k]) => k === sp.t) ? sp.t : "";
  const period = currentPeriod();
  const [pool, [cnt], summary] = await Promise.all([
    poolBalance(),
    sql`SELECT (SELECT COUNT(*) FROM payment_requests WHERE status = 'pending')::int AS pay,
               (SELECT COUNT(*) FROM withdrawals WHERE status = 'pending')::int AS wd,
               (SELECT COUNT(*) FROM users WHERE premium_until > now())::int AS prem,
               (SELECT COALESCE(SUM(delta), 0) FROM money_ledger WHERE account = 'wallet')::bigint AS wallets`,
    periodSummary(6),
  ]);
  const cur = summary.find((r) => r.period === period);
  const tabs = TABS.map(([k, l]) => [k, l, k === "" ? cnt.pay : k === "withdraw" ? cnt.wd : null]);

  let body = null;
  if (tab === "") {
    const rows = await sql`SELECT r.*, u.initial, u.first_name, u.email, w.initial AS w_initial, w.first_name AS w_first_name
                           FROM payment_requests r JOIN users u ON u.id = r.user_id LEFT JOIN users w ON w.id = r.writer_id
                           WHERE r.status = 'pending' ORDER BY r.id ASC LIMIT 100`;
    body = (
      <section className="adm-card flush">
        <div className="adm-card-head pad"><b>Шилжүүлэг хүлээж буй</b></div>
        <p className="adm-muted small pad">Банкны хуулгаас гүйлгээний утга дахь кодыг олж, ирсэн дүнг шалгаад баталгаажуулна. Шимтгэлийг бодит дүнгээр засна.{!bankInfo() && " ⚠ Vercel дээр PAY_BANK_INFO тохируулаагүй байна."}</p>
        {rows.length === 0 ? <p className="adm-empty">Хүлээгдэж буй төлбөр алга.</p> : (
          <table className="adm-table">
            <thead><tr><th>Код</th><th>Хэрэглэгч</th><th>Төрөл</th><th>Дүн</th><th>Хэзээ</th><th className="adm-right">Үйлдэл</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="adm-strong adm-mono">{r.code}</td>
                  <td><Link href={`/u/${r.user_id}`}>{who(r)}</Link></td>
                  <td>{REQUEST_KIND[r.kind]}{r.months ? ` · ${r.months} сар` : ""}{r.kind === "tip" && ` → ${r.w_initial}.${r.w_first_name}`}{r.anonymous && <Chip tone="gray">нууц</Chip>}</td>
                  <td className="adm-mono">{fmtMnt(r.amount)}</td>
                  <td>{ago(r.created_at)}</td>
                  <td className="adm-right">
                    <div className="adm-acts">
                      <form action={confirmPayment} className="adm-inline">
                        <input type="hidden" name="id" value={r.id} />
                        <input name="fee" type="number" min={0} className="adm-num" defaultValue={Math.round(r.amount * PAYMENT_FEE)} title="Шимтгэл ₮" />
                        <button className="adm-btn dark">Ирсэн</button>
                      </form>
                      <form action={cancelPayment}><input type="hidden" name="id" value={r.id} /><button className="adm-btn danger">Цуцлах</button></form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    );
  } else if (tab === "withdraw") {
    const rows = await sql`SELECT w.*, u.initial, u.first_name, u.email,
                             (SELECT COALESCE(SUM(delta), 0) FROM money_ledger WHERE account = 'wallet' AND user_id = w.user_id)::bigint AS balance
                           FROM withdrawals w JOIN users u ON u.id = w.user_id
                           ORDER BY (w.status = 'pending') DESC, w.id DESC LIMIT 60`;
    body = (
      <section className="adm-card flush">
        <div className="adm-card-head pad"><b>Хэтэвчээс татах хүсэлт</b></div>
        <p className="adm-muted small pad">Банкаар шилжүүлсний дараа «Шилжүүлсэн» дарна. Татвар {Math.round(INCOME_TAX * 100)}% автоматаар суутгагдаж бүртгэгдэнэ.</p>
        {rows.length === 0 ? <p className="adm-empty">Хүсэлт алга.</p> : (
          <table className="adm-table">
            <thead><tr><th>Бичээч</th><th>Дүн</th><th>Шилжүүлэх</th><th>Данс</th><th>Үлдэгдэл</th><th>Хэзээ</th><th className="adm-right">Үйлдэл</th></tr></thead>
            <tbody>
              {rows.map((w) => (
                <tr key={w.id} className={w.status !== "pending" ? "adm-dim" : ""}>
                  <td><Link href={`/u/${w.user_id}`}>{who(w)}</Link></td>
                  <td className="adm-mono">{fmtMnt(w.amount)}</td>
                  <td className="adm-mono adm-strong">{fmtMnt(w.amount - Math.round(w.amount * INCOME_TAX))}</td>
                  <td className="adm-wrap">{w.bank}{w.note && <span className="adm-note">{w.note}</span>}</td>
                  <td className={Number(w.balance) < w.amount ? "adm-neg" : "adm-mono"}>{fmtMnt(w.balance)}</td>
                  <td>{ago(w.created_at)}</td>
                  <td className="adm-right">
                    {w.status === "pending" ? (
                      <div className="adm-acts">
                        <form action={payWithdrawal}><input type="hidden" name="id" value={w.id} /><button className="adm-btn dark">Шилжүүлсэн</button></form>
                        <details className="adm-pop">
                          <summary className="adm-btn danger">Буцаах</summary>
                          <form action={rejectWithdrawal}><input type="hidden" name="id" value={w.id} /><input name="note" required placeholder="Шалтгаан" /><button className="adm-btn">Илгээх</button></form>
                        </details>
                      </div>
                    ) : <Chip tone={w.status === "paid" ? "ok" : "bad"}>{w.status === "paid" ? "Шилжүүлсэн" : "Буцаасан"}</Chip>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    );
  } else if (tab === "expense") {
    const rows = await sql`SELECT kind, delta, period, note, created_at FROM money_ledger
                           WHERE account = 'out' AND kind = ANY(${EXPENSE_KINDS}) AND ref_id IS NULL ORDER BY id DESC LIMIT 40`;
    body = (
      <div className="adm-grid2">
        <section className="adm-card">
          <div className="adm-card-head"><b>Зардал бүртгэх</b></div>
          <form action={addExpense} className="adm-form">
            <label>Төрөл
              <select name="kind" required defaultValue="">
                <option value="" disabled>Сонгох</option>
                {EXPENSE_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
              </select>
            </label>
            <label>Дүн (₮)<input name="amount" inputMode="numeric" required placeholder="150000" /></label>
            <label>Сар<input name="period" defaultValue={period} pattern="\d{4}-\d{2}" required /></label>
            <label>Тайлбар (шилэн дансанд харагдана)<input name="note" maxLength={200} placeholder="Vercel Pro, Neon, ..." /></label>
            <button className="adm-btn dark">Бүртгэх</button>
          </form>
          <p className="adm-muted small">Бүх зардал /san хуудасны шилэн дансанд нээлттэй харагдана.</p>
        </section>
        <section className="adm-card flush">
          <div className="adm-card-head pad"><b>Сүүлийн зардлууд</b></div>
          {rows.length === 0 ? <p className="adm-empty">Зардал бүртгэгдээгүй.</p> : (
            <table className="adm-table">
              <thead><tr><th>Төрөл</th><th>Дүн</th><th>Сар</th><th>Тайлбар</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}><td>{KIND_LABEL[r.kind]}</td><td className="adm-neg">{fmtMnt(r.delta)}</td><td>{r.period}</td><td className="adm-wrap">{r.note || "—"}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    );
  } else {
    const target = sp.p && sp.p < period ? sp.p : prevPeriod(period);
    const [closed] = await sql`SELECT COUNT(*)::int AS n, COALESCE(SUM(amount), 0)::bigint AS total FROM prizes WHERE period = ${target}`;
    const preview = closed.n ? [] : splitPrizes(await monthBoard(target, 100), pool).filter((w) => w.amount > 0);
    body = (
      <section className="adm-card">
        <div className="adm-card-head"><b>{periodLabel(target)} хаах</b></div>
        <form method="get" className="adm-inline">
          <input type="hidden" name="t" value="close" />
          <input name="p" defaultValue={target} pattern="\d{4}-\d{2}" />
          <button className="adm-btn">Харах</button>
        </form>
        {closed.n ? (
          <p className="adm-muted">Энэ сар хаагдсан: {closed.n} бичээчид {fmtMnt(closed.total)}.</p>
        ) : (
          <>
            <p className="adm-muted">Сангийн одоогийн үлдэгдэл {fmtMnt(pool)}. Хаахаас өмнө хуурамч очийг шалгаж, шаардлагатай бол хэрэглэгчийг хязгаарлана уу (хязгаарлагдсан дансны оч тооцогдохгүй).</p>
            {preview.length === 0 ? <p className="adm-empty">Шагнал авах бичээч алга.</p> : (
              <table className="adm-table">
                <thead><tr><th>#</th><th>Бичээч</th><th>Түвшин</th><th>Оч</th><th>Оноо</th><th>Шагнал</th></tr></thead>
                <tbody>
                  {preview.map((w) => (
                    <tr key={w.id}>
                      <td>{w.kind === "star" ? "★" : w.rank}</td>
                      <td><Link href={`/u/${w.id}`}>{who(w)}</Link></td>
                      <td>{w.level.name} ×{w.mult}</td>
                      <td>{w.sparks}</td>
                      <td>{Math.round(w.score * 10) / 10}</td>
                      <td className="adm-strong">{fmtMnt(w.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {preview.length > 0 && (
              <form action={closeMonth} className="adm-inline" style={{ marginTop: 12 }}>
                <input type="hidden" name="period" value={target} />
                <button className="adm-btn dark">Сарыг хааж {fmtMnt(preview.reduce((a, w) => a + w.amount, 0))} хуваарилах</button>
              </form>
            )}
          </>
        )}
      </section>
    );
  }

  return (
    <>
      <Head user={user} title="Санхүү · Шагналын сан" sub={<>Төлбөр баталгаажуулах, бичээчид шилжүүлэх, зардал бүртгэх. Нийтэд: <Link href="/san">/san</Link></>} />
      <Flash ok={sp.ok} error={sp.error} />
      <div className="adm-stats">
        <Stat label="Шагналын сан" value={fmtMnt(pool)} note={periodLabel(period)} />
        <Stat label="Дэмжигчид" value={cnt.prem} note="идэвхтэй" />
        <Stat label="Бичээчдийн хэтэвч" value={fmtMnt(cnt.wallets)} note="нийт үлдэгдэл" />
        <Stat label="Энэ сарын сайтын үлдэгдэл" value={fmtMnt(cur?.platform_net || 0)} note="орлого − зардал" tone={Number(cur?.platform_net) < 0 ? "bad" : ""} />
      </div>
      <Tabs tabs={tabs} cur={tab} href={(k) => (k ? `/admin/finance?t=${k}` : "/admin/finance")} />
      {body}
    </>
  );
}
