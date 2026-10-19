import Link from "next/link";
import { sql, ensureSchema } from "@/lib/db";
import { getUser, isPremium } from "@/lib/auth";
import { levelFor } from "@/lib/levels";
import { monthBoard, splitPrizes, currentPeriod, prevPeriod, periodLabel, periodEnd, TOP_N, STAR_SHARE, PAIR_CAP, GIVER_MIN_DAYS } from "@/lib/spark";
import { poolBalance, periodSummary, fmtMnt, KIND_LABEL, ACCOUNT_LABEL, POOL_SHARE, WITHDRAW_MIN, INCOME_TAX } from "@/lib/money";
import Shell from "../components/Shell";
import { Avatar } from "../components/Bits";
import Countdown from "../components/Countdown";
import SupportModal from "../components/SupportModal";
import { supportModalProps } from "@/lib/supportModal";

export const dynamic = "force-dynamic";
export const metadata = { title: "Шагналын сан · Science Spark" };

const pct = (x) => `${Math.round(x * 100)}%`;
const who = (r) => (r.anonymous || !r.first_name ? "Нэрээ нууцалсан" : `${r.initial}.${r.first_name}`);

function Chip({ l }) {
  return <span className="och-chip" style={{ "--c": l.color }}>{l.name} ×{l.mult}</span>;
}

