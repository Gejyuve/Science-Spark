import Link from "next/link";
import { getUser } from "@/lib/auth";
import { sql, ensureSchema } from "@/lib/db";
import { LEVELS, ARTICLE_LEVEL, NEWS_LEVEL, SPARK_GET_WRITING, SPARK_GET_OTHER, PREMIUM_SPARK_WEIGHT, PREMIUM_DAILY_BONUS, APPROVE_REWARD } from "@/lib/levels";
import { PREMIUM_PLANS, POOL_SHARE, TIP_FEE, WITHDRAW_MIN, fmtMnt } from "@/lib/money";
import { JOIN_REWARD, COOLDOWN_MONTHS } from "@/lib/clubs-shared";
import { REFERRAL_REWARD } from "@/lib/referral-shared";
import { HELP_TOPICS, HELP_LABEL, HELP_TYPES, HELP_OPEN_MAX } from "@/lib/help";
import { relTime } from "@/lib/format";
import Shell from "../components/Shell";
import PageHero from "../components/PageHero";
import { sendHelp } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Тусламж · Science Spark" };

const n = (x) => Number(x || 0).toLocaleString("en-US");
const lv = (k) => `Түвшин ${k} (${LEVELS[k]?.name}, ${n(LEVELS[k]?.min)} оч)`;
const STATUS = { open: ["Хянагдаж байна", "wait"], resolved: ["Шийдвэрлэсэн", "ok"], dismissed: ["Хариу өгсөн", "gray"] };

