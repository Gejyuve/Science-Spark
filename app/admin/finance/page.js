import Link from "next/link";
import { sql } from "@/lib/db";
import { requireSection, maskIp } from "@/lib/admin";
import { poolBalance, fmtMnt, KIND_LABEL, ACCOUNT_LABEL, EXPENSE_KINDS, REQUEST_KIND, PAYMENT_FEE, INCOME_TAX, bankInfo } from "@/lib/money";
import { currentPeriod, prevPeriod, periodLabel, monthBoard, splitPrizes } from "@/lib/spark";
import { confirmPayment, cancelPayment, addExpense, payWithdrawal, rejectWithdrawal, closeMonth } from "./actions";
import Head, { Stat, Flash, Tabs, Chip, who, Pick } from "../_c/Head";

const TABS = [["", "Төлбөр"], ["withdraw", "Татах хүсэлт"], ["tx", "Гүйлгээний түүх"], ["expense", "Зардал"], ["close", "Сар хаах"], ["log", "Лог"]];
// Яг огноо, цаг минут (Улаанбаатарын цагаар)
const fmtT = (d) => (d ? new Date(d).toLocaleString("sv-SE", { timeZone: "Asia/Ulaanbaatar" }).slice(0, 16).replace(/-/g, ".") : "—");
const RANGES = [["", "Энэ сар"], ["prev", "Өнгөрсөн сар"], ["year", "Сүүлийн 12 сар"], ["all", "Бүх хугацаа"]];
const SORTS = [["", "Хамгийн сүүлд"], ["big", "Хамгийн их дүн"], ["small", "Хамгийн бага дүн"], ["old", "Хамгийн эхэнд"]];
const TX_KINDS = [
  ["", "Бүгд", []],
  ["premium", "Дэмжигчийн хураамж", ["premium", "pool_share"]],
  ["donation", "Сан руу хандив", ["donation"]],
  ["tip", "Бичээчид урамшуулал", ["tip", "tip_fee"]],
  ["bounty", "Асуултын шагнал", ["bounty_lock", "bounty_refund", "bounty_paid", "bounty", "bounty_fee"]],
  ["fee", "Шимтгэл", ["tip_fee", "bounty_fee", "fee"]],
  ["topup", "Хэтэвч цэнэглэлт", ["topup"]],
  ["prize", "Сарын шагнал", ["prize"]],
  ["withdrawal", "Татан авалт", ["withdrawal", "payout", "tax_withheld"]],
  ["expense", "Зардал", ["server", "editorial", "tax", "other"]],
];
const BIG = 1000000; // үүнээс дээш нэг гүйлгээг шалгах

// "Гарсан" дансны дүн сайтаас гарсан мөнгө тул хасахаар харуулна
const amt = (m) => (m.account === "out" ? -Number(m.delta) : Number(m.delta));

function rangeOf(r, period) {
  if (r === "prev") { const p = prevPeriod(period); return [p, p]; }
  if (r === "all") return ["0000-00", "9999-99"];
  if (r === "year") { let p = period; for (let i = 0; i < 11; i++) p = prevPeriod(p); return [p, period]; }
  return [period, period];
}

