import Link from "next/link";
import { getUser, isPremium, isStaff } from "@/lib/auth";
import { ensureSchema } from "@/lib/db";
import { LEVELS, levelFor, nextLevel, SPARK_GET_WRITING, SPARK_GET_OTHER, PREMIUM_SPARK_WEIGHT, PREMIUM_DAILY_BONUS, FIRST_SPARK_REWARD, APPROVE_REWARD } from "@/lib/levels";
import { TERM_REWARD } from "@/lib/terms";
import { JOIN_REWARD } from "@/lib/clubs-shared";
import { FIRST_REWARD } from "@/lib/celebrate";
import { POINTS_TOTAL } from "@/lib/profile";
import { dailyLimit, givenToday } from "@/lib/spark";
import { ACT_REWARD, DAILY_POST, LIMIT_KEYS, LIMIT_LABEL, postLimit, postedToday } from "@/lib/limits";
import { supportModalProps } from "@/lib/supportModal";
import SupportModal from "../components/SupportModal";
import Shell from "../components/Shell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Очны учир · Science Spark" };

const n = (x) => Number(x || 0).toLocaleString("en-US");

// Одоо ажиллаж буй дүрэм. Тохиргоогоор өөрчлөгдөх утгуудыг хүсэлт бүрт уншина.
const active = () => [
  ["Нийтлэл, мэдээндээ оч авах", "Нэг хүнээс 1 л удаа · дэмжигчийн оч ×" + PREMIUM_SPARK_WEIGHT, `+${SPARK_GET_WRITING}`],
  ["Асуулт, бодрол, хариултдаа оч авах", "Нэг хүнээс 1 л удаа · дэмжигчийн оч ×" + PREMIUM_SPARK_WEIGHT, `+${SPARK_GET_OTHER}`],
  ["Нийтлэл редакцаар батлагдах", "Нийтлэгдэхэд 1 л удаа", `+${APPROVE_REWARD["Нийтлэл"]}`],
  ["Мэдээ редакцаар батлагдах", "Нийтлэгдэхэд 1 л удаа", `+${APPROVE_REWARD["Мэдээ"]}`],
  ["Асуултад хариулах", "Бусдын асуултад, нэг асуултад 1 л удаа", `+${ACT_REWARD.answer}`],
  ["Асуулт асуух", `Өдрийн эхний ${DAILY_POST.ask[0]} асуултад`, `+${ACT_REWARD.ask}`],
  ["Бодрол хуваалцах", `Өдрийн эхний ${DAILY_POST.thought[0]} бодролд`, `+${ACT_REWARD.thought}`],
  ["Зарлал хуваалцах", "Редакц баталж нийтлэгдвэл", `+${ACT_REWARD.announce}`],
  ["Эвент хуваалцах", "Редакц баталж нийтлэгдвэл", `+${ACT_REWARD.event}`],
  ["Анхны очоо өгөх", "Оч өгөх нь үнэгүй дохио: өгсөн хүнд оч нэмэгдэхгүй", `+${FIRST_SPARK_REWARD}`],
  ["Профайлаа бөглөх", "Талбар бүрд нэг л удаа", `+${POINTS_TOTAL} хүртэл`],
  ["Шинэ үг нэмэх", "Толинд нэмсэн үг батлагдвал", `+${TERM_REWARD}`],
  ["Клубт элсэх", "Анхны клубт 1 л удаа", `+${JOIN_REWARD}`],
  ["Анхны удаагийн шагнал", "Бусдын асуултад өгсөн анхны хариулт, батлагдсан анхны үг, нийтлэл тус бүрт 1 л удаа", `+${FIRST_REWARD}`],
];
const cap = (t) => t[0].toUpperCase() + t.slice(1);
function LevelIcon({ l, size = 36 }) {
  if (!l.n) return <span className="och-lv" style={{ "--c": l.color, width: size, height: size }}>·</span>;
  return <img className="och-lvi" src={`/icons/lv${l.n}.svg`} width={size} height={size} alt={`Түвшин ${l.n} · ${l.name}`} style={{ "--c": l.color }} />;
}

