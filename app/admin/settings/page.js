import { requireSection } from "@/lib/admin";
import { loadSettings, defaults } from "@/lib/settings";
import { LEVELS } from "@/lib/levels";
import { LIMIT_KEYS, LIMIT_LABEL } from "@/lib/limits";
import { PREMIUM_PLANS, fmtMnt } from "@/lib/money";
import { qpayOn } from "@/lib/qpay";
import { updateSettings } from "./actions";
import Head, { Flash } from "../_c/Head";

// Супер админы тохиргоо: оч ба түвшин, санхүү, сайт
export default async function Settings({ searchParams }) {
  const user = await requireSection("settings");
  const { ok, error } = await searchParams;
  const s = await loadSettings();
  const d = defaults();
  const sup = user.role === "superadmin";
  const num = (name, value, def, props = {}) => (
    <input type="number" name={name} defaultValue={value} required disabled={!sup} title={`Анхны утга: ${def}`} {...props} />
  );

  return (
    <>
      <Head user={user} title="Тохиргоо" sub="Сайтын дүрэм, санхүү, ерөнхий тохиргоо. Хадгалсны дараа 30 секундэд бүх хуудсанд тусна." />
      <Flash ok={ok} error={error} />
      <form action={updateSettings} className="adm-set">
        <div className="adm-grid2">
          <section className="adm-card adm-set">
            <div className="adm-card-head"><b>Оч ба түвшин</b></div>
            <div className="adm-set-lv">
              <small>Түвшин</small><small>Босго (оч)</small><small>Өдөрт өгөх оч</small>
              {LEVELS.map((l, i) => (
                <span key={l.n} style={{ display: "contents" }}>
                  <b>{l.n} · {l.name}</b>
                  {i === 0 ? <span className="adm-muted">0</span> : num(`min${i}`, s.levelMins[i - 1], d.levelMins[i - 1], { min: 1 })}
                  {num(`daily${i}`, s.daily[i], d.daily[i], { min: 0, max: 100 })}
                </span>
              ))}
            </div>
            <div className="adm-set-grid">
              <label>Нийтлэл бичих түвшин{num("articleLevel", s.articleLevel, d.articleLevel, { min: 0, max: 9 })}</label>
              <label>Мэдээ бичих түвшин{num("newsLevel", s.newsLevel, d.newsLevel, { min: 0, max: 9 })}</label>
              <label>Шинэ үг зөвшөөрөх түвшин{num("wordLevel", s.wordLevel, d.wordLevel, { min: 0, max: 9 })}</label>
              <label>Батлагдсан нийтлэлд (оч){num("approveArticle", s.approveArticle, d.approveArticle, { min: 0, max: 1000 })}</label>
              <label>Батлагдсан мэдээнд (оч){num("approveNews", s.approveNews, d.approveNews, { min: 0, max: 1000 })}</label>
              <label>Асуултад хариулахад (оч){num("rw_answer", s.actReward.answer, d.actReward.answer, { min: 0, max: 1000 })}</label>
              <label>Асуулт асуухад (оч){num("rw_ask", s.actReward.ask, d.actReward.ask, { min: 0, max: 1000 })}</label>
              <label>Бодрол хуваалцахад (оч){num("rw_thought", s.actReward.thought, d.actReward.thought, { min: 0, max: 1000 })}</label>
              <label>Зарлал нийтлэгдэхэд (оч){num("rw_announce", s.actReward.announce, d.actReward.announce, { min: 0, max: 5000 })}</label>
              <label>Эвент нийтлэгдэхэд (оч){num("rw_event", s.actReward.event, d.actReward.event, { min: 0, max: 5000 })}</label>
            </div>
            <div className="adm-set-lv">
              <small>Өдрийн хязгаар</small><small>Энгийн</small><small>Дэмжигч</small>
              {LIMIT_KEYS.map((k) => (
                <span key={k} style={{ display: "contents" }}>
                  <b>{LIMIT_LABEL[k][0].toUpperCase() + LIMIT_LABEL[k].slice(1)}</b>
                  {num(`lim_${k}0`, s.dailyPost[k][0], d.dailyPost[k][0], { min: 1, max: 1000 })}
                  {num(`lim_${k}1`, s.dailyPost[k][1], d.dailyPost[k][1], { min: 1, max: 1000 })}
                </span>
              ))}
            </div>
            <p className="adm-muted small">Редакцын хяналтгүй шууд орох контентод өдөрт хэдийг хуваалцахыг заана. Хязгаарт хүрсэн хэрэглэгчийг Дэмжигч болох руу хөтөлнө. Асуулт, бодролын оч өдрийн эхний «Энгийн» тоонд л олгогдоно.</p>
          </section>

          <div className="adm-set">
            <section className="adm-card adm-set">
              <div className="adm-card-head"><b>Санхүү</b></div>
              <div className="adm-set-grid">
                <label>Шагналын санд (%){num("poolShare", s.poolShare, d.poolShare, { min: 0, max: 100 })}</label>
                <label>Урамшууллын шимтгэл (%){num("tipFee", s.tipFee, d.tipFee, { min: 0, max: 50 })}</label>
                <label>QPay-ийн шимтгэл (%){num("qpayFee", s.qpayFee, d.qpayFee, { min: 0, max: 10, step: 0.1 })}</label>
                <label>Татах доод дүн (₮){num("withdrawMin", s.withdrawMin, d.withdrawMin, { min: 1000, step: 1000 })}</label>
                {PREMIUM_PLANS.map((p, i) => (
                  <label key={p.months}>Дэмжигч · {p.label} (₮){num(`plan${i}`, s.plans[i], d.plans[i], { min: 100, step: 100 })}</label>
                ))}
              </div>
              <label>Банкны данс (төлбөрийн зааварт харагдана)
                <textarea name="bankInfo" defaultValue={s.bankInfo} maxLength={500} disabled={!sup} placeholder={process.env.PAY_BANK_INFO ? `Хоосон бол Vercel-ийн PAY_BANK_INFO: ${process.env.PAY_BANK_INFO}` : "Жишээ: Хаан банк 5000xxxxxx, Science Spark ХХК"} />
              </label>
              <p className="adm-muted small">QPay: {qpayOn() ? "холбогдсон, төлбөр автоматаар баталгаажна" : "тохируулаагүй (Vercel: QPAY_USERNAME, QPAY_PASSWORD, QPAY_INVOICE_CODE)"}</p>
              <p className="adm-muted small">Одоогийн үнэ: {PREMIUM_PLANS.map((p) => `${p.label} ${fmtMnt(p.price)}`).join(" · ")}</p>
            </section>

            <section className="adm-card adm-set">
              <div className="adm-card-head"><b>Сайт</b></div>
              <label className="adm-switch"><input type="checkbox" name="registrationOpen" defaultChecked={s.registrationOpen} disabled={!sup} />Шинэ бүртгэл нээлттэй</label>
              <label className="adm-switch"><input type="checkbox" name="maintenance" defaultChecked={s.maintenance} disabled={!sup} />Засвар үйлчилгээний горим (зөвхөн редакц сайтыг харна)</label>
              <label>Сайтын дээд хэсэгт гарах зарлал (хоосон бол харагдахгүй)
                <textarea name="announcement" defaultValue={s.announcement} maxLength={300} disabled={!sup} placeholder="Жишээ: Энэ сарын шагналын сан 500,000₮ боллоо!" />
              </label>
            </section>
          </div>
        </div>
        {sup && <button className="adm-btn dark" style={{ justifySelf: "start" }}>Тохиргоог хадгалах</button>}
      </form>
    </>
  );
}
