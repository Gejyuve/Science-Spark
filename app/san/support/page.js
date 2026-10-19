import Link from "next/link";
import { redirect } from "next/navigation";
import { sql, ensureSchema } from "@/lib/db";
import { getUser, isPremium } from "@/lib/auth";
import { PREMIUM_PLANS, DONATION_MIN, DONATION_MAX, POOL_SHARE, TIP_FEE, fmtMnt } from "@/lib/money";
import { PREMIUM_SPARK_WEIGHT, PREMIUM_DAILY_BONUS } from "@/lib/levels";
import { createSupport } from "../actions";
import Shell from "../../components/Shell";
import { Avatar } from "../../components/Bits";

export const dynamic = "force-dynamic";
export const metadata = { title: "Дэмжих · Science Spark" };

const pct = (x) => `${Math.round(x * 100)}%`;
const AMOUNTS = [5000, 10000, 20000, 50000];

// Премиумын давуу тал: сайтыг дэмжсэн сэтгэлийн ханамж хамгийн түрүүнд
const PERKS = [
  ["💚", "Шинжлэх ухааныг дэмжигч", "Таны төлбөрийн " + pct(POOL_SHARE) + " нь шууд бичээчдийн шагналын санд орно"],
  ["🚫", "Сурталчилгаагүй", "Сайтыг ямар ч сурталчилгаагүй уншина"],
  ["🎬", "Видео контент", "Удахгүй нээгдэх шинжлэх ухааны видеонуудыг үзнэ"],
  ["✦", `Таны оч ×${PREMIUM_SPARK_WEIGHT}`, "Таны өгсөн оч бичээчийн шагналд хоёр дахин тооцогдоно"],
  ["🔥", `Өдөрт +${PREMIUM_DAILY_BONUS} оч`, "Илүү олон бичээчийг үнэлж урамшуулна"],
  ["⚡", "Дэмжигч тэмдэг", "Таны нэрийн хажууд түвшний тэмдгийн дэргэд харагдана"],
];

export default async function Support({ searchParams }) {
  const sp = await searchParams;
  const user = await getUser();
  if (!user) redirect("/login");
  await ensureSchema();
  const kind = ["premium", "pool", "tip"].includes(sp.kind) ? sp.kind : "premium";
  let writer = null, post = null;
  if (kind === "tip") {
    const to = Number(sp.to);
    if (Number.isInteger(to)) [writer] = await sql`SELECT id, initial, first_name, avatar_id AS avatar FROM users WHERE id = ${to} AND first_name <> ''`;
    if (!writer) redirect("/san?error=" + encodeURIComponent("Бичээч олдсонгүй"));
    if (writer.id === user.id) redirect("/wallet");
    const p = Number(sp.post);
    if (Number.isInteger(p)) [post] = await sql`SELECT id, title FROM posts WHERE id = ${p} AND author_id = ${writer.id}`;
  }
  const premium = isPremium(user);

  return (
    <Shell user={user} active="/san" header="nav">
      <div className="ss-card och san">
        <Link href="/san" className="san-back">← Шагналын сан</Link>
        {sp.error && <p className="och-note bad">{sp.error}</p>}
        <div className="ss-feedtabs och-tabs">
          <Link href="/san/support?kind=premium" className={kind === "premium" ? "on" : ""}>Дэмжигч болох</Link>
          <Link href="/san/support?kind=pool" className={kind === "pool" ? "on" : ""}>Сан руу хандив</Link>
          {writer && <Link href={`/san/support?kind=tip&to=${writer.id}${post ? `&post=${post.id}` : ""}`} className="on">Бичээчид</Link>}
        </div>

        {kind === "premium" && (
          <>
            <h1>Шинжлэх ухааны дэмжигч болох</h1>
            <p className="och-sub">Таны дэмжлэг Монголын шинжлэх ухааны бичээчид, ирээдүйн залуу судлаачдад хүрнэ. Сайтын сервер, редакцын ажлыг ч тэтгэнэ.</p>
            {premium && <p className="och-note info">Та {new Date(user.premium_until).toLocaleDateString("sv-SE")} хүртэл дэмжигч. Баярлалаа! Доороос сунгах боломжтой.</p>}
            <div className="san-perks">
              {PERKS.map(([i, t, d]) => <div key={t}><span>{i}</span><b>{t}</b><small>{d}</small></div>)}
            </div>
          </>
        )}
        {kind === "pool" && (
          <>
            <h1>Шагналын санд хандив өгөх</h1>
            <p className="och-sub">Сан руу өгсөн хандив бүтнээрээ сар бүрийн шилдэг бичээчдэд хуваарилагдана. Сайт шимтгэл авахгүй.</p>
          </>
        )}
        {kind === "tip" && (
          <>
            <h1>Бичээчийг дэмжих</h1>
            <div className="san-to">
              <Avatar user={writer} size={44} />
              <span><b>{writer.initial}.{writer.first_name}</b>{post && <small>«{post.title}»</small>}</span>
            </div>
            <p className="och-sub">Таны хандив бичээчийн хэтэвчид орж, тэр цааш бичих урам авна. Сайтыг ажиллуулахад {pct(TIP_FEE)} шимтгэл суутгана.</p>
          </>
        )}

        <form action={createSupport} className="san-form">
          <input type="hidden" name="kind" value={kind} />
          {writer && <input type="hidden" name="writer_id" value={writer.id} />}
          {post && <input type="hidden" name="post_id" value={post.id} />}
          {kind === "premium" ? (
            <div className="san-plans">
              {PREMIUM_PLANS.map((p, i) => (
                <label key={p.months} className="san-plan">
                  <input type="radio" name="months" value={p.months} defaultChecked={i === 0} />
                  <span>
                    <b>{p.label}</b>
                    <em>{fmtMnt(p.price)}</em>
                    <small>{p.months > 1 ? `сард ${fmtMnt(Math.round(p.price / p.months))}` : "сар бүр сунгана"}</small>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <>
              <div className="san-amounts">
                {AMOUNTS.map((a) => (
                  <label key={a} className="san-amt"><input type="radio" name="amount" value={a} defaultChecked={a === 10000} /><span>{fmtMnt(a)}</span></label>
                ))}
              </div>
              <label className="san-field">Өөр дүн (₮)
                <input name="amount_custom" inputMode="numeric" placeholder={`${fmtMnt(DONATION_MIN)} – ${fmtMnt(DONATION_MAX)}`} />
              </label>
              <label className="san-field">Захидал (заавал биш)
                <textarea name="message" maxLength={300} rows={2} placeholder={kind === "tip" ? "Бичээчдээ урам өгөх үг…" : "Залуу судлаачдад хэлэх үг…"} />
              </label>
              <label className="san-check"><input type="checkbox" name="anonymous" /> Нэрээ нууцлах (топ хандивлагчдын жагсаалтад харагдахгүй)</label>
            </>
          )}
          <button className="ss-pill">{kind === "premium" ? "Дэмжигч болох" : "Хандив өгөх"}</button>
          <p className="och-hint">Дараагийн алхамд шилжүүлгийн код, дансны мэдээлэл гарна. Шилжүүлэг ирмэгц редакц баталгаажуулна.</p>
        </form>
      </div>
    </Shell>
  );
}