export default async function Finance({ searchParams }) {
  const user = await requireSection("finance");
  const sp = await searchParams;
  // Админ санхүүг зөвхөн харна: сар хаах, лог, бүх үйлдлийн товч супер админд
  const sup = user.role === "superadmin";
  const TABS_ = sup ? TABS : TABS.filter(([k]) => k !== "close" && k !== "log");
  const tab = TABS_.some(([k]) => k === sp.t) ? sp.t : "";
  const period = currentPeriod();
  const range = RANGES.some(([k]) => k === sp.r) ? sp.r : "";
  const [from, to] = rangeOf(range, period);
  const rangeLabel = RANGES.find(([k]) => k === range)[1];
  const [pool, [cnt], [inc]] = await Promise.all([
    poolBalance(),
    sql`SELECT (SELECT COUNT(*) FROM payment_requests WHERE status = 'pending')::int AS pay,
               (SELECT COUNT(*) FROM withdrawals WHERE status = 'pending')::int AS wd,
               (SELECT COUNT(*) FROM users WHERE premium_until > now())::int AS prem,
               (SELECT COALESCE(SUM(delta), 0) FROM money_ledger WHERE account = 'wallet')::bigint AS wallets,
               (SELECT COALESCE(SUM(delta), 0) FROM money_ledger WHERE account = 'escrow')::bigint AS escrow`,
    // Орлого: сонгосон хугацааны (сарын) дүн
    sql`SELECT
          COALESCE(SUM(delta) FILTER (WHERE kind IN ('premium', 'pool_share')), 0)::bigint AS premium,
          COUNT(DISTINCT ref_id) FILTER (WHERE kind = 'premium')::int AS premium_n,
          COALESCE(SUM(delta) FILTER (WHERE kind = 'pool_share'), 0)::bigint AS pool_share,
          COALESCE(SUM(delta) FILTER (WHERE kind = 'donation'), 0)::bigint AS donations,
          COUNT(*) FILTER (WHERE kind = 'donation')::int AS donations_n,
          COALESCE(SUM(delta) FILTER (WHERE kind = 'tip_fee'), 0)::bigint AS tip_fee,
          COUNT(*) FILTER (WHERE kind = 'tip_fee')::int AS tip_n,
          COALESCE(SUM(delta) FILTER (WHERE kind = 'bounty_fee'), 0)::bigint AS bounty_fee,
          COUNT(*) FILTER (WHERE kind = 'bounty_fee')::int AS bounty_n,
          COALESCE(SUM(delta) FILTER (WHERE account = 'out' AND kind = 'fee' AND ref_id IS NOT NULL), 0)::bigint AS pay_fees,
          COALESCE(SUM(delta) FILTER (WHERE account = 'platform'), 0)::bigint AS platform_net
        FROM money_ledger WHERE period BETWEEN ${from} AND ${to}`,
  ]);
  const fees = Number(inc.tip_fee) + Number(inc.bounty_fee);
  const income = Number(inc.premium) + Number(inc.donations) + fees;
  const tabs = TABS_.map(([k, l]) => [k, l, k === "" ? cnt.pay : k === "withdraw" ? cnt.wd : null]);
  // Хуудасны холбоос: одоогийн сонголтуудыг хадгална
  const link = (o) => {
    const v = { t: tab, r: range, s: sp.s, k: sp.k, bad: sp.bad, ...o };
    const q = new URLSearchParams(Object.entries(v).filter(([, x]) => x));
    return `/admin/finance${q.size ? `?${q}` : ""}`;
  };

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
            <thead><tr><th>Код</th><th>Хэрэглэгч</th><th>Төрөл</th><th>Дүн</th><th>Хэзээ</th>{sup && <th className="adm-right">Үйлдэл</th>}</tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="adm-strong adm-mono">{r.code}</td>
                  <td><Link href={`/u/${r.user_id}`}>{who(r)}</Link></td>
                  <td>{REQUEST_KIND[r.kind]}{r.months ? ` · ${r.months} сар` : ""}{r.kind === "tip" && ` → ${r.w_initial}.${r.w_first_name}`}{r.anonymous && <Chip tone="gray">нууц</Chip>}</td>
                  <td className="adm-mono">{fmtMnt(r.amount)}</td>
                  <td className="adm-mono">{fmtT(r.created_at)}</td>
                  {sup && <td className="adm-right">
                    <div className="adm-acts">
                      <form action={confirmPayment} className="adm-inline">
                        <input type="hidden" name="id" value={r.id} />
                        <input name="fee" type="number" min={0} className="adm-num" defaultValue={r.kind === "topup" ? 0 : Math.round(r.amount * PAYMENT_FEE)} title="Шимтгэл ₮" />
                        <button className="adm-btn dark">Ирсэн</button>
                      </form>
                      <form action={cancelPayment}><input type="hidden" name="id" value={r.id} /><button className="adm-btn danger">Цуцлах</button></form>
                    </div>
                  </td>}
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
                  <td className="adm-mono">{fmtT(w.created_at)}</td>
                  <td className="adm-right">
                    {w.status === "pending" && !sup ? <Chip tone="warn">Хүлээгдэж буй</Chip> : w.status === "pending" ? (
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
      <div className={sup ? "adm-grid2" : ""}>
        {sup && <section className="adm-card">
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
        </section>}
        <section className="adm-card flush">
          <div className="adm-card-head pad"><b>Сүүлийн зардлууд</b></div>
          {rows.length === 0 ? <p className="adm-empty">Зардал бүртгэгдээгүй.</p> : (
            <table className="adm-table">
              <thead><tr><th>Хэзээ</th><th>Төрөл</th><th>Дүн</th><th>Сар</th><th>Тайлбар</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}><td className="adm-mono">{fmtT(r.created_at)}</td><td>{KIND_LABEL[r.kind]}</td><td className="adm-neg">{fmtMnt(r.delta)}</td><td>{r.period}</td><td className="adm-wrap">{r.note || "—"}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    );
  } else if (tab === "tx") {
    const sort = SORTS.some(([k]) => k === sp.s) ? sp.s || "" : "";
    const kk = TX_KINDS.find(([k]) => k === sp.k) || TX_KINDS[0];
    const kinds = kk[2];
    const bad = sp.bad === "1";
    // Асуудалтай байж болзошгүй гүйлгээ: шалгах шалтгаантай нь
    const problems = await sql`
      SELECT * FROM (
        SELECT r.created_at AS at, 'Төлбөр ' || r.code AS what, r.user_id AS uid, r.amount::bigint AS amount,
               'Шилжүүлэг 48 цагаас дээш баталгаажаагүй' AS reason
          FROM payment_requests r WHERE r.status = 'pending' AND r.created_at < now() - interval '48 hours'
        UNION ALL
        SELECT r.decided_at, 'Төлбөр ' || r.code, r.user_id, r.amount,
               'Шимтгэл ' || to_char(f.delta, 'FM999,999,999') || '₮, дүнгийн 5%-аас их'
          FROM payment_requests r JOIN money_ledger f ON f.account = 'out' AND f.kind = 'fee' AND f.ref_id = r.id
          WHERE r.status = 'confirmed' AND f.delta > r.amount * 0.05
        UNION ALL
        SELECT r.created_at, 'Урамшуулал ' || r.code, r.user_id, r.amount, 'Өөрөө өөртөө урамшуулал илгээсэн'
          FROM payment_requests r WHERE r.kind = 'tip' AND r.writer_id = r.user_id AND r.status <> 'cancelled'
        UNION ALL
        SELECT MAX(r.created_at), 'Урамшуулал ×' || COUNT(*), r.user_id, SUM(r.amount),
               'Нэг хүн нэг бичээчид нэг өдөр ' || COUNT(*) || ' удаа урамшуулал илгээсэн'
          FROM payment_requests r WHERE r.kind = 'tip' AND r.status <> 'cancelled'
          GROUP BY r.user_id, r.writer_id, (r.created_at AT TIME ZONE 'Asia/Ulaanbaatar')::date HAVING COUNT(*) >= 3
        UNION ALL
        SELECT r.created_at, 'Төлбөр ' || r.code, r.user_id, r.amount, 'Их дүн (1 сая ₮-өөс дээш), шалгах'
          FROM payment_requests r WHERE r.amount >= ${BIG} AND r.status <> 'cancelled'
        UNION ALL
        SELECT w.created_at, 'Татах хүсэлт', w.user_id, w.amount,
               CASE WHEN w.amount > (SELECT COALESCE(SUM(delta), 0) FROM money_ledger WHERE account = 'wallet' AND user_id = w.user_id)
                    THEN 'Хэтэвчийн үлдэгдэл хүрэлцэхгүй' ELSE 'Татах хүсэлт 72 цагаас дээш хүлээгдэж байна' END
          FROM withdrawals w WHERE w.status = 'pending'
            AND (w.created_at < now() - interval '72 hours'
              OR w.amount > (SELECT COALESCE(SUM(delta), 0) FROM money_ledger WHERE account = 'wallet' AND user_id = w.user_id))
        UNION ALL
        SELECT MAX(m.created_at), 'Хэтэвч', m.user_id, SUM(m.delta), 'Хэтэвчийн үлдэгдэл хасах дүнтэй'
          FROM money_ledger m WHERE m.account = 'wallet' GROUP BY m.user_id HAVING SUM(m.delta) < 0
        UNION ALL
        SELECT b.decided_at, 'Асуултын шагнал', b.user_id, b.amount, 'Асуугч өөрийн хариултад шагнал олгосон'
          FROM bounties b WHERE b.status = 'awarded' AND b.winner_id = b.user_id
      ) x LEFT JOIN users u ON u.id = x.uid ORDER BY x.at DESC NULLS LAST LIMIT 200`;
    const rows = bad ? [] : await sql`
      SELECT m.id, m.account, m.kind, m.delta, m.note, m.anonymous, m.ref_id, m.created_at, m.user_id,
             u.initial, u.first_name, u.email, r.code
      FROM money_ledger m
      LEFT JOIN users u ON u.id = m.user_id
      LEFT JOIN payment_requests r ON r.id = m.ref_id AND m.kind IN ('premium', 'pool_share', 'donation', 'tip', 'tip_fee', 'topup', 'fee')
      WHERE (${kinds.length === 0} OR m.kind = ANY(${kinds.length ? kinds : ["-"]}))
        AND (${kk[0] !== "expense"} OR (m.account = 'platform' AND m.ref_id IS NULL))
        -- Зардлын "Гарсан" талын давхар мөрийг нуух (сайтын талын мөр нь харагдана)
        AND NOT (m.account = 'out' AND m.ref_id IS NULL AND m.kind = ANY(${EXPENSE_KINDS}))
      ORDER BY CASE WHEN ${sort} = 'big' THEN ABS(m.delta) END DESC NULLS LAST,
               CASE WHEN ${sort} = 'small' THEN ABS(m.delta) END ASC NULLS LAST,
               CASE WHEN ${sort} = 'old' THEN m.created_at END ASC NULLS LAST,
               m.created_at DESC, m.id DESC
      LIMIT 200`;
    body = (
      <section className="adm-card flush">
        <div className="adm-card-head pad adm-bar">
          <b>{bad ? "Асуудалтай байж болзошгүй гүйлгээ" : "Гүйлгээний түүх"}</b>
          <span className="ss-grow" />
          {!bad && <Pick label="Төрөл" options={TX_KINDS.map(([k, l]) => ({ href: link({ k }), label: l, on: kk[0] === k }))} />}
          {!bad && <Pick label="Эрэмбэ" options={SORTS.map(([k, l]) => ({ href: link({ s: k }), label: l, on: sort === k }))} />}
          <a href={link({ bad: bad ? "" : "1" })} className={"adm-btn" + (bad ? " dark" : problems.length ? " danger" : "")}>
            {bad ? "← Бүх гүйлгээ" : <>⚠ Асуудалтай гүйлгээ {problems.length > 0 && <em className="adm-count">{problems.length}</em>}</>}
          </a>
        </div>
        {bad ? (
          <>
            <p className="adm-muted small pad">Удаан баталгаажаагүй төлбөр, хэт өндөр шимтгэл, өөртөө илгээсэн урамшуулал, давтагдсан урамшуулал, их дүн, үлдэгдэл хүрэлцэхгүй татах хүсэлт, хасах үлдэгдэлтэй хэтэвч зэргийг автоматаар илрүүлнэ.</p>
            {problems.length === 0 ? <p className="adm-empty">Асуудалтай гүйлгээ илрээгүй.</p> : (
              <table className="adm-table">
                <thead><tr><th>Хэзээ</th><th>Юу</th><th>Хэрэглэгч</th><th className="adm-right">Дүн</th><th>Асуудал</th></tr></thead>
                <tbody>
                  {problems.map((x, i) => (
                    <tr key={i}>
                      <td className="adm-mono">{fmtT(x.at)}</td>
                      <td className="adm-strong">{x.what}</td>
                      <td>{x.uid ? <Link href={`/admin/users/${x.uid}`}>{who(x)}</Link> : "—"}</td>
                      <td className={"adm-right adm-mono" + (Number(x.amount) < 0 ? " adm-neg" : "")}>{fmtMnt(x.amount)}</td>
                      <td className="adm-wrap"><Chip tone="bad">{x.reason}</Chip></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        ) : rows.length === 0 ? <p className="adm-empty">Гүйлгээ алга.</p> : (
          <table className="adm-table">
            <thead><tr><th>Хэзээ</th><th>Төрөл</th><th>Данс</th><th>Хэрэглэгч</th><th className="adm-right">Дүн</th><th>Тайлбар</th></tr></thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td className="adm-mono">{fmtT(m.created_at)}</td>
                  <td>{KIND_LABEL[m.kind] || m.kind}</td>
                  <td>{ACCOUNT_LABEL[m.account] || m.account}</td>
                  <td>{m.user_id ? <Link href={`/admin/users/${m.user_id}`}>{who(m)}</Link> : "—"}{m.anonymous && m.user_id && <Chip tone="gray">нууц</Chip>}</td>
                  <td className={"adm-right adm-mono " + (amt(m) < 0 ? "adm-neg" : "adm-pos")}>{amt(m) > 0 ? "+" : ""}{fmtMnt(amt(m))}</td>
                  <td className="adm-wrap adm-clip">{[...new Set([m.code, m.note].filter(Boolean))].join(" · ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    );
  } else if (tab === "log") {
    // Санхүүгийн үйлдлүүдийн аудит (аудит логоос тусгаарласан)
    const rows = await sql`SELECT a.*, u.initial, u.first_name, u.email FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
                           WHERE a.category = 'money' ORDER BY a.created_at DESC LIMIT 200`;
    body = (
      <section className="adm-card flush">
        <div className="adm-card-head pad"><b>Санхүүгийн үйлдлүүд</b></div>
        {rows.length === 0 ? <p className="adm-empty">Бичлэг алга.</p> : (
          <table className="adm-table">
            <thead><tr><th>Хугацаа</th><th>Хэн</th><th>Үйлдэл</th><th>Хэнд</th><th>IP</th></tr></thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td className="adm-mono">{fmtT(a.created_at)}</td>
                  <td>{a.actor_id ? who(a) : "Систем"}</td>
                  <td className="adm-wrap">{a.action}</td>
                  <td>{a.target_type === "user" && a.target_id ? <Link href={`/admin/users/${a.target_id}`}>{a.target_label || `#${a.target_id}`}</Link> : a.target_label || "—"}</td>
                  <td className="adm-mono">{maskIp(a.ip)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
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
      <Head user={user} title="Санхүү"
        tools={<Pick label="Хугацаа" options={RANGES.map(([k, l]) => ({ href: link({ r: k }), label: l, on: range === k }))} />}
        sub={sup ? <>Төлбөр баталгаажуулах, бичээчид шилжүүлэх, зардал бүртгэх. Нийтэд: <Link href="/san">/san</Link></> : "Зөвхөн харах. Санхүүгийн үйлдлийг супер админ хийнэ"} />
      <Flash ok={sp.ok} error={sp.error} />
      <div className="adm-stats fit">
        <Stat label="Шагналын сан" value={fmtMnt(pool)} note={`${periodLabel(period)} · одоогийн үлдэгдэл`} />
        <Stat label="Идэвхтэй дэмжигч" value={cnt.prem} note="одоо дэмжигч эрхтэй" />
        <Stat label="Бичээчдийн хэтэвч" value={fmtMnt(cnt.wallets)} note={`нийт үлдэгдэл · түгжигдсэн асуултын шагнал ${fmtMnt(cnt.escrow)}`} />
        <Stat label="Сайтын үлдэгдэл" value={fmtMnt(inc.platform_net)} note={`${rangeLabel} · орлого − зардал`} tone={Number(inc.platform_net) < 0 ? "bad" : ""} />
      </div>
      <section className="adm-card">
        <div className="adm-card-head"><b>Орлого</b><small className="adm-muted">{rangeLabel}{range === "" || range === "prev" ? ` · ${periodLabel(from)}` : ""}</small></div>
        <div className="fin-income">
          <div><span>Дэмжигчдийн орлого</span><b>{fmtMnt(inc.premium)}</b><small>{inc.premium_n} төлбөр · үүнээс {fmtMnt(inc.pool_share)} шагналын санд</small></div>
          <div><span>Хандивын орлого</span><b>{fmtMnt(inc.donations)}</b><small>{inc.donations_n} хандив · бүгд шагналын санд</small></div>
          <div><span>Шимтгэлийн орлого</span><b>{fmtMnt(fees)}</b>
            <small>Урамшууллын 10%: {fmtMnt(inc.tip_fee)} ({inc.tip_n})</small>
            <small>Асуултын шагналын 10%: {fmtMnt(inc.bounty_fee)} ({inc.bounty_n})</small>
          </div>
          <div className="tot"><span>Нийт орлого</span><b>{fmtMnt(income)}</b><small>Банкны шимтгэл {fmtMnt(inc.pay_fees)} хассаны дараах дүн</small></div>
        </div>
      </section>
      <Tabs tabs={tabs} cur={tab} href={(k) => (k ? `/admin/finance?t=${k}` : "/admin/finance")} />
      {body}
    </>
  );
}
