import Link from "next/link";
import { fmtDate } from "@/lib/format";
import { SUPPORT_NEEDED, daysLeft, synonyms } from "@/lib/terms";
import Share from "./Share";
import { Avatar, Person } from "./Bits";
import { voteTerm } from "../dict/actions";
import { toggleSave } from "../posts/actions";

// Толь: үгийн карт, хэлний шошго, саналын хайрцаг
export function Langs({ m, big = false }) {
  return (
    <div className={"tl-langs" + (big ? " big" : "")}>
      {m.en && <span className="en"><i>EN</i>{m.en}</span>}
      {m.ru && <span><i>RU</i>{m.ru}</span>}
      {m.la && <span><i>LA</i>{m.la}</span>}
    </div>
  );
}

// Хэлэлцүүлгийн саналын хайрцаг
export function VoteBox({ t, user, back, detail = false }) {
  const total = t.up + t.down;
  const pct = total ? Math.round((100 * t.up) / total) : 0;
  const mine = user && user.id === t.author_id;
  const btn = (vote, label, cls, icon) =>
    !user ? (
      <Link href="/login" className={"tl-vbtn " + cls}>{icon}{label}</Link>
    ) : (
      <form action={voteTerm}>
        <input type="hidden" name="post_id" value={t.id} />
        <input type="hidden" name="vote" value={vote} />
        <input type="hidden" name="back" value={back} />
        <button type="submit" className={"tl-vbtn " + cls + (t.my_vote === vote ? " on" : "")} disabled={mine} title={mine ? "Өөрийн үгэнд санал өгөх боломжгүй" : t.my_vote === vote ? "Саналаа буцаах" : label}>
          {icon}{label}
        </button>
      </form>
    );
  return (
    <div className={"tl-vote" + (detail ? " detail" : "")}>
      <div className="tl-vtext">
        {detail && <b>Энэ нэр томьёог батлах уу?</b>}
        <span>{detail ? `Дэмжсэн ${t.up} · Эсрэг ${t.down} · Батлагдахад ${Math.round(SUPPORT_NEEDED * 100)}% дэмжлэг хэрэгтэй` : <><b>Батлахыг дэмжсэн {t.up}</b><i>Эсрэг {t.down}</i></>}</span>
        <span className="tl-bar"><i style={{ width: `${pct}%` }} /></span>
      </div>
      <div className="tl-vacts">
        {btn(1, "Дэмжих", "up", <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11v9H4v-9h3Zm2 9h8.3a2 2 0 0 0 2-1.6l1.2-6A2 2 0 0 0 18.5 10H14V6a2 2 0 0 0-2-2l-3 7v9Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>)}
        {btn(-1, "Эсрэг", "down", <span aria-hidden="true">✕</span>)}
      </div>
    </div>
  );
}

// Толь дахь нэг үгийн карт (Figma 556:406 / 562:415)
export function TermCard({ t, user, following, back }) {
  const m = t.meta || {};
  const disc = t.status === "discussion";
  const syn = synonyms(m);
  const left = daysLeft(m, t.created_at);
  return (
    <article className="ss-card pc tl-card">
      <Link href={`/post/${t.id}`} className="pc-link" aria-hidden="true" tabIndex={-1} />
      <div className="ss-card-top">
        <span className="evc-crumb"><Link href="/dict" className="ss-kind">Толь</Link><i>·</i><span className={disc ? "tl-orange" : ""}>{disc ? "Хэлэлцэж байна" : "Батлагдсан нэр томьёо"}</span></span>
        {disc
          ? <span className="tl-left"><img src="/icons/f_clock.svg" width={13} height={13} alt="" />{left ? `${left} хоног` : "Дууссан"}</span>
          : <span className="tl-ok">✓ {fmtDate(m.approved_at || t.reviewed_at || t.created_at)}</span>}
      </div>
      <Person id={t.author_id} initial={t.initial} first_name={t.first_name} avatar={t.avatar} points={t.author_points} followers={t.author_followers} viewer={user} following={following} />
      <Link href={`/post/${t.id}`} className="tl-title">{t.title}</Link>
      <Langs m={m} />
      <p className="tl-def">{t.body}</p>
      {syn.length > 0 && <p className="tl-syn"><span>Ижил утгатай:</span> <b>{syn.join(", ")}</b></p>}
      {disc && <VoteBox t={t} user={user} back={back} />}
      <div className="ss-actionbar">
        <span className="ss-count" title="Оч"><img className="ic" src="/icons/aspark.svg" width={22} height={22} alt="Оч" />{t.sparks}</span>
        <Link href={`/post/${t.id}#comments`} className="ss-count"><img className="ic" src="/icons/comment.svg" width={22} height={22} alt="Сэтгэгдэл" />{t.comments}</Link>
        <Link href={`/post/${t.id}#comments`} className="ss-pill">Сэтгэгдэл</Link>
        {user ? (
          <form action={toggleSave}>
            <input type="hidden" name="post_id" value={t.id} />
            <button type="submit" className="ss-icon-btn" title={t.saved ? "Хадгалснаас хасах" : "Хадгалах"}>
              <img className={t.saved ? "" : "ic"} src={`/icons/${t.saved ? "saved20" : "save"}.svg`} width={t.saved ? 20 : 22} height={t.saved ? 20 : 22} alt="Хадгалах" />
            </button>
          </form>
        ) : (
          <Link href="/login" className="ss-icon-btn" title="Хадгалах"><img className="ic" src="/icons/save.svg" width={22} height={22} alt="Хадгалах" /></Link>
        )}
        <Share path={`/post/${t.id}`} title={t.title} icon="ashare" size={22} />
      </div>
      {t.tc_id ? (
        <Link href={`/post/${t.id}#c${t.tc_id}`} className="ss-answer tl-answer">
          <span className="ss-curve" aria-hidden="true" />
          <span className="ss-answer-who">
            <Avatar user={{ id: t.tc_author, first_name: t.tc_first, avatar: t.tc_avatar }} size={32} />
            <span><b>{t.tc_initial}.{t.tc_first}</b></span>
          </span>
          <p>{t.tc_body}</p>
        </Link>
      ) : (
        <Link href={user ? `/post/${t.id}#comments` : "/login"} className="ss-answer empty tl-answer">
          <span className="ss-curve" aria-hidden="true" />
          <span className="ss-answer-who">
            <Avatar user={user || { id: 0, first_name: "?" }} size={28} />
            <span className="ss-answer-cta">Анхны сэтгэгдлийг та үлдээ</span>
          </span>
        </Link>
      )}
    </article>
  );
}