// Түгээмэл асуулт. Тоонууд нь дүрмийн одоогийн утгаас (супер админ Тохиргооноос өөрчилнө) шууд авна.
function faq() {
  return [
    ["start", "🚀", "Эхлэх", [
      ["Science Spark гэж юу вэ?", <>Шинжлэх ухаанд дуртай монголчууд нийтлэл, мэдээ, асуулт, бодролоо хуваалцаж, клубээрээ нэгдэж, хамтдаа суралцдаг орон зай. Таны бичсэн бүхэн дараагийн үеийнхэнд шинжлэх ухааныг ойртуулна.</>],
      ["Хэрхэн бүртгүүлэх вэ?", <><Link href="/login">Нэвтрэх</Link> цонхонд и-мэйл, нууц үгээ бичнэ. Бүртгэлгүй и-мэйл бол нууц үгээ дахин бичүүлж шинэ хаяг үүсгэнэ. Дараа нь профайлаа бөглөхөд оч нэмэгдэнэ.</>],
      ["Нууц үгээ мартсан бол?", <><Link href="/forgot">Нууц үг сэргээх</Link> хуудсанд и-мэйлээ бичихэд сэргээх холбоос и-мэйлээр очно. Холбоос 1 цагийн дотор хүчинтэй.</>],
      ["Найзаа урих боломжтой юу?", <>Шинэ хэрэглэгч бүртгүүлэхдээ «Хаанаас сонссон бэ?» асуултад таныг сонговол та +{REFERRAL_REWARD} оч авна.</>],
    ]],
    ["spark", "✦", "Оч ба түвшин", [
      ["Оч гэж юу вэ?", <>Оч бол «энэ сайн байна» гэсэн дохио. Бусад таны нийтлэл, мэдээнд оч өгөхөд +{SPARK_GET_WRITING}, асуулт, бодрол, хариултад өгөхөд +{SPARK_GET_OTHER} оч нэмэгдэнэ. Нэг хүн нэг контентод нэг л удаа оч өгнө.</>],
      ["Өдөрт хэдэн оч өгч болох вэ?", <>Түвшнээсээ хамаарч өдөрт {LEVELS[0].daily}–{LEVELS[LEVELS.length - 1].daily} оч өгнө. Оч өгөх нь үнэгүй бөгөөд өгсөн хүнд оноо нэмэгдэхгүй.</>],
      ["Түвшин хэрхэн ахих вэ?", <>Түвшин зөвхөн өөрийн хөдөлмөрөөр олсон очоор ахина. Бүх түвшин, эрхийг <Link href="/och">Очны учир</Link> хуудаснаас үзээрэй.</>],
      ["Шагналын сан гэж юу вэ?", <>Дэмжигчдийн орлогын {Math.round(POOL_SHARE * 100)}% болон хандив сард нэг удаа хамгийн их оч олсон 10 бичээчид түвшнээр нь жинлэн хуваагдана. Жагсаалт, сангийн гүйлгээг <Link href="/san">Шагнал</Link> хуудаснаас ил тод харна.</>],
    ]],
    ["write", "✍️", "Бичих ба редакц", [
      ["Хэн нийтлэл, мэдээ бичих вэ?", <>Нийтлэл бичихэд {lv(ARTICLE_LEVEL)}, мэдээ бичихэд {lv(NEWS_LEVEL)} хүрсэн байх хэрэгтэй. Асуулт, бодрол, хариултыг хэн ч бичнэ.</>],
      ["Нийтлэл хэрхэн нийтлэгдэх вэ?", <>Нийтлэл, мэдээг редакц хянаад шууд нийтэлнэ. Батлагдвал нийтлэлд +{APPROVE_REWARD["Нийтлэл"]}, мэдээнд +{APPROVE_REWARD["Мэдээ"]} оч авна. Засвар хэрэгтэй бол тайлбартай буцаана.</>],
      ["Редакц миний нийтлэлийг зассан бол?", <>Редакцын засварыг профайлынхаа «Редакцаас хариу ирсэн» хэсгээс харна. Санал нийлэхгүй бол яг тэр засвар дээрээс «Гомдол гаргах» товчоор гомдол гаргана.</>],
      ["Нийтлэлд алдаа олсон бол?", <>Нийтлэлийн доорх «Логик алдаа мэдэгдэх» (туг) товчоор редакцад мэдэгдээрэй. Засагдмагц танд мэдэгдэл очно.</>],
    ]],
    ["club", "🔬", "Клуб ба байгууллага", [
      ["Клубт хэрхэн нэгдэх вэ?", <><Link href="/clubs">Клубүүд</Link> хуудаснаас клубээ сонгоод хүсэлт илгээнэ. Нэг хүн нэг л клубт байна. Анхны клубтээ нэгдэхэд +{JOIN_REWARD} оч авна. Клубээс гарсан бол {COOLDOWN_MONTHS} сарын дараа дахин нэгдэнэ.</>],
      ["Клубийн нэрээр хэрхэн нийтлэх вэ?", <>Зөвхөн клубийн удирдагч баруун цэсний «Профайл солих» товчоор клубийн хаяг руу шилжиж нийтэлнэ. Клубийн нийтлэлд ирсэн оч клубт очно.</>],
      ["Даалгавар, тайлан гэж юу вэ?", <>Клубүүд туршилт, эвентийн санааг <Link href="/tasks">Даалгавар</Link> болгон хуваалцаж, хийж үзээд <Link href="/reports">Тайлан</Link> бичнэ. Тайланг редакц шалгаж оч олгоно.</>],
      ["Байгууллага бүртгүүлэх үү?", <>Нэг хүн нэг байгууллага бүртгүүлнэ. Бүртгүүлсэн хүн админ болох бөгөөд эрхээ өөр хүнд шилжүүлж болно.</>],
    ]],
    ["money", "💚", "Дэмжигч ба хэтэвч", [
      ["Дэмжигч болбол юу авах вэ?", <>Сарын {fmtMnt(PREMIUM_PLANS[0].price)}-өөр сайт, шинжлэх ухааны уран зохиол, бичээчдийг дэмжинэ. Сурталчилгаагүй үзэх, таны оч ×{PREMIUM_SPARK_WEIGHT} жинтэй, өдөрт +{PREMIUM_DAILY_BONUS} оч өгөх эрх, дэмжигчийн тэмдэг авна.</>],
      ["Бичээчийг хэрхэн урамшуулах вэ?", <>Нийтлэлийн доорх 🎁 «Шагнал» товчоор. Мөнгө бичээчийн сайт дээрх хэтэвчид орно, сайтын шимтгэл {Math.round(TIP_FEE * 100)}%.</>],
      ["Хэтэвчнээс мөнгөө хэрхэн авах вэ?", <><Link href="/wallet">Хэтэвч</Link> хуудаснаас үлдэгдэл {fmtMnt(WITHDRAW_MIN)} хүрмэгц татах хүсэлт илгээнэ. Шилжүүлгийг редакц баталгаажуулна.</>],
    ]],
    ["rules", "🛡️", "Дүрэм ба аюулгүй байдал", [
      ["Ямар контент хориотой вэ?", <>Сурталчилгаа, спам, хүнийг доромжилсон, худал мэдээлэл бүхий контентыг редакц нууна.</>],
      ["Сануулга авсан бол?", <>Сануулгаа профайлын «Редакцаас хариу ирсэн» хэсгээс харж, хариу бичиж болно. Хоёр дахь сануулгын дараа хаяг хязгаарлагдана.</>],
    ]],
  ];
}

