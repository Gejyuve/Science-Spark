"use client";

import { useActionState, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { startSupport } from "../san/actions";
import QpayBox from "./QpayBox";
import Spark from "./Spark";

const fmt = (n) => `${Math.round(Number(n || 0)).toLocaleString("en-US")}₮`;
// Урамшуулал, хандив, цэнэглэлтийн дүн бүх цонхонд ижил: аяга кофе, ном, пуужин
const AMOUNTS = [[5000, "☕"], [20000, "📖"], [100000, "🚀"]];
// Баярын цацраг: өнгө, байрлал, хоцролт
const BITS = Array.from({ length: 18 }, (_, i) => ({ c: ["#37c3b3", "#ffb547", "#ff7aa8", "#7fd6ff", "#9be15d"][i % 5], x: (i * 37) % 100, d: (i % 6) * 0.35, s: 6 + (i % 4) * 2 }));

function Confetti({ burst }) {
  return (
    <span className={"sm-confetti" + (burst ? " burst" : "")} aria-hidden="true">
      {BITS.map((b, i) => <i key={i} style={{ "--c": b.c, "--x": `${b.x}%`, "--d": `${b.d}s`, "--s": `${b.s}px` }} />)}
    </span>
  );
}

// «Дэмжигч болох», «Хандив өгөх», бичээчид «Шагнал» өгөх, «Хэтэвч цэнэглэх» цонх. Хуудаснаас гаралгүй шилжүүлгийн код гаргана.
export default function SupportModal({ kind, label, className = "", loggedIn, premium, plans, perks, bank, min, max, poolShare, writer, postId, autoOpen = false }) {
  const [open, setOpen] = useState(autoOpen);
  const [mounted, setMounted] = useState(false);
  const [amount, setAmount] = useState(20000);
  const [custom, setCustom] = useState("");
  const [months, setMonths] = useState(plans?.[0]?.months || 1);
  const [copied, setCopied] = useState(false);
  const [state, action, pending] = useActionState(startSupport, null);
  const [shown, setShown] = useState(null); // энэ удаад нээгдэхэд гарсан хариу
  const [paid, setPaid] = useState(false); // QPay-ээр төлөгдсөн
  useEffect(() => setMounted(true), []);
  useEffect(() => { if (state) setShown(state); }, [state]);
  useEffect(() => {
    if (!open) return;
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [open]);

  if (!loggedIn) return <Link href="/login" className={className}>{label}</Link>;
  const isPrem = kind === "premium";
  const isTip = kind === "tip";
  const isTop = kind === "topup";
  const done = shown?.code ? shown : null;
  const qp = done?.qpay && !paid ? done.qpay : null; // QPay-ээр төлөхийг хүлээж буй
  const sum = isPrem ? plans.find((p) => p.months === months)?.price : Number(custom.replace(/[^\d]/g, "")) || amount;
  const close = () => { setOpen(false); setShown(null); setCopied(false); setPaid(false); };

  const steps = done && (
    <ol className="sm-steps">
      <li>
        <span>Гүйлгээний утганд энэ кодыг бичнэ</span>
        <div className="sm-code">
          <b>{done.code}</b>
          <button type="button" className={"sm-copy" + (copied ? " ok" : "")} onClick={async () => {
            try { await navigator.clipboard.writeText(done.code); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch (e) {}
          }}>{copied ? "✓ Хуулсан" : "Хуулах"}</button>
        </div>
      </li>
      <li>
        <span>{fmt(done.amount)}-г шилжүүлнэ</span>
        {bank ? <em>{bank}</em> : <em>Дансны мэдээлэл удахгүй нэмэгдэнэ. Одоохондоо редакцтай холбогдоно уу.</em>}
      </li>
      <li><span>Шилжүүлэг ирмэгц редакц баталгаажуулж, танд мэдэгдэл ирнэ</span></li>
    </ol>
  );

  const modal = open && (
    <div className="tm-overlay" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className={"sm-modal" + (done ? " done" : "")} role="dialog" aria-modal="true" aria-labelledby="sm-h">
        <div className="sm-hero">
          <Confetti burst={!!done && !qp} />
          <button type="button" className="tm-x sm-x" onClick={close} aria-label="Хаах">×</button>
          <span className="sm-ic">{isPrem ? <img src="/icons/bolt.svg" width={34} height={34} alt="" /> : isTip ? <img src="/icons/gift.svg" width={30} height={30} alt="" /> : isTop ? "🏆" : done ? "🎉" : "✦"}</span>
          <b id="sm-h">{qp ? "Нэг алхам үлдлээ" : done ? "Баярлалаа!" : isPrem ? (premium ? "Дэмжлэгээ сунгах" : "Шинжлэх ухааны дэмжигч болох") : isTip ? `${writer.name}-г урамшуулах` : isTop ? "Хэтэвч цэнэглэх" : "Шагналын санд хандив өгөх"}</b>
          <p>
            {qp ? "QPay-ээр төлмөгц таны дэмжлэг тэр дор нь баталгаажиж, шинжлэх ухааны бичээчдэд хүрнэ."
              : done && paid ? (isPrem ? "Та шинжлэх ухааны дэмжигчдийн гэр бүлд нэгдлээ. Таны сэтгэл Монголын бичээчдийн дараагийн нийтлэлийг асаана." : isTip ? `Таны урамшуулал ${writer.name}-д хүрлээ. Энэ нь дараагийн бүтээлийг нь асаах урам болно.` : isTop ? "Мөнгө хэтэвчинд тань орлоо. Асуултдаа шагнал тавьж, мэдлэгээ хуваалцсан хүмүүсийг урамшуулаарай." : "Таны хандив шагналын санд орлоо. Ийм хүмүүс байгаа цагт мэдлэг цацарсаар байна.")
              : done
              ? isPrem ? "Та шинжлэх ухааны дэмжигчдийн гэр бүлд нэгдлээ. Таны сэтгэл Монголын бичээчдийн дараагийн нийтлэлийг асаана." : isTip ? `Таны урамшуулал ${writer.name}-д хүрч, дараагийн бүтээлийг нь асаах урам болно.` : isTop ? "Шилжүүлэг ирмэгц мөнгө хэтэвчинд тань орно. Түүгээр асуултдаа шагнал тавьж, мэдлэгээ хуваалцсан хүмүүсийг урамшуулаарай." : "Таны хандив Монголын шинжлэх ухаан түгээгч бичээчдэд урам болно. Ийм хүмүүс байгаа цагт мэдлэг цацарсаар байна."
              : isTip ? "Таны урамшуулал бичээчийн хэтэвчид орж, цааш бичих урам болно."
              : isTop ? "Хэтэвчиндээ мөнгө хийж, асуултдаа шагнал тавих, хариулсан хүмүүсийг урамшуулахад ашиглана. Таны мөнгө мэдлэг хуваалцдаг хүмүүст очно."
              : isPrem ? `Таны төлбөрийн ${Math.round(poolShare * 100)}% нь шууд бичээчдийн шагналын санд орж, үлдсэн нь сайтыг ажиллуулахад зарцуулагдана.` : "Хандив бүтнээрээ сар бүрийн шилдэг бичээчдэд хуваарилагдана. Сайт шимтгэл авахгүй."}
          </p>
        </div>

        {done && paid ? (
          <div className="sm-body">
            <p className="qp-wait ok">✓ Төлбөр орж, баталгаажлаа. Танд мэдэгдэл ирнэ.</p>
            <div className="sm-foot">
              <Link href="/wallet" className="tm-btn">Миний хэтэвч</Link>
              <button type="button" className="tm-btn ghost" onClick={close}>Хаах</button>
            </div>
          </div>
        ) : done ? (
          <div className="sm-body">
            {qp && <QpayBox code={done.code} qpay={qp} onPaid={() => setPaid(true)} />}
            {qp ? <details className="qp-alt"><summary>Эсвэл дансаар шилжүүлэх</summary>{steps}</details> : steps}
            <div className="sm-foot">
              <Link href={`/san/pay/${done.code}`} className="tm-btn">{qp ? "Төлбөрийн хуудас" : "Шилжүүлгийн хуудас"}</Link>
              <button type="button" className="tm-btn ghost" onClick={close}>Хаах</button>
            </div>
          </div>
        ) : (
          <form action={action} className="sm-body">
            <input type="hidden" name="kind" value={kind} />
            {isTip && <input type="hidden" name="writer_id" value={writer.id} />}
            {isTip && postId && <input type="hidden" name="post_id" value={postId} />}
            {shown?.error && <p className="tm-err">{shown.error}{shown.to && <> · <Link href={shown.to}>Үзэх →</Link></>}</p>}
            {isPrem ? (
              <>
                <div className="sm-perks">
                  {perks.map(([i, t]) => <span key={t}><i>{i}</i>{t}</span>)}
                </div>
                <div className="san-plans">
                  {plans.map((p) => (
                    <label key={p.months} className="san-plan">
                      <input type="radio" name="months" value={p.months} checked={months === p.months} onChange={() => setMonths(p.months)} />
                      <span>
                        <b>{p.label}</b>
                        <em>{fmt(p.price)}</em>
                        <small>{p.months > 1 ? `сард ${fmt(Math.round(p.price / p.months))}` : "сар бүр сунгана"}</small>
                      </span>
                    </label>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="san-amounts tip">
                  {AMOUNTS.map(([a, ic]) => (
                    <label key={a} className="san-amt">
                      <input type="radio" name="amount" value={a} checked={!custom && amount === a} onChange={() => { setAmount(a); setCustom(""); }} />
                      <span>{ic && <i aria-hidden="true">{ic}</i>}{fmt(a)}</span>
                    </label>
                  ))}
                </div>
                <label className="san-field">Өөр дүн (₮)
                  <input name="amount_custom" inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder={`${fmt(min)} – ${fmt(max)}`} />
                </label>
                {!isTop && <>
                <label className="san-field">{isTip ? "Бичээчид хэлэх үг" : "Бичээчдэд хэлэх үг"} (заавал биш)
                  <textarea name="message" maxLength={300} rows={2} placeholder={isTip ? "Бичээчдээ урам өгөх үг…" : "Залуу судлаачдад урам өгөх үг…"} />
                </label>
                <label className="san-check"><input type="checkbox" name="anonymous" /> Нэрээ нууцлах</label>
                </>}
              </>
            )}
            <div className="sm-foot">
              <small>{sum ? `Нийт ${fmt(sum)}` : ""}</small>
              <span className="ss-grow" />
              <button type="button" className="tm-btn ghost" onClick={close}>Болих</button>
              <button type="submit" className="tm-btn sm-go" disabled={pending}>{pending ? <span className="spk-btn"><Spark mono size={16} />Түр хүлээнэ үү…</span> : isPrem ? <>Дэмжигч болох <img className="sm-bolt" src="/icons/bolt.svg" width={16} height={16} alt="" /></> : isTip ? "Урамшуулах 🎁" : isTop ? "Цэнэглэх 🏆" : "Хандив өгөх ✦"}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>{label}</button>
      {mounted && modal && createPortal(modal, document.body)}
    </>
  );
}
