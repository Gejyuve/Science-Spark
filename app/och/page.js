import Link from "next/link";
import { getUser } from "@/lib/auth";
import { sql, ensureSchema } from "@/lib/db";
import { LEVELS, levelFor, nextLevel, SPARK_GET_WRITING, SPARK_GET_OTHER, PREMIUM_SPARK_WEIGHT, PREMIUM_DAILY_BONUS, FIRST_SPARK_REWARD, APPROVE_REWARD } from "@/lib/levels";
import { TERM_REWARD } from "@/lib/terms";
import { JOIN_REWARD } from "@/lib/clubs-shared";
import { POINTS_TOTAL } from "@/lib/profile";
import { dailyLimit, givenToday } from "@/lib/spark";
import Shell from "../components/Shell";
import { Avatar, fmtK } from "../components/Bits";

export const dynamic = "force-dynamic";
export const metadata = { title: "Асаж буй оч · Science Spark" };

const n = (x) => Number(x || 0).toLocaleString("en-US");

// Одоо ажиллаж буй дүрэм
const ACTIVE = [
  ["Нийтлэл, мэдээндээ оч авах", "Нэг хүнээс 1 л удаа · дэмжигчийн оч ×" + PREMIUM_SPARK_WEIGHT, `+${SPARK_GET_WRITING}`],
  ["Асуулт, бодрол, хариултдаа оч авах", "Нэг хүнээс 1 л удаа · дэмжигчийн оч ×" + PREMIUM_SPARK_WEIGHT, `+${SPARK_GET_OTHER}`],
  ["Нийтлэл редакцаар батлагдах", "Нийтлэгдэхэд 1 л удаа", `+${APPROVE_REWARD["Нийтлэл"]}`],
  ["Мэдээ редакцаар батлагдах", "Нийтлэгдэхэд 1 л удаа", `+${APPROVE_REWARD["Мэдээ"]}`],
  ["Анхны очоо өгөх", "Оч өгөх нь үнэгүй дохио: өгсөн хүнд оч нэмэгдэхгүй", `+${FIRST_SPARK_REWARD}`],
  ["Профайлаа бөглөх", "Талбар бүрд нэг л удаа", `+${POINTS_TOTAL} хүртэл`],
  ["Шинэ үг нэмэх", "Толинд нэмсэн үг батлагдвал", `+${TERM_REWARD}`],
  ["Клубт элсэх", "Анхны клубт 1 л удаа", `+${JOIN_REWARD}`],
];
// Удахгүй нэвтрэх (Figma: Очны дүрэм)
const SOON = [
  ["Асуултад хариулах", "Нэг асуултад 1 л удаа", "+10"],
  ["Асуулт асуух", "", "+50"],
  ["Бодрол хуваалцах", "", "+100"],
  ["Зарлал хуваалцах", "Нийтлэгдвэл", "+200"],
  ["Эвент хуваалцах", "Нийтлэгдвэл", "+500"],
  ["Анхны удаагийн шагнал", "Анхны хариулт, үг, нийтлэл тус бүрт 1 л удаа", "+50"],
];
const PERIODS = [["week", "Энэ долоо хоног", "7 days"], ["month", "Энэ сар", "30 days"], ["all", "Бүх цаг", null]];

// Том тоо утсан дээр товчлогдоно (12.3K)
function Num({ v, plus }) {
  const p = plus && v > 0 ? "+" : "";
  return <><i className="och-long">{p}{n(v)}</i><i className="och-short">{p}{fmtK(v)}</i></>;
}

function LevelIcon({ l, size = 36 }) {
  if (!l.n) return <span className="och-lv" style={{ "--c": l.color, width: size, height: size }}>·</span>;
  return <img className="och-lvi" src={`/icons/lv${l.n}.svg`} width={size} height={size} alt={`Түвшин ${l.n} · ${l.name}`} style={{ "--c": l.color }} />;
}