export default async function Help({ searchParams }) {
  const sp = await searchParams;
  let user = null, mine = [];
  try {
    user = await getUser();
    await ensureSchema();
    if (user) {
      mine = await sql`SELECT id, type, body, status, note, created_at, resolved_at FROM logic_reports
                       WHERE user_id = ${user.id} AND type = ANY(${HELP_TYPES}) ORDER BY id DESC LIMIT 20`;
    }
  } catch (e) {}
  const open = mine.filter((m) => m.status === "open").length;
  const groups = faq();
  const pick = HELP_LABEL[sp.t] ? sp.t : "general";

  return (
    <Shell user={user} active="/help" header={false}>
      <div className="hp-page">
        <PageHero tone="help" title="Тусламж" text="Түгээмэл асуултын хариу, сайтын дүрэм. Хариугаа олохгүй бол редакцад шууд хандаарай, бид туслахдаа баяртай байна.">
          <a href="#send" className="ph-btn solid">Гомдол гаргах</a>
          {user && mine.length > 0 && <a href="#mine" className="ph-btn"><span className="e">📬</span><b>Миний хүсэлтүүд</b><small>{open ? `${open} хүлээгдэж буй` : mine.length}</small></a>}
        </PageHero>

        <nav className="hp-topics" aria-label="Сэдвүүд">
          {groups.map(([id, e, t]) => <a key={id} href={`#${id}`}><span>{e}</span>{t}</a>)}
        </nav>

        {groups.map(([id, e, title, qs]) => (
          <section key={id} id={id} className="ss-card hp-group">
            <h2><span aria-hidden="true">{e}</span>{title}</h2>
            {qs.map(([q, a]) => (
              <details key={q} className="hp-q">
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </section>
        ))}

        <section id="send" className="ss-card hp-send">
          <h2><span aria-hidden="true">📮</span>Гомдол гаргах, редакцад хандах</h2>
          <p className="hp-sub">Гомдол, сайтын алдаа, санаагаа бичээрэй. Редакц хариу өгмөгц танд мэдэгдэл очих бөгөөд хариуг энэ хуудасны «Миний хүсэлтүүд» хэсгээс харна.
            Редакцын засвар, сануулгад гомдолтой бол {user ? <Link href={`/u/${user.id}?tab=replied`}>профайлын «Редакцаас хариу ирсэн»</Link> : "профайлын «Редакцаас хариу ирсэн»"} хэсгээс тухайн засвар дээр нь гаргавал илүү хурдан шийдвэрлэгдэнэ.</p>
          {sp.error && <p className="och-note bad">{sp.error}</p>}
          {sp.ok && <p className="och-note info">{sp.ok}</p>}
          {!user ? (
            <div className="hp-login">
              <p>Гомдол, санал илгээхийн тулд нэвтэрнэ үү.</p>
              <Link href="/login" className="ss-pill">Нэвтрэх</Link>
            </div>
          ) : open >= HELP_OPEN_MAX ? (
            <p className="och-note warn">Таны {HELP_OPEN_MAX} хүсэлт хянагдаж байна. Хариу ирсний дараа шинээр илгээнэ үү.</p>
          ) : (
            <form action={sendHelp} className="hp-form">
              <fieldset className="hp-types">
                <legend>Юуны тухай вэ?</legend>
                {HELP_TOPICS.map(([k, l, hint]) => (
                  <label key={k}>
                    <input type="radio" name="type" value={k} defaultChecked={k === pick} required />
                    <span><b>{l}</b><small>{hint}</small></span>
                  </label>
                ))}
              </fieldset>
              <label className="hp-body">
                <span>Дэлгэрэнгүй</span>
                <textarea name="body" rows={5} minLength={10} maxLength={1000} required placeholder="Юу болсон, хаана, хэзээ гэдгийг тодорхой бичвэл бид хурдан туслана. Холбоос байвал хуулж оруулаарай." />
              </label>
              <div className="hp-go">
                <small>Редакцын гишүүд л уншина.</small>
                <button type="submit" className="ss-pill">Илгээх</button>
              </div>
            </form>
          )}
        </section>

        {user && mine.length > 0 && (
          <section id="mine" className="ss-card hp-mine">
            <h2><span aria-hidden="true">📬</span>Миний хүсэлтүүд</h2>
            {mine.map((m) => {
              const [label, tone] = STATUS[m.status] || STATUS.open;
              return (
                <article key={m.id} className="hp-item">
                  <header>
                    <b>{HELP_LABEL[m.type]}</b>
                    <small>{relTime(m.created_at).text}</small>
                    <em className={`hp-st ${tone}`}>{label}</em>
                  </header>
                  <p>{m.body}</p>
                  {m.note && <p className="hp-reply"><b>Редакцын хариу:</b> {m.note}</p>}
                </article>
              );
            })}
          </section>
        )}
      </div>
    </Shell>
  );
}
