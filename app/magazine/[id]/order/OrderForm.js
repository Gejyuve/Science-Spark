"use client";

import { useState } from "react";
import Link from "next/link";
import { orderPrint } from "../../actions";
import Spark from "../../../components/Spark";
import { useFormStatus } from "react-dom";

const mnt = (n) => `${Math.round(n).toLocaleString("en-US")}₮`;

function Submit({ total, enough }) {
  const { pending } = useFormStatus();
  if (!enough) return null;
  return <button className="mz-btn" disabled={pending}>{pending ? <Spark mono size={16} /> : null}{mnt(total)} төлж захиалах</button>;
}

export default function OrderForm({ issueId, price, fee, wallet, maxQty, cities, districts, init }) {
  const [qty, setQty] = useState(1);
  const [city, setCity] = useState(init.city || "Улаанбаатар");
  const total = qty * price + fee;
  const enough = wallet >= total;
  return (
    <form action={orderPrint} className="ss-card mz-form">
      <input type="hidden" name="iid" value={issueId} />
      <div className="vd-opts">
        <label><span>Тоо ширхэг</span>
          <input name="qty" type="number" min={1} max={maxQty} value={qty} onChange={(e) => setQty(Math.min(maxQty, Math.max(1, Number(e.target.value) || 1)))} required />
        </label>
        <label><span>Хүлээн авах хүн</span><input name="name" defaultValue={init.name || ""} maxLength={80} required autoComplete="name" /></label>
        <label><span>Утас</span><input name="phone" defaultValue={init.phone || ""} inputMode="tel" placeholder="99112233" maxLength={14} required autoComplete="tel" /></label>
      </div>
      <div className="vd-opts">
        <label><span>Хот, аймаг</span>
          <select name="city" value={city} onChange={(e) => setCity(e.target.value)}>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        {city === "Улаанбаатар" ? (
          <label><span>Дүүрэг</span>
            <select name="district" defaultValue={init.district || ""} required>
              <option value="" disabled>Сонгох</option>
              {districts.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
        ) : (
          <label><span>Сум</span><input name="district" defaultValue={init.city === city ? init.district || "" : ""} maxLength={60} /></label>
        )}
      </div>
      <label className="vd-f"><span>Дэлгэрэнгүй хаяг</span>
        <textarea name="address" className="vd-in" rows={3} maxLength={400} required defaultValue={init.address || ""} placeholder="Хороо, хороолол, байр, орц, давхар, тоот. Хүргэгч олоход хялбар байхаар бичнэ үү" />
      </label>
      <label className="vd-f"><span>Нэмэлт тайлбар</span>
        <input name="note" className="vd-in" maxLength={300} placeholder="Жишээ: оройн 18 цагаас хойш хүргэнэ үү (заавал биш)" />
      </label>
      <div className="mz-total">
        <span>{qty} × {mnt(price)}{fee > 0 ? ` + хүргэлт ${mnt(fee)}` : ""}</span>
        <b>{mnt(total)}</b>
        <small>Хэтэвчинд: {mnt(wallet)}</small>
      </div>
      {!enough && <Link href="/wallet?topup=1" className="mz-btn">💳 Хэтэвч цэнэглэх (QPay) · {mnt(total - wallet)} дутуу</Link>}
      <Submit total={total} enough={enough} />
      <p className="mz-fine">Төлбөр төлөгдмөгц захиалга хүргэлтэд бүртгэгдэж, хүргэлтэд гарах, хүргэгдэх үед танд мэдэгдэл очно. Хүргэлт эхлээгүй бол редакц цуцалж, мөнгийг хэтэвчинд тань буцаана.</p>
    </form>
  );
}
