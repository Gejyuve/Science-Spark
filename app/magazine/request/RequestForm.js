"use client";

import { useState } from "react";
import { sendRequest } from "../actions";

export default function RequestForm({ issues, sizes, name, email, kind: init }) {
  const [kind, setKind] = useState(init);
  return (
    <form action={sendRequest} className="ss-card mz-form">
      <div className="mz-kinds" role="radiogroup" aria-label="Хүсэлтийн төрөл">
        {[["article", "📝 Нийтлэл", "Өөрийн бичсэн шинжлэх ухааны нийтлэлийг сэтгүүлд хэвлүүлэх"], ["banner", "📣 Баннер зар", "Байгууллага, арга хэмжээ, бүтээгдэхүүнээ сурталчлах"]].map(([k, l, d]) => (
          <label key={k} className={"mz-kind" + (kind === k ? " on" : "")}>
            <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} />
            <b>{l}</b><small>{d}</small>
          </label>
        ))}
      </div>
      <div className="vd-opts">
        <label><span>Аль дугаарт</span>
          <select name="issue" defaultValue={issues[0]?.id || ""}>
            {issues.map((i) => <option key={i.id} value={i.id}>№{i.number} · {i.title}</option>)}
            <option value="">Дараагийн аль ч дугаарт</option>
          </select>
        </label>
        {kind === "banner" && (
          <label><span>Баннерын хэмжээ</span>
            <select name="size" defaultValue="" required>
              <option value="" disabled>Сонгох</option>
              {sizes.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        )}
      </div>
      <div className="vd-opts">
        <label><span>Таны нэр</span><input name="name" defaultValue={name} maxLength={80} required /></label>
        <label><span>{kind === "banner" ? "Байгууллага" : "Байгууллага, сургууль"}</span><input name="org" maxLength={120} placeholder="Заавал биш" /></label>
      </div>
      <div className="vd-opts">
        <label><span>Утас</span><input name="phone" inputMode="tel" placeholder="99112233" maxLength={14} required /></label>
        <label><span>Имэйл</span><input name="email" type="email" defaultValue={email} maxLength={120} placeholder="Заавал биш" /></label>
      </div>
      <label className="vd-f"><span>{kind === "banner" ? "Зарын тухай" : "Нийтлэлийн сэдэв, товч агуулга"}</span>
        <textarea name="message" className="vd-in" rows={6} maxLength={3000} required
          placeholder={kind === "banner" ? "Юуг сурталчлах, хэзээ хүртэл, загвар бэлэн эсэх зэргийг бичнэ үү" : "Нийтлэлийн гарчиг, сэдэв, хэдэн үг орчим, ямар эх сурвалжид тулгуурласан зэргийг бичнэ үү. Бэлэн нийтлэлээ Google Docs холбоосоор хавсаргаж болно"} />
      </label>
      <button className="mz-btn">Хүсэлт илгээх</button>
      <p className="mz-fine">Нийтлэлийг сэтгүүлийн редакц хянаж, сайтын нийтлэл бичих дүрмийн дагуу засварлана. Хүсэлтийнхээ хариуг «Миний сэтгүүл» хэсгээс харна.</p>
    </form>
  );
}