// Шагналын сан: бодит цагийн шилдэг 10, топ хандивлагчид, шилэн данс (бүх орлого, зардал нээлттэй)
export default async function San({ searchParams }) {
  const sp = await searchParams;
  const period = currentPeriod();
  // Жагсаалт: анхдагч нь энэ сарын шилдэг 10 (шагналын байр), сонголтоор бүх цаг үеийн хөдөлмөрийн оч
  const allTime = sp.b === "all";
  let user = null, pool = 0, board = [], last = [], donors = [], summary = [], recent = [], stats = { supporters: 0, donors: 0 }, ever = [];
  try {
    user = await getUser();
    await ensureSchema();
    [pool, board, last, donors, summary, recent, [stats]] = await Promise.all([
      poolBalance(),
      monthBoard(period, 40),
      sql`SELECT z.*, u.initial, u.first_name, u.avatar_id AS avatar FROM prizes z JOIN users u ON u.id = z.user_id
          WHERE z.period = ${prevPeriod(period)} ORDER BY z.kind DESC, z.rank ASC`,
      sql`SELECT u.id, u.initial, u.first_name, u.avatar_id AS avatar, SUM(r.amount)::bigint AS total, COUNT(*)::int AS times
          FROM payment_requests r JOIN users u ON u.id = r.user_id
          WHERE r.status = 'confirmed' AND r.kind IN ('pool', 'tip') AND NOT r.anonymous
          GROUP BY u.id ORDER BY total DESC LIMIT 10`,
      periodSummary(12),
      sql`SELECT m.account, m.kind, m.delta, m.period, m.anonymous, m.note, m.created_at, u.initial, u.first_name
          FROM money_ledger m LEFT JOIN users u ON u.id = m.user_id
          WHERE (m.account <> 'out' OR m.kind IN ('fee', 'tax_withheld'))
            -- Асуултын шагнал түгжих, буцаах нь хэрэглэгчийн дотоод хөдөлгөөн тул нийтэд харуулахгүй
            AND m.account <> 'escrow' AND m.kind NOT IN ('bounty_lock', 'bounty_refund', 'topup')
          ORDER BY m.id DESC LIMIT 30`,
      sql`SELECT (SELECT COUNT(*) FROM users WHERE premium_until > now())::int AS supporters,
                 (SELECT COUNT(DISTINCT user_id) FROM payment_requests WHERE status = 'confirmed')::int AS donors`,
    ]);
    if (allTime) {
      ever = await sql`
        SELECT u.id, u.initial, u.first_name, u.avatar_id AS avatar, u.premium_until, SUM(l.delta)::int AS points,
               COALESCE((SELECT SUM(z.amount) FROM prizes z WHERE z.user_id = u.id), 0)::bigint AS won
        FROM points_ledger l JOIN users u ON u.id = l.user_id
        WHERE u.first_name <> '' AND u.restricted_at IS NULL
        GROUP BY u.id HAVING SUM(l.delta) > 0
        ORDER BY points DESC, u.id ASC LIMIT ${TOP_N}`;
    }
  } catch (e) {}
  const prizes = splitPrizes(board, pool);
  const top = prizes.filter((p) => p.kind === "top");
  const star = prizes.find((p) => p.kind === "star");
  // Цонхонд дамжуулах өгөгдөл (дансны мэдээлэл нийтэд харагддаг тул илгээхэд аюулгүй)
  const modal = supportModalProps(user);
  const mine = user ? board.findIndex((r) => r.id === user.id) : -1;

  return (
    <Shell user={user} active="/san" header="nav">
      <div className="ss-card och san">
        {sp.error && <p className="och-note bad">{sp.error}</p>}
        {sp.ok && <p className="och-note info">{sp.ok}</p>}
        <section className="san-top">
          <div className="san-rays" aria-hidden="true" />
          <div className="san-top-in">
            <Countdown end={periodEnd(period)} initial={Math.max(0, periodEnd(period) - Date.now())} />
            <small className="san-kicker">✦ Шагналын сан</small>
            <b className="san-amount">{fmtMnt(pool)}</b>
            <p>Монголын шинжлэх ухаан түгээгч, мэдлэг цацруулагч, идэвхтэн бичээчдийг хамтдаа дэмжие.</p>
            <div className="san-cta">
              <SupportModal kind="premium" label={user && isPremium(user) ? "Дэмжлэгээ сунгах" : "Дэмжигч болох"} className="ss-pill" {...modal} />
              <SupportModal kind="pool" label="Хандив өгөх" className="ss-pill ghost" {...modal} />
            </div>
            <div className="san-stats">
              <span><b>{stats.supporters}</b><small>дэмжигч</small></span>
              <span><b>{stats.donors}</b><small>хандивлагч</small></span>
              <span><b>{board.length}</b><small>оч авсан бичээч</small></span>
            </div>
            <small className="san-period">{periodLabel(period)}</small>
          </div>
        </section>

        <h2 id="board">{allTime ? "Бүх цаг үеийн шилдэг" : `Энэ сарын шилдэг ${TOP_N}`}</h2>
        <div className="ss-feedtabs och-tabs">
          <Link href="/san#board" className={allTime ? "" : "on"}>Энэ сар</Link>
          <Link href="/san?b=all#board" className={allTime ? "on" : ""}>Бүх цаг үе</Link>
        </div>
        {allTime ? (
          <>
            <p className="san-formula">Хөдөлмөрөөрөө олсон нийт оч, хүртсэн нийт шагнал</p>
            <div className="och-board san-board">
              <div className="och-brow head"><span>№</span><span>Бичээч</span><span>Түвшин</span><span>Оч</span><span>Шагнал</span></div>
              {ever.length === 0 && <p className="ss-empty">Одоохондоо мэдээлэл алга.</p>}
              {ever.map((r, i) => (
                <Link key={r.id} href={`/u/${r.id}`} className={"och-brow" + (user?.id === r.id ? " me" : "")}>
                  <span>{i + 1}</span>
                  <span className="och-who"><Avatar user={r} size={28} /><b>{r.initial}.{r.first_name}</b>{isPremium(r) && <span className="ss-nbadges san-bolt" style={{ "--nb-d": `-${(r.id * 7.3) % 16}s` }}><img src="/icons/bolt.svg" width={15} height={15} alt="Дэмжигч" title="Шинжлэх ухааныг дэмжигч" /></span>}</span>
                  <span><Chip l={levelFor(r.points)} /></span>
                  <span className="och-plus">{r.points.toLocaleString("en-US")}</span>
                  <span>{fmtMnt(r.won)}</span>
                </Link>
              ))}
            </div>
          </>
        ) : <>
        <p className="san-formula">Шагнал ≈ сан × (оч × түвшний жин) ÷ шилдэг 10-ын оноо</p>
        <div className="och-board san-board">
          <div className="och-brow head"><span>№</span><span>Бичээч</span><span>Түвшин</span><span>Оч</span><span>Шагнал</span></div>
          {top.length === 0 && <p className="ss-empty">Энэ сард одоохондоо оч аваагүй байна. Эхний бичээч та байж болно!</p>}
          {top.map((r) => (
            <Link key={r.id} href={`/u/${r.id}`} className={"och-brow" + (user?.id === r.id ? " me" : "")}>
              <span>{r.rank}</span>
              <span className="och-who"><Avatar user={r} size={28} /><b>{r.initial}.{r.first_name}</b>{isPremium(r) && <span className="ss-nbadges san-bolt" style={{ "--nb-d": `-${(r.id * 7.3) % 16}s` }}><img src="/icons/bolt.svg" width={15} height={15} alt="Дэмжигч" title="Шинжлэх ухааныг дэмжигч" /></span>}</span>
              <span><Chip l={r.level} /></span>
              <span className="och-plus">{r.sparks}</span>
              <span>{fmtMnt(r.amount)}</span>
            </Link>
          ))}
          {star && (
            <Link href={`/u/${star.id}`} className="och-brow san-star">
              <span>★</span>
              <span className="och-who"><Avatar user={star} size={28} /><b>{star.initial}.{star.first_name}</b><i className="san-badge">Шинэ од</i></span>
              <span><Chip l={star.level} /></span>
              <span className="och-plus">{star.sparks}</span>
              <span>{fmtMnt(star.amount)}</span>
            </Link>
          )}
        </div>
        {user && mine >= TOP_N && (
          <p className="och-hint">Та {mine + 1}-р байрт байна. {TOP_N}-р байр хүртэл {Math.max(1, board[TOP_N - 1].sparks - board[mine].sparks + 1)} оч дутуу.</p>
        )}
        </>}

        {last.length > 0 && (
          <>
            <h2>{periodLabel(prevPeriod(period))}-ын шагналтнууд</h2>
            <div className="san-winners">
              {last.map((r) => (
                <Link key={r.user_id} href={`/u/${r.user_id}`} className="san-winner">
                  <Avatar user={{ id: r.user_id, first_name: r.first_name, avatar: r.avatar }} size={36} />
                  <span className="san-wt"><b>{r.initial}.{r.first_name}</b><small>{r.kind === "star" ? "Шинэ од" : `${r.rank}-р байр`} · {r.sparks} оч</small></span>
                  <em>{fmtMnt(r.amount)}</em>
                </Link>
              ))}
            </div>
          </>
        )}

        <h2>Топ хандивлагчид</h2>
        {donors.length === 0 ? <p className="och-hint">Анхны хандивлагч та болоорой.</p> : (
          <div className="san-winners">
            {donors.map((d, i) => (
              <Link key={d.id} href={`/u/${d.id}`} className="san-winner">
                <span className="och-num">{i + 1}</span>
                <Avatar user={d} size={32} />
                <span className="san-wt"><b>{d.initial}.{d.first_name}</b><small>{d.times} удаа дэмжсэн</small></span>
                <em>{fmtMnt(d.total)}</em>
              </Link>
            ))}
          </div>
        )}

        <h2 id="glass">Шилэн данс · сар бүрээр</h2>
        <div className="san-table-wrap">
          <table className="san-table">
            <thead>
              <tr><th>Сар</th><th>Дэмжигчид</th><th>Шимтгэл</th><th>Санд {pct(POOL_SHARE)}</th><th>Санд хандив</th><th>Шагнал</th><th>Бичээчид хандив</th><th>Сервер</th><th>Редакц</th><th>Татвар</th><th>Бусад</th><th>Сайтын үлдэгдэл</th></tr>
            </thead>
            <tbody>
              {summary.length === 0 && <tr><td colSpan={12} className="ss-empty">Одоохондоо гүйлгээ алга.</td></tr>}
              {summary.map((r) => (
                <tr key={r.period}>
                  <td>{r.period}</td><td>{fmtMnt(r.premium_net)}</td><td>{fmtMnt(r.fees)}</td><td>{fmtMnt(r.pool_share)}</td>
                  <td>{fmtMnt(r.donations)}</td><td>{fmtMnt(r.prizes)}</td><td>{fmtMnt(r.tips)}</td><td>{fmtMnt(r.server)}</td>
                  <td>{fmtMnt(r.editorial)}</td><td>{fmtMnt(r.tax)}</td><td>{fmtMnt(r.other)}</td>
                  <td className={Number(r.platform_net) < 0 ? "neg" : "pos"}>{fmtMnt(r.platform_net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2>Сүүлийн гүйлгээ</h2>
        <div className="och-rules">
          {recent.length === 0 && <p className="och-hint">Одоохондоо гүйлгээ алга.</p>}
          {recent.map((m, i) => (
            <div key={i} className="och-rule">
              <span>
                <b>{KIND_LABEL[m.kind] || m.kind}</b>
                <small>{ACCOUNT_LABEL[m.account]} · {m.period}{m.first_name && ["donation", "tip", "prize", "withdrawal"].includes(m.kind) ? ` · ${who(m)}` : ""}{m.note && m.account === "out" ? ` · ${m.note}` : ""}</small>
              </span>
              <em className={m.account === "out" || m.delta < 0 ? "neg" : ""}>{m.account === "out" ? "−" : m.delta > 0 ? "+" : "−"}{fmtMnt(Math.abs(m.delta))}</em>
            </div>
          ))}
        </div>

        <h2>Дүрэм</h2>
        <div className="och-note info">
          <ul>
            <li>Түвшин 1 (Лаа)-аас дээш бичээч оролцоно. Нийтлэл, мэдээ, хариулт, сэтгэгдэлдээ тухайн сард авсан оч тооцогдоно.</li>
            <li>Шилдэг {TOP_N} сангийн {pct(1 - STAR_SHARE)}-ийг оноогоороо, «Шинэ од» (шилдэг {TOP_N}-т ороогүй Түвшин 1-2 бичээч) {pct(STAR_SHARE)}-ийг авна.</li>
            <li>Дэмжигчийн оч 2-оор тооцогдоно. Нэг хүнээс нэг бичээчид сард {PAIR_CAP} хүртэл оч, {GIVER_MIN_DAYS} хоногоос дээш настай дансны оч л тооцогдоно.</li>
            <li>Бичээчид өгсөн урамшуулал хэтэвчид нь орно. Сан руу өгсөн хандиваас шимтгэл авахгүй.</li>
            <li>Хэтэвч {fmtMnt(WITHDRAW_MIN)}-д хүрмэгц татах боломжтой. Хувь хүний орлогын албан татвар {pct(INCOME_TAX)}-ийг суутгана.</li>
            <li>Сар дууссаны дараа редакц хуурамч очийг 7 хоног шалгаад шагналыг хэтэвчид шилжүүлнэ. Хуваарилагдаагүй дүн дараа сард шилжинэ.</li>
            <li>Оч мөнгө болохгүй: оч зөвхөн жагсаалтын байрыг тодорхойлно.</li>
          </ul>
        </div>
      </div>
    </Shell>
  );
}
