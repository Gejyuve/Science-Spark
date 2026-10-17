import Link from "next/link";
import { fmtDate } from "@/lib/format";
import { crumbs } from "@/lib/tree";
import { Avatar } from "./Bits";

// Хайлт, Мод, архивын хуудсуудын нийтлэг картууд (Figma 620:472, 732:944, 732:496)
const SYMBOLS = ["π", "∞", "Σ", "√", "Δ", "λ", "Ω", "∫"];
const TONES = ["teal", "orange", "violet", "pink"];

// Хайсан үгийг тодруулна
export function Hl({ text, term }) {
  if (!term) return text;
  const t = String(text || "");
  const low = t.toLowerCase();
  const needle = term.toLowerCase();
  const out = [];
  let i = 0;
  let k = 0;
  while (needle && (k = low.indexOf(needle, i)) !== -1) {
    if (k > i) out.push(t.slice(i, k));
    out.push(<mark key={k} className="sr-hl">{t.slice(k, k + needle.length)}</mark>);
    i = k + needle.length;
  }
  out.push(t.slice(i));
  return out;
}

// Хайсан үг орсон хэсгийг тасдаж авна
export function snippet(body, term, len = 130) {
  const b = String(body || "").replace(/\s+/g, " ").trim();
  const k = term ? b.toLowerCase().indexOf(term.toLowerCase()) : -1;
  if (b.length <= len) return b;
  if (k < 60) return b.slice(0, len).replace(/\s+\S*$/, "") + "…";
  const start = b.lastIndexOf(" ", k - 40) + 1;
  return "…" + b.slice(start, start + len).replace(/\s+\S*$/, "") + "…";
}

export function Cover({ p, cls }) {
  const tone = TONES[p.id % TONES.length];
  return (
    <span className={`sr-cover ${cls} ${p.image_id ? "img" : tone}`}>
      {p.image_id ? <img src={`/img/${p.image_id}`} alt="" loading="lazy" /> : <><i className="sr-sym">{SYMBOLS[p.id % SYMBOLS.length]}</i><i className="sr-blob" /></>}
      <em className={`sr-chip ${tone}`}>{p.kind}</em>
    </span>
  );
}

export function Byline({ p }) {
  return (
    <span className="sr-by">
      <Avatar user={{ id: p.author_id, first_name: p.first_name, avatar: p.avatar }} size={20} />
      <b>{p.initial}.{p.first_name}</b>
      <small>· {fmtDate(p.created_at)}</small>
    </span>
  );
}


// Нийтлэлийн босоо карт (4 багана)
export function ArticleCard({ p, term = "" }) {
  return (
    <Link href={`/post/${p.id}`} className="sr-card">
      <Cover p={p} cls="top" />
      <span className="sr-body">
        <b className="sr-title"><Hl text={p.title} term={term} /></b>
        <span className="sr-text"><Hl text={snippet(p.subtitle || p.body, term)} term={term} /></span>
        <Byline p={p} />
      </span>
    </Link>
  );
}

// Мэдээний хэвтээ карт (2 багана)
export function NewsCard({ p, term = "" }) {
  return (
    <Link href={`/post/${p.id}`} className="sr-card row">
      <Cover p={p} cls="side" />
      <span className="sr-body">
        <b className="sr-title"><Hl text={p.title} term={term} /></b>
        <span className="sr-text"><Hl text={snippet(p.subtitle || p.body, term, 110)} term={term} /></span>
        <Byline p={p} />
      </span>
    </Link>
  );
}

// Архивын мөр (Figma 732:496): төрөл · үндсэн ангилал · салбар, гарчиг, товч, бичсэн · огноо
export function ArchiveRow({ p }) {
  const cr = crumbs(p.category).slice(0, 2);
  return (
    <Link href={`/post/${p.id}`} className="ac-row">
      <span className="ac-chips">
        <em className="main">{p.kind}</em>
        {cr.map((c) => <em key={c.path}>{c.name}</em>)}
      </span>
      <b>{p.title}</b>
      <span className="ac-text">{snippet(p.subtitle || p.body, "", 160)}</span>
      <small>{p.initial}.{p.first_name} · {fmtDate(p.created_at)}</small>
    </Link>
  );
}
