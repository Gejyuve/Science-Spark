import Link from "next/link";
import { getUser } from "@/lib/auth";
import { ensureSchema } from "@/lib/db";
import { LEVELS, levelFor, nextLevel, SPARK_GET_WRITING, SPARK_GET_OTHER, PREMIUM_SPARK_WEIGHT, PREMIUM_DAILY_BONUS, FIRST_SPARK_REWARD, APPROVE_REWARD } from "@/lib/levels";
import { TERM_REWARD } from "@/lib/terms";
import { JOIN_REWARD } from "@/lib/clubs-shared";
import { FIRST_REWARD } from "@/lib/celebrate";
import { POINTS_TOTAL } from "@/lib/profile";
import { dailyLimit, givenToday } from "@/lib/spark";
import Shell from "../components/Shell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Очны учир · Science Spark" };

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
  ["Анхны удаагийн шагнал", "Бусдын асуултад өгсөн анхны хариулт, батлагдсан анхны үг, нийтлэл тус бүрт 1 л удаа", `+${FIRST_REWARD}`],
];
// Удахгүй нэвтрэх (Figma: Очны дүрэм)
const SOON = [
  ["Асуултад хариулах", "Нэг асуултад 1 л удаа", "+10"],
  ["Асуулт асуух", "", "+50"],
  ["Бодрол хуваалцах", "", "+100"],
  ["Зарлал хуваалцах", "Нийтлэгдвэл", "+200"],
  ["Эвент хуваалцах", "Нийтлэгдвэл", "+500"],
];
function LevelIcon({ l, size = 36 }) {
  if (!l.n) return <span className="och-lv" style={{ "--c": l.color, width: size, height: size }}>·</span>;
  return <img className="och-lvi" src={`/icons/lv${l.n}.svg`} width={size} height={size} alt={`Түвшин ${l.n} · ${l.name}`} style={{ "--c": l.color }} />;
}

export default async function Och({ searchParams }) {
  const sp = await searchParams;
  let user = null, today = 0;
  try {
    user = await getUser();
    await ensureSchema();
    if (user) today = await givenToday(user.id);
  } catch (e) {}
  const lv = user ? levelFor(user.points) : null;
  const nx = user ? nextLevel(user.points) : null;
  const pct = lv && nx ? Math.min(100, Math.round(((user.points - lv.min) / (nx.min - lv.min)) * 100)) : 100;

  return (
    <Shell user={user} header="nav">
      <div className="ss-card och">
        {sp.error && <p className="och-note bad">{sp.error}</p>}
        {sp.ok && <p className="och-note info">{sp.ok}</p>}
        <h1 id="rules">✦ Очны учир</h1>
        <p className="och-sub">Оч олох дүрэм, түвшин, эрхүүд. Түвшин зөвхөн өөрийн хөдөлмөрөөр олсон очоор ахина. Шилдэг бичээчдийн жагсаалтыг <Link href="/san#board">Шагнал</Link> хуудаснаас үзнэ үү.</p>

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
