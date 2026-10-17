import Link from "next/link";
import { fmtDate, KIND_HREF } from "@/lib/format";
import { fmtEventRange, spanText, validLocal } from "@/lib/events";
import EventCover from "./EventCover";
import { Avatar, Stat, When, Person } from "./Bits";
import Share from "./Share";
import { toggleSave, sparkPost } from "../posts/actions";

// Нүүрний урсгал дахь нийтлэлийн карт (Figma: Нүүр · Асуулт/Нийтлэл карт)
export default function PostCard({ p, viewer, following }) {
  const isQuestion = p.kind === "Асуулт";
  const isShort = isQuestion || p.kind === "Бодрол";
  const m = p.meta || {};
  const facts = p.kind === "Эвент"
    ? [m.starts_at && ["f_date", fmtEventRange(m)], m.format && ["f_globe", m.format], m.location && ["f_pin", m.location], m.price && ["f_ticket", m.price]]
    : p.kind === "Зарлал"
    ? [m.valid_until && ["f_date", `Хүчинтэй: ${m.valid_until}`], m.contact && ["f_phone", m.contact]]
    : [];
  const excerpt = p.body.length > 320 ? p.body.slice(0, 320) + "…" : p.body;
  const actions = (
        <div className="ss-actionbar">
          {viewer && viewer.id !== p.author_id && !p.sparked ? (
            <form action={sparkPost}>
              <input type="hidden" name="post_id" value={p.id} />
              <button type="submit" className="ss-count ss-sparkbtn" title="Оч өгөх">
                <img className="ic" src="/icons/aspark.svg" width={25} height={24} alt="Оч өгөх" />{p.sparks}
              </button>
            </form>
          ) : !viewer ? (
            <Link href="/login" className="ss-count ss-sparkbtn" title="Оч өгөх"><img className="ic" src="/icons/aspark.svg" width={25} height={24} alt="Оч" />{p.sparks}</Link>
          ) : (
            <span className={"ss-count" + (p.sparked ? " sparked" : "")} title={p.sparked ? "Та оч өгсөн" : "Оч"}>
              <img className={p.sparked ? "" : "ic"} src={`/icons/${p.sparked ? "sparkle" : "aspark"}.svg`} width={p.sparked ? 23 : 25} height={24} alt="Оч" />{p.sparks}
            </span>
          )}
          <Link href={`/post/${p.id}#comments`} className="ss-count">
            <img className="ic" src="/icons/comment.svg" width={25} height={24} alt="Сэтгэгдэл" />{p.comments}
          </Link>
          <Link href={`/post/${p.id}${isQuestion ? "#comments" : ""}`} className="ss-pill">
            {isQuestion ? "Хариулах" : p.kind === "Эвент" ? "Дэлгэрэнгүй" : "Унших"}
          </Link>
          <span className="ss-grow" />
          {viewer ? (
            <form action={toggleSave}>
              <input type="hidden" name="post_id" value={p.id} />
              <button type="submit" className="ss-icon-btn" title={p.saved ? "Хадгалснаас хасах" : "Хадгалах"} aria-pressed={!!p.saved}>
                <img className={p.saved ? "" : "ic"} src={`/icons/${p.saved ? "saved20" : "save"}.svg`} width={p.saved ? 22 : 25} height={p.saved ? 22 : 24} alt="Хадгалах" />
              </button>
            </form>
          ) : (
            <Link href="/login" className="ss-icon-btn" title="Хадгалах"><img className="ic" src="/icons/save.svg" width={25} height={24} alt="Хадгалах" /></Link>
          )}
          <Share path={`/post/${p.id}`} title={p.title} icon="ashare" size={24} align="right" />
        </div>
  );
  // Эвент: Figma (Эвент · 20:2) карт — зүүнд мэдээлэл, баруунд дөрвөлжин зураг
  if (p.kind === "Эвент") {
    const ev = [
      ["f_date", fmtEventRange(m)],
      validLocal(m.starts_at) && ["f_clock", `Үргэлжлэх хугацаа: ${validLocal(m.ends_at) ? spanText(m.starts_at, m.ends_at) : m.duration || "—"}`],
      m.price && ["f_ticket", m.price],
      m.capacity && ["f_people", `${m.capacity} хүн`],
    ].filter(Boolean);
    return (
      <article className="ss-card pc evc">
        <Link href={`/post/${p.id}`} className="pc-link" aria-hidden="true" tabIndex={-1} />
        <div className="ss-card-top">
          <span className="evc-crumb"><Link href="/events" className="ss-kind">Эвент</Link><i>·</i><span>{m.type || "Бусад"}</span></span>
          <When d={p.created_at} />
        </div>
        <Person id={p.author_id} initial={p.initial} first_name={p.first_name} avatar={p.avatar} points={p.author_points} followers={p.author_followers} viewer={viewer} following={following} />
        <div className="evc-meta">
          <span><img className="ic" src="/icons/f_pin.svg" width={16} height={16} alt="" />{m.format === "Онлайн" ? "Онлайн" : m.location || m.format}</span>
          <span className="tip" data-tip={`Энэ контентыг ${p.views || 0} хүн нээж үзсэн`}><img className="ic" src="/icons/eye.svg" width={16} height={16} alt="" />{p.views || 0}</span>
        </div>
        <div className="evc-grid">
          <div className="evc-main">
            <Link href={`/post/${p.id}`} className="evc-title">{p.title}</Link>
            <p className="evc-text">{p.body.length > 220 ? p.body.slice(0, 220) + "…" : p.body}</p>
            <div className="evc-facts">
              {ev.map(([ic, v]) => <span key={ic}><img className="ic" src={`/icons/${ic}.svg`} width={18} height={18} alt="" />{v}</span>)}
            </div>
          </div>
          <Link href={`/post/${p.id}`} className="evc-cover" aria-hidden="true" tabIndex={-1}>
            {p.image_id ? <img src={`/img/${p.image_id}`} alt="" loading="lazy" /> : <EventCover type={m.type} starts={m.starts_at} />}
          </Link>
        </div>
        {actions}
      </article>
    );
  }
  return (
    <article className="ss-card pc">
      <Link href={`/post/${p.id}`} className="pc-link" aria-hidden="true" tabIndex={-1} />
      <div className="ss-card-top">
        {KIND_HREF[p.kind] ? <Link href={KIND_HREF[p.kind]} className="ss-kind">{p.kind}</Link> : <span className="ss-kind">{p.kind}</span>}
        <When d={p.created_at} />
      </div>
      <Person id={p.author_id} initial={p.initial} first_name={p.first_name} avatar={p.avatar} points={p.author_points} followers={p.author_followers} viewer={viewer} following={following} />
      <Link href={`/post/${p.id}`} className="ss-card-body">
        {!isShort && <h2>{p.title}</h2>}
        <p>{excerpt}</p>
        {p.image_id && (
          <img className={"ss-cardimg" + (["Эвент", "Зарлал"].includes(p.kind) ? " sq" : "")} src={`/img/${p.image_id}`} alt="" loading="lazy" />
        )}
        {facts.filter(Boolean).length > 0 && (
          <span className="ss-facts">
            {facts.filter(Boolean).map(([ic, v]) => (
              <span key={ic}><img className="ic" src={`/icons/${ic}.svg`} width={16} height={16} alt="" />{v}</span>
            ))}
          </span>
        )}
      </Link>
      {actions}
      {isQuestion && (p.ta_id ? (
        <Link href={`/post/${p.id}#c${p.ta_id}`} className="ss-answer">
          <span className="ss-curve" aria-hidden="true" />
          <span className="ss-answer-who">
            <Avatar user={{ id: p.ta_author, first_name: p.ta_first, avatar: p.ta_avatar }} size={36} />
            <span>
              <b>{p.ta_initial}.{p.ta_first}</b>
              <Stat points={p.ta_points} followers={p.ta_followers} link={false} />
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
