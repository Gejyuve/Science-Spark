"use client";

import { useState } from "react";
import Link from "next/link";

const fmtK = (n) => (n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "K" : String(n || 0));

// Figma 75:309 «Клубын газрын зураг». Оч (тэмдэг) дээр хулгана аваачихад клубын мэдээлэл гарна.
export default function ClubMap({ spots, total, aimags }) {
  const [on, setOn] = useState(null);
  return (
    <section className="cm-card" onMouseLeave={() => setOn(null)}>
      <img className="cm-art" src="/club/map.svg" alt="" />
      <span className="cm-ring r1" /><span className="cm-ring r2" /><span className="cm-ring r3" />
      <p className="cm-country">МОНГОЛ УЛС</p>
      <p className="cm-side n">ОРОС</p>
      <p className="cm-side s">ХЯТАД</p>
      <div className="cm-head">
        <h1>Клубын газрын зураг</h1>
        <p>{total ? `Манай вебд бүртгэлтэй ${total} клубын байршил` : "Манай вебд бүртгэлтэй клубын байршил"}</p>
      </div>
      <span className="cm-legend">✦ {total} клуб · {aimags} аймаг</span>
      <span className="cm-hint">{total ? "Оч дээр хулганаа аваачиж клубын мэдээллийг үзнэ үү" : "Клубууд бүртгүүлэхэд байршил нь энд гэрэлтэнэ"}</span>
      {spots.map((s, i) => (
        <div key={s.place} className={"cm-spot" + (on === i ? " on" : "") + (s.x > 760 ? " left" : "")} style={{ left: `${(s.x / 1100) * 100}%`, top: `${(s.y / 470) * 100}%` }}>
          <button type="button" className="cm-marker" aria-label={`${s.place}: ${s.clubs[0].first_name}`}
            onMouseEnter={() => setOn(i)} onFocus={() => setOn(i)} onClick={() => setOn(on === i ? null : i)}>
            <span className="cm-glow" /><img src="/club/marker.svg" width={44} height={44} alt="" />
          </button>
          <span className="cm-city">{s.place}</span>
          {on === i && (
            <div className="cm-pop" role="dialog" aria-label={s.clubs[0].first_name}>
              {s.clubs.slice(0, 1).map((c) => (
                <div key={c.id}>
                  <div className="cm-pop-top">
                    <ClubAv c={c} size={40} />
                    <div><b>{c.first_name}</b><small><img className="ic" src="/icons/f_pin.svg" width={14} height={14} alt="" />{s.place}</small></div>
                    {c.rank <= 100 && <em>ТОП #{c.rank}</em>}
                  </div>
                  <div className="cm-pop-stat">
                    <span><img src="/icons/spark.svg" width={16} height={16} alt="" />{fmtK(c.points)}</span>
                    <span><img className="ic" src="/icons/followers.svg" width={14} height={14} alt="" />{c.members} гишүүн</span>
                  </div>
                  {c.about && <p>{c.about}</p>}
                  <div className="cm-pop-foot">
                    <Link href={`/u/${c.id}`} className="cm-join">Нэгдэх</Link>
                    <Link href={`/u/${c.id}`} className="cm-more">Дэлгэрэнгүй →</Link>
                  </div>
                </div>
              ))}
              {s.clubs.length > 1 && <small className="cm-pop-more">Энд өөр {s.clubs.length - 1} клуб бий</small>}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

const COLORS = ["#37C3B3", "#5B8DEF", "#F59E0B", "#E5484D", "#8E6CEF", "#00A89B", "#EF6C9C"];
export function ClubAv({ c, size = 40 }) {
  if (c.avatar) return <img className="ss-avatar" src={`/img/${c.avatar}`} width={size} height={size} alt="" style={{ width: size, height: size, objectFit: "cover" }} />;
  return <span className="ss-avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.42), background: COLORS[(Number(c.id) || 0) % COLORS.length] }} aria-hidden="true">{(c.first_name || "?")[0]}</span>;
}