export default async function Och({ searchParams }) {
  const sp = await searchParams;
  const period = PERIODS.find((p) => p[0] === sp.p) || PERIODS[0];
  let user = null, top = [], me = null, today = 0;
  try {
    user = await getUser();
    await ensureSchema();
    top = await sql`
      SELECT u.id, u.initial, u.first_name, u.avatar_id AS avatar,
        COALESCE(SUM(l.delta) FILTER (WHERE ${period[2]}::text IS NULL OR l.created_at > now() - ${period[2] || "0 days"}::interval), 0)::int AS gained,
        COALESCE(SUM(l.delta), 0)::int AS total
      FROM users u JOIN points_ledger l ON l.user_id = u.id
      WHERE u.first_name <> ''
      GROUP BY u.id
      ORDER BY gained DESC, total DESC LIMIT 50`;
    if (user) {
      const [r] = await sql`
        WITH s AS (
          SELECT u.id, COALESCE(SUM(l.delta) FILTER (WHERE ${period[2]}::text IS NULL OR l.created_at > now() - ${period[2] || "0 days"}::interval), 0) AS gained,
                 COALESCE(SUM(l.delta), 0) AS total
          FROM users u LEFT JOIN points_ledger l ON l.user_id = u.id GROUP BY u.id
        )
        SELECT (SELECT COUNT(*) FROM s WHERE s.gained > me.gained OR (s.gained = me.gained AND s.total > me.total))::int + 1 AS rank,
               me.gained::int AS gained, me.total::int AS total
        FROM s me WHERE me.id = ${user.id}`;
      me = r;
      today = await givenToday(user.id);
    }
  } catch (e) {}
  const lv = user ? levelFor(user.points) : null;
  const nx = user ? nextLevel(user.points) : null;
  const pct = lv && nx ? Math.min(100, Math.round(((user.points - lv.min) / (nx.min - lv.min)) * 100)) : 100;

  return (
    <Shell user={user} header="nav">
      <div className="ss-card och">
        {sp.error && <p className="och-note bad">{sp.error}</p>}
        {sp.ok && <p className="och-note info">{sp.ok}</p>}
        <h1>🔥 Асаж буй оч</h1>
        <p className="och-sub">Хамгийн их оч цуглуулж буй гишүүд. Түвшин зөвхөн өөрийн хөдөлмөрөөр олсон очоор ахина.</p>
        <div className="ss-feedtabs och-tabs">
          {PERIODS.map(([k, l]) => <Link key={k} href={`/och?p=${k}`} className={period[0] === k ? "on" : ""}>{l}</Link>)}
        </div>
        <div className="och-board">
          <div className="och-brow head"><span>№</span><span>Хэрэглэгч</span><span>Түвшин</span><span><i className="och-long">{period[0] === "all" ? "Олсон" : period[1]}</i><i className="och-short">Олсон</i></span><span>Данс</span></div>
          {top.length === 0 && <p className="ss-empty">Одоохондоо мэдээлэл алга.</p>}
          {top.map((t, i) => {
            const l = levelFor(t.total);
            return (
              <Link key={t.id} href={`/u/${t.id}`} className={"och-brow" + (user && user.id === t.id ? " me" : "")}>
                <span>{i + 1}</span>
                <span className="och-who"><Avatar user={t} size={28} /><b>{t.initial}.{t.first_name}</b></span>
                <span className="och-lvl"><LevelIcon l={l} size={22} /><span className="och-chip" style={{ "--c": l.color }}>{l.name}</span></span>
                <span className="och-plus"><Num v={t.gained} plus /></span>
                <span><Num v={t.total} /></span>
              </Link>
            );
          })}
          {user && me && !top.some((t) => t.id === user.id) && (
            <>
              <div className="och-dots">· · ·</div>
              <div className="och-brow me">
                <span>{me.rank}</span>
                <span className="och-who"><Avatar user={user} size={28} /><b>{user.initial}.{user.first_name} (та)</b></span>
                <span className="och-lvl"><LevelIcon l={lv} size={22} /><span className="och-chip" style={{ "--c": lv.color }}>{lv.name}</span></span>
                <span className="och-plus"><Num v={me.gained} plus /></span>
                <span><Num v={me.total} /></span>
              </div>
            </>
          )}
        </div>

        <h2 className="och-h1" id="rules">Очны учир</h2>
        <p className="och-sub">Оч олох дүрэм, түвшин, эрхүүд.</p>

        {user && (
          <>
            <h2>Миний түвшин</h2>
            <div className="och-me">
              <div className="och-me-main">
                <LevelIcon l={lv} size={48} />
                <div>
                  <b>Түвшин {lv.n} · {lv.name} <i style={{ color: lv.color }}>· {lv.tagline}</i></b>
                  <span className="och-bar"><span style={{ width: `${pct}%`, background: lv.color }} /></span>
                  <small>{nx ? `${n(user.points)} / ${n(nx.min)} оч · ${nx.name} хүртэл ${n(nx.min - user.points)} оч дутуу` : `${n(user.points)} оч · хамгийн дээд түвшин`}</small>
                </div>
              </div>
              <div className="och-wallet">
                <small>Нийт оч</small>
                <b>✦ {n(user.points)}</b>
                <small>Түвшин тооцогдоно</small>
              </div>
            </div>
          </>
        )}

        <h2 id="daily">Өдрийн оч</h2>
        {user ? (
          <div className="och-me">
            <div className="och-me-main">
              <div>
                <b>Өнөөдөр {today} / {dailyLimit(user)} оч өгсөн</b>
                <span className="och-bar"><span style={{ width: `${Math.min(100, Math.round((today / dailyLimit(user)) * 100))}%`, background: "#ff9500" }} /></span>
                <small>Оч нь «энэ сайн байна» гэсэн таны үнэлгээ. Хамгийн их таалагдсан бичээчдээ хадгалаарай. Шөнө 00:00-д шинэчлэгдэнэ.</small>
              </div>
            </div>
          </div>
        ) : <p className="och-hint">Өдөрт түвшнээсээ хамаарч 5–20 оч өгнө. Дэмжигч +{PREMIUM_DAILY_BONUS}.</p>}
        <p className="och-note info">Сар бүр хамгийн их оч авсан 10 бичээч шагналын сангаас мөнгөн шагнал хүртэнэ. <Link href="/san">Шагналын сан, шилэн данс →</Link></p>

        <h2>Түвшин · очоос хамаарна</h2>
        <p className="och-hint">0 – 999 оч · Түвшин байхгүй (шинэ хэрэглэгч)</p>
        <div className="och-levels">
          {LEVELS.filter((l) => l.n > 0).map((l) => (
            <div key={l.n} className={"och-lrow" + (l.perkLocked ? " dim" : "") + (lv && lv.n === l.n ? " me" : "")}>
              <span className="och-num">{l.n}</span>
              <LevelIcon l={l} />
              <span className="och-lname"><b>{l.name}</b><small>{l.tagline} · өдөрт {l.daily} оч · шагнал ×{l.mult}</small></span>
              <span className="och-min">✦ {n(l.min)}+</span>
              <span className="och-perk">
                {l.perkLocked ? <small>🔒 Эрх түгжээтэй</small> : <b>✓ {l.perk}</b>}
              </span>
            </div>
          ))}
        </div>

        <h2>Оч олох дүрэм</h2>
        <div className="och-rules">
          {ACTIVE.map(([t, d, v]) => (
            <div key={t} className="och-rule"><span><b>{t}</b>{d && <small>{d}</small>}</span><em>{v}</em></div>
          ))}
          <p className="och-soon">Удахгүй нэвтрэх</p>
          {SOON.map(([t, d, v]) => (
            <div key={t} className="och-rule soon"><span><b>{t}</b>{d && <small>{d}</small>}</span><em>{v}</em></div>
          ))}
        </div>

        <p className="och-note warn">Түвшин 6 (Супернова)-аас дээш: нийт очийн дор хаяж 30% нь нийтлэл бичихээс байх ёстой.</p>
        <p className="och-note info">Нийтлэл, мэдээ, эвент, зарлалыг зөвхөн редакц хянадаг. Хянах ажилд оч олгогдохгүй.</p>
        <div className="och-note info">
          <b>Хамгаалалтын дүрэм</b>
          <ul>
            <li>Нэг хүн нэг контентод нэг л удаа оч өгнө. Өөрийн контентод оч өгөх боломжгүй</li>
            <li>Хариултад өгсөн очоо буцаавал өгсөн, авсан оч хоёулаа буцаж хасагдана</li>
            <li>Хууран мэхлэлт илэрвэл оч хасаж түвшинг бууруулна</li>
            <li>Өдрийн хязгаартай: түвшнээсээ хамаарч өдөрт 5–20 оч өгнө (дэмжигч +{PREMIUM_DAILY_BONUS})</li>
            <li>Оч өөрөө мөнгө биш: зөвхөн шагналын сангийн байрыг тодорхойлно</li>
          </ul>
        </div>

      </div>
    </Shell>
  );
}
