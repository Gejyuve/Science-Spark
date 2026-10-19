"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

// «Асуух» дарахад нийтлэхээс өмнө гарах цонх: асуултдаа шагнал нэмэх үү?
// Шагнал хэтэвчнээс түгжигдэж, асуугчийн сонгосон хамгийн зөв хариулагчийн хэтэвч рүү орно (lib/bounty.js).
const PICKS = [5000, 10000, 20000, 50000];
const n = (x) => Number(x || 0).toLocaleString("en-US");

// onPick(дүн): 0 бол шагналгүй асууна. onClose: асуултаа засахаар буцна.
export default function BountyAsk({ wallet, onPick, onClose }) {
  const fits = PICKS.filter((v) => v <= wallet);
  const [amt, setAmt] = useState(fits.length ? fits[Math.min(1, fits.length - 1)] : PICKS[0]);
  const low = wallet < 1000;
  const short = amt > wallet;

  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [onClose]);

  return createPortal(
    <div className="tm-overlay cel-ov" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cel bqa" role="dialog" aria-modal="true" aria-labelledby="bqa-h">
        <button type="button" className="tm-x cel-x" onClick={onClose} aria-label="Буцах">×</button>
        <span className="bqa-ic" aria-hidden="true">🏆</span>
        <b id="bqa-h">Асуултдаа шагнал нэмэх үү?</b>
        <p>Шагналтай асуулт «Шагналтай» шүүлтүүрт гарч, мэдлэгтэй хүмүүсийг хариулахад урамшуулна. Мөнгө түгжигдэж, таны сонгосон хамгийн зөв хариулагчийн хэтэвч рүү орно.</p>
        <div className="cel-bq">
          {low ? (
            <div className="cel-bq-row">
              <span className="cel-bq-w">Хэтэвчинд: {n(wallet)}₮</span>
              <Link href="/wallet?topup=1" className="cel-bq-go">Хэтэвчээ цэнэглэх →</Link>
            </div>
          ) : (
            <>
              <div className="cel-bq-picks" role="group" aria-label="Шагналын дүн">
                {PICKS.map((v) => (
                  <button key={v} type="button" className={amt === v ? "on" : ""} disabled={v > wallet} onClick={() => setAmt(v)}>{n(v)}₮</button>
                ))}
                <label className="cel-bq-own">
                  <input type="number" min={1000} max={Math.min(5000000, wallet)} step={500} inputMode="numeric" aria-label="Өөр дүн"
                    value={PICKS.includes(amt) ? "" : amt || ""} placeholder="Өөр дүн" onChange={(e) => setAmt(Math.round(Number(e.target.value) || 0))} />
                  <span>₮</span>
                </label>
              </div>
              <div className="cel-bq-row">
                <span className="cel-bq-w">Хэтэвчинд: {n(wallet)}₮</span>
                <button type="button" className="cel-bq-go" disabled={short || amt < 1000 || amt > 5000000} onClick={() => onPick(amt)}>
                  🏆 {n(amt)}₮ шагналтай асуух
                </button>
              </div>
              {short && <small className="cel-bq-err">Хэтэвчинд хүрэлцэхгүй байна. <Link href="/wallet?topup=1">Хэтэвчээ цэнэглэх →</Link></small>}
            </>
          )}
        </div>
        <button type="button" className="bqa-no" onClick={() => onPick(0)}>Шагналгүй асуух</button>
      </div>
    </div>,
    document.body
  );
}