export default async function Och({ searchParams }) {
  const sp = await searchParams;
  let user = null, today = 0, posted = {};
  try {
    user = await getUser();
    await ensureSchema();
    if (user) {
      today = await givenToday(user.id);
      for (const k of LIMIT_KEYS) posted[k] = await postedToday(user.id, k);
    }
  } catch (e) {}
  const hit = LIMIT_KEYS.includes(sp.limit) ? sp.limit : null;
  const prem = !!user && isPremium(user);
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
        <p className="och-hint">0 – {n(LEVELS[1].min - 1)} оч · Түвшин байхгүй (шинэ хэрэглэгч)</p>
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
          {active().map(([t, d, v]) => (
            <div key={t} className="och-rule"><span><b>{t}</b>{d && <small>{d}</small>}</span><em>{v}</em></div>
          ))}
        </div>

        <h2 id="limits">Өдрийн хуваалцах хязгаар</h2>
        {hit && (
          <div className="och-note warn och-limit">
            <b>Өнөөдрийн {LIMIT_LABEL[hit]} хуваалцах хязгаартаа ({user ? postLimit(user, hit) : DAILY_POST[hit][0]}) хүрлээ.</b>
            {prem ? (
              <span>Шөнө 00:00-д дахин нээгдэнэ. Шинжлэх ухааныг дэмжиж байгаад баярлалаа!</span>
            ) : (
              <>
                <span>Шөнө 00:00-д дахин нээгдэнэ. Дэмжигч болбол өдөрт {DAILY_POST[hit][1]} хүртэл {LIMIT_LABEL[hit]} хуваалцаж, сайт, бичээчид, шинэ үеийн судлаачдыг дэмжинэ.</span>
                <SupportModal kind="premium" label="Дэмжигч болох" className="ss-pill" {...supportModalProps(user)} />
              </>
            )}
          </div>
        )}
        <p className="och-hint">Асуулт, бодрол, сэтгэгдэл редакцын хяналтгүй шууд нийтлэгддэг тул өдөрт хуваалцах тоо хязгаартай. Шөнө 00:00-д шинэчлэгдэнэ.</p>
        <div className="och-rules">
          {LIMIT_KEYS.map((k) => (
            <div key={k} className="och-rule">
              <span><b>{cap(LIMIT_LABEL[k])}</b><small>{user && !isStaff(user) ? `Өнөөдөр ${posted[k] ?? 0} / ${postLimit(user, k)}` : user ? "Редакцад хязгааргүй" : "Өдөрт"}</small></span>
              <em>{prem ? <><img className="och-bolt" src="/icons/bolt.svg" width={11} height={11} alt="Дэмжигч" /> {DAILY_POST[k][1]}</> : <>{DAILY_POST[k][0]} · <img className="och-bolt" src="/icons/bolt.svg" width={11} height={11} alt="Дэмжигч" /> {DAILY_POST[k][1]}</>}</em>
            </div>
          ))}
        </div>
        {!hit && user && !prem && !isStaff(user) && (
          <p className="och-note info">Илүү ихийг хуваалцмаар байна уу? Дэмжигч өдөрт {DAILY_POST.ask[1]} асуулт, {DAILY_POST.thought[1]} бодрол, {DAILY_POST.comment[1]} сэтгэгдэл бичнэ. <SupportModal kind="premium" label="Дэмжигч болох →" className="och-link" {...supportModalProps(user)} /></p>
        )}

        <div className="och-note info">
          <b>Бяцхан дүрэм</b>
          <ul>
            <li>Нийтлэл, мэдээ, эвент, зарлалыг зөвхөн редакц хянадаг. Хянах ажилд оч олгогдохгүй</li>
            <li>Нэг хүн нэг контентод нэг л удаа оч өгнө. Өөрийн контентод оч өгөх боломжгүй</li>
            <li>Асуулт, бодрол, эвент, зарлалаа устгавал эсвэл редакц нуувал хуваалцсаны оч буцаж хасагдана</li>
            <li>Хариултад өгсөн очоо буцаавал өгсөн, авсан оч хоёулаа буцаж хасагдана</li>
            <li>Хууран мэхлэлт илэрвэл оч хасаж түвшинг бууруулна</li>
            <li>Өдрийн хязгаартай: түвшнээсээ хамаарч өдөрт 5–20 оч өгнө (дэмжигч +{PREMIUM_DAILY_BONUS})</li>
            <li>Асуулт, бодрол, сэтгэгдэл өдрийн хязгаартай. Асуулт, бодролын оч өдрийн эхний {DAILY_POST.ask[0]}, {DAILY_POST.thought[0]}-д л олгогдоно</li>
            <li>Оч өөрөө мөнгө биш: зөвхөн шагналын сангийн байрыг тодорхойлно</li>
          </ul>
        </div>

      </div>
    </Shell>
  );
}
