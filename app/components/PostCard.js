import Link from "next/link";
import { fmtDate } from "@/lib/format";
import { Avatar, Stat } from "./Bits";

// Нүүрний урсгал дахь нийтлэлийн карт (Figma: Нүүр · Асуулт/Нийтлэл карт)
export default function PostCard({ p }) {
  const isQuestion = p.kind === "Асуулт";
  const excerpt = p.body.length > 320 ? p.body.slice(0, 320) + "…" : p.body;
  const author = { id: p.author_id, initial: p.initial, first_name: p.first_name };
  return (
    <article className="ss-card">
      <div className="ss-card-top">
        <span className="ss-kind">{p.kind}</span>
        <span className="ss-date">
          <img className="ic" src="/icons/date.svg" width={13} height={12} alt="" />
          {fmtDate(p.created_at)}
        </span>
      </div>
      <Link href={`/u/${p.author_id}`} className="ss-person">
        <Avatar user={author} size={40} />
        <div>
          <b>{p.initial}.{p.first_name}</b>
          <Stat points={p.author_points} followers={p.author_followers} />
        </div>
      </Link>
      <Link href={`/post/${p.id}`} className="ss-card-body">
        {!isQuestion && <h2>{p.title}</h2>}
        <p>{isQuestion && p.title !== p.body ? <><b>{p.title}</b> {excerpt}</> : excerpt}</p>
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
    </article>
  );
}
