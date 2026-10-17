import Link from "next/link";
import { fmtDate } from "@/lib/format";
import { fmtEventRange } from "@/lib/events";
import { Avatar, Stat, When } from "./Bits";

// Нүүрний урсгал дахь нийтлэлийн карт (Figma: Нүүр · Асуулт/Нийтлэл карт)
export default function PostCard({ p, viewer }) {
  const isQuestion = p.kind === "Асуулт";
  const isShort = isQuestion || p.kind === "Бодрол";
  const m = p.meta || {};
  const facts = p.kind === "Эвент"
    ? [m.starts_at && ["f_date", fmtEventRange(m)], m.format && ["f_globe", m.format], m.location && ["f_pin", m.location], m.price && ["f_ticket", m.price]]
    : p.kind === "Зарлал"
    ? [m.valid_until && ["f_date", `Хүчинтэй: ${m.valid_until}`], m.contact && ["f_phone", m.contact]]
    : [];
  const excerpt = p.body.length > 320 ? p.body.slice(0, 320) + "…" : p.body;
  const author = { id: p.author_id, initial: p.initial, first_name: p.first_name };
  return (
    <article className="ss-card">
      <div className="ss-card-top">
        <span className="ss-kind">{p.kind}</span>
        <When d={p.created_at} />
      </div>
      <Link href={`/u/${p.author_id}`} className="ss-person">
        <Avatar user={author} size={40} />
        <div>
          <b>{p.initial}.{p.first_name}</b>
          <Stat points={p.author_points} followers={p.author_followers} />
        </div>
      </Link>
      <Link href={`/post/${p.id}`} className="ss-card-body">
        {!isShort && <h2>{p.title}</h2>}
        <p>{excerpt}</p>
        {facts.filter(Boolean).length > 0 && (
          <span className="ss-facts">
            {facts.filter(Boolean).map(([ic, v]) => (
              <span key={ic}><img className="ic" src={`/icons/${ic}.svg`} width={16} height={16} alt="" />{v}</span>
            ))}
          </span>
        )}
      </Link>
      <div className="ss-actionbar">
        <span className="ss-count"><img className="ic" src="/icons/aspark.svg" width={25} height={24} alt="Оч" />{p.sparks}</span>
        <Link href={`/post/${p.id}#comments`} className="ss-count">
          <img className="ic" src="/icons/comment.svg" width={25} height={24} alt="Сэтгэгдэл" />{p.comments}
        </Link>
        <Link href={`/post/${p.id}${isQuestion ? "#comments" : ""}`} className="ss-pill">
          {isQuestion ? "Хариулах" : "Унших"}
        </Link>
        <span className="ss-grow" />
        <span className="ss-icon-btn soon" title="Хадгалах · тун удахгүй">
          <img className="ic" src="/icons/save.svg" width={25} height={24} alt="Хадгалах" />
        </span>
        <Link href={`/post/${p.id}`} className="ss-icon-btn" title="Хуваалцах">
          <img className="ic" src="/icons/ashare.svg" width={25} height={24} alt="Хуваалцах" />
        </Link>
      </div>
      {isQuestion && (p.ta_id ? (
        <Link href={`/post/${p.id}#c${p.ta_id}`} className="ss-answer">
          <span className="ss-curve" aria-hidden="true" />
          <span className="ss-answer-who">
            <Avatar user={{ id: p.ta_author, first_name: p.ta_first }} size={36} />
            <span>
              <b>{p.ta_initial}.{p.ta_first}</b>
              <Stat points={p.ta_points} followers={p.ta_followers} />
            </span>
          </span>
          <p>{p.ta_body}</p>
        </Link>
      ) : p.ta_id === null && (
        <Link href={viewer ? `/post/${p.id}#comments` : "/login"} className="ss-answer empty">
          <span className="ss-curve" aria-hidden="true" />
          <span className="ss-answer-who">
            <Avatar user={viewer || { id: 0, first_name: "?" }} size={36} />
            <span className="ss-answer-cta">Анхны хариултыг та өг</span>
          </span>
        </Link>
      ))}
    </article>
  );
}
