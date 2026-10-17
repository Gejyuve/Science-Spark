"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Share from "./Share";
import { proposeCategory, reportCategory } from "../tree/actions";
import { latinShare, LATIN_LIMIT, LATIN_MSG } from "@/lib/format";

const msg = (text) => ({
  onInvalid: (e) => e.target.setCustomValidity(text),
  onInput: (e) => e.target.setCustomValidity(""),
});

function useIndex(tree) {
  return useMemo(() => {
    const m = new Map();
    (function go(n) { m.set(n.path, n); n.kids.forEach(go); })(tree);
    return m;
  }, [tree]);
}

// Мод доторх байрлал сонгох: түвшин түвшнээр (сонгосон хамгийн сүүлийн нь эцэг ангилал болно)
function PathPicker({ tree, value, onChange, minDepth = 1, label = "Байрлах газар", optionalFrom = 1 }) {
  const idx = useIndex(tree);
  const parts = value ? value.split("/") : [];
  const levels = [];
  let cur = tree;
  for (let i = 0; i <= parts.length; i++) {
    if (!cur || !cur.kids.length) break;
    levels.push({ parent: cur, value: parts[i] ? parts.slice(0, i + 1).join("/") : "" });
    cur = parts[i] ? idx.get(parts.slice(0, i + 1).join("/")) : null;
  }
  return (
    <div className="cx-path">
      {levels.map((lv, i) => (
        <span key={lv.parent.path || "root"} className="cat-box">
          <select value={lv.value} onChange={(e) => onChange(e.target.value || parts.slice(0, i).join("/"))} aria-label={`${label} · ${i + 1}-р түвшин`}>
            <option value="">{i < minDepth ? "Сонгоно уу" : i >= optionalFrom ? "— энд нэмнэ" : "Сонгоно уу"}</option>
            {lv.parent.kids.map((k) => <option key={k.path} value={k.path}>{k.name}</option>)}
          </select>
          <img src="/icons/chevdown.svg" width={18} height={18} alt="" />
        </span>
      ))}
    </div>
  );
}

function Modal({ children, onClose, label }) {
  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [onClose]);
  return createPortal(
    <div className="tm-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="tm-modal" role="dialog" aria-modal="true" aria-label={label}>{children}</div>
    </div>,
    document.body
  );
}

// Шинэ ангилал санал болгох цонх (Шинэ үг нэмэхтэй төстэй)
function AddCategory({ tree, onClose, start = "" }) {
  const idx = useIndex(tree);
  const [parent, setParent] = useState(start && idx.get(start) ? start : "");
  const [v, setV] = useState({ name: "", en: "", note: "", examples: "", source: "" });
  const [state, action, pending] = useActionState(proposeCategory, null);
  const set = (k) => (e) => {
    setV((x) => ({ ...x, [k]: e.target.value }));
    if (k === "name") e.target.setCustomValidity(latinShare(e.target.value) > LATIN_LIMIT ? "Ангиллын нэрийг кириллээр бичнэ үү." : "");
    else if (k === "note") e.target.setCustomValidity(latinShare(e.target.value) > LATIN_LIMIT ? LATIN_MSG : "");
    else e.target.setCustomValidity("");
  };
  const trail = parent ? parent.split("/").map((_, i, a) => idx.get(a.slice(0, i + 1).join("/"))?.name).filter(Boolean) : [];
  const siblings = idx.get(parent)?.kids || [];
  return (
    <Modal onClose={onClose} label="Ангилал нэмэх">
      <div className="tm-head">
        <div>
          <b>Шинэ ангилал санал болгох</b>
          <small>Мод-нд байхгүй салбарыг санал болгоно уу. Редакц хянаад нэмнэ, шийдвэрийг мэдэгдлээр хүлээн авна.</small>
        </div>
        <button type="button" className="tm-x" onClick={onClose} aria-label="Хаах">×</button>
      </div>
      {state?.ok ? (
        <div className="tm-done">
          <span className="tm-done-ic">✓</span>
          <b>«{state.name}» санал редакцад очлоо</b>
          <p>«{state.where}» салбарын дор нэмэх саналыг тань редакц хянана. Батлагдвал Мод-нд шууд харагдана.</p>
          <div><button type="button" className="tm-btn" onClick={onClose}>Хаах</button></div>
        </div>
      ) : (
        <form action={action} className="tm-form">
          {state?.error && <p className="tm-err">{state.error}</p>}
          <input type="hidden" name="parent" value={parent} />
          <div className="tm-grid">
            <label className="wide"><span>Байрлах газар <i>*</i> <em>шинэ ангилал аль салбарын дор орох вэ</em></span>
              <PathPicker tree={tree} value={parent} onChange={setParent} />
              <input className="ii-req" tabIndex={-1} aria-hidden="true" required value={parent} onChange={() => {}}
                ref={(el) => el && el.setCustomValidity(parent ? "" : "Шинэ ангилал хаана байрлахыг сонгоно уу")} />
            </label>
            <label><span>Ангиллын нэр <i>*</i></span>
              <input name="name" required maxLength={60} value={v.name} onChange={set("name")} placeholder="Жишээ: Сансрын цаг уур" {...msg("Ангиллын нэрээ бичнэ үү")} /></label>
            <label><span>Англи нэр <i>*</i></span>
              <input name="en" required maxLength={80} value={v.en} onChange={set("en")} placeholder="Жишээ: Space weather" {...msg("Англи нэрээ бичнэ үү")} /></label>
            <label className="wide"><span>Юуг хамрах вэ, яагаад хэрэгтэй вэ? <i>*</i></span>
              <span className="tm-area">
                <textarea name="note" required minLength={20} maxLength={500} rows={3} value={v.note} onChange={set("note")}
                  placeholder="Энэ салбар юуг судалдаг, яагаад одоо байгаа ангиллуудад багтахгүй байгааг товч бичнэ үү…" {...msg("Тайлбараа дор хаяж 20 тэмдэгтээр бичнэ үү")} />
                <small>{v.note.length} / 500</small>
              </span>
            </label>
            <label><span>Жишээ сэдвүүд <em>заавал биш</em></span>
              <input name="examples" maxLength={300} value={v.examples} onChange={set("examples")} placeholder="Жишээ: нарны салхи, соронзон шуурга" /></label>
            <label><span>Эх сурвалжийн линк <em>заавал биш</em></span>
              <span className="tm-link"><img className="ic" src="/icons/f_link.svg" width={16} height={16} alt="" />
                <input name="source" type="url" maxLength={300} value={v.source} onChange={set("source")} placeholder="https://..." {...msg("Холбоос https:// -ээр эхэлнэ")} /></span></label>
          </div>
          <div className="tm-preview">
            <b>Мод-нд ингэж харагдана</b>
            <div className="cx-prev">
              <span>Шинжлэх ухаан</span>
              {trail.map((t) => <span key={t}>{t}</span>)}
              <span className="new">{v.name || "Шинэ ангилал"}{v.en && <i>{v.en}</i>}</span>
            </div>
            {siblings.length > 0 && (
              <small className="cx-sib">Энэ түвшинд одоо байгаа: {siblings.slice(0, 12).map((s) => s.name).join(", ")}{siblings.length > 12 ? "…" : ""}</small>
            )}
          </div>
          <div className="tm-foot">
            <small>Санал редакцын хяналтад очно.</small>
            <span className="ss-grow" />
            <button type="button" className="tm-btn ghost" onClick={onClose}>Болих</button>
            <button type="submit" className="tm-btn" disabled={pending}>{pending ? "Илгээж байна…" : "Илгээх"}</button>
          </div>
        </form>
      )}
    </Modal>
  );
}

const ISSUES = [
  ["Буруу байрласан", "Жишээ: «Астробиологи» нь «Биологи»-ийн дор байгаа ч «Одон орон»-той илүү холбоотой юм шиг санагдаж байна…"],
  ["Нэр буруу", "Жишээ: «Тригнометр» гэж бичсэн байна, «Тригонометр» гэж зөв бичнэ…"],
  ["Англи нэр буруу", "Жишээ: «Цэвдэг зүй»-н англи нэр «Cryology» биш «Geocryology» байх ёстой…"],
  ["Давхардсан", "Жишээ: «Механик» ба «Классик физик» хоёр ижил агуулгатай давхардаж байна…"],
  ["Дутуу ангилал", "Жишээ: «Хими»-ийн дор «Полимерийн хими» салбар дутуу байна…"],
  ["Бусад", "Ангиллын бүтэц, нэршилд байгаа алдааг товч бичнэ үү…"],
];

// Ангиллын логик алдаа мэдэгдэх цонх: жишээнүүд нь ангилалтай холбоотой
function ReportCategory({ tree, onClose, start = "" }) {
  const idx = useIndex(tree);
  const [path, setPath] = useState(start && idx.get(start) ? start : "");
  const [issue, setIssue] = useState(ISSUES[0][0]);
  const [n, setN] = useState(0);
  const [state, action, pending] = useActionState(reportCategory, null);
  const hint = ISSUES.find((x) => x[0] === issue)?.[1];
  return (
    <Modal onClose={onClose} label="Логик алдаа мэдэгдэх">
      <div className="tm-head">
        <div>
          <b>Ангиллын логик алдаа мэдэгдэх</b>
          <small>Ангиллын байршил, нэршил, давхардал зэрэг алдааг редакцад мэдэгдэнэ үү.</small>
        </div>
        <button type="button" className="tm-x" onClick={onClose} aria-label="Хаах">×</button>
      </div>
      {state?.ok ? (
        <div className="tm-done">
          <span className="tm-done-ic">✓</span>
          <b>Баярлалаа! Мэдэгдэл редакцад очлоо</b>
          <p>Алдаа шийдвэрлэгдсэн үед танд мэдэгдэл ирнэ.</p>
          <div><button type="button" className="tm-btn" onClick={onClose}>Хаах</button></div>
        </div>
      ) : (
        <form action={action} className="tm-form">
          {state?.error && <p className="tm-err">{state.error}</p>}
          <input type="hidden" name="path" value={path} />
          <input type="hidden" name="issue" value={issue} />
          <div className="tm-grid">
            <label className="wide"><span>Аль ангилалд? <em>заавал биш · сонгосон хамгийн сүүлийн ангилал</em></span>
              <PathPicker tree={tree} value={path} onChange={setPath} minDepth={0} optionalFrom={0} />
            </label>
            <div className="wide cx-issues">
              <span>Алдааны төрөл</span>
              <div>
                {ISSUES.map(([k]) => (
                  <button key={k} type="button" className={issue === k ? "on" : ""} onClick={() => setIssue(k)}>{k}</button>
                ))}
              </div>
            </div>
            <label className="wide"><span>Алдааны тайлбар <i>*</i></span>
              <span className="tm-area">
                <textarea name="body" required minLength={10} maxLength={300} rows={4} placeholder={hint} onInput={(e) => setN(e.target.value.length)}
                  {...msg("Алдааны тайлбараа дор хаяж 10 тэмдэгтээр бичнэ үү")} />
                <small>{n} / 300</small>
              </span>
            </label>
          </div>
          <p className="lr-note">🔒 Мэдэгдэл зөвхөн редакцад очно.</p>
          <div className="tm-foot">
            <span className="ss-grow" />
            <button type="button" className="tm-btn ghost" onClick={onClose}>Болих</button>
            <button type="submit" className="tm-btn" disabled={pending}>{pending ? "Илгээж байна…" : "Илгээх"}</button>
          </div>
        </form>
      )}
    </Modal>
  );
}

// «Ангилал нэмэх» + хуваалцах + логик алдаа мэдэгдэх товчнууд
export default function CatTools({ tree, loggedIn, start = "", sharePath = "/tree", shareTitle = "Шинжлэх ухааны мод", compact = false }) {
  const [open, setOpen] = useState(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const close = () => setOpen(null);
  return (
    <div className={"cx-tools" + (compact ? " compact" : "")}>
      {loggedIn ? (
        <button type="button" className="cx-add" onClick={() => setOpen("add")}>＋ Ангилал нэмэх</button>
      ) : (
        <Link href="/login" className="cx-add">＋ Ангилал нэмэх</Link>
      )}
      <span className="cx-share"><Share path={sharePath} title={shareTitle} align="right" /></span>
      {loggedIn ? (
        <button type="button" className="cx-flag" onClick={() => setOpen("report")} title="Логик алдаа мэдэгдэх">
          <img className="ic" src="/icons/flag20.svg" width={16} height={16} alt="" />{!compact && "Логик алдаа мэдэгдэх"}
        </button>
      ) : (
        <Link href="/login" className="cx-flag" title="Логик алдаа мэдэгдэх"><img className="ic" src="/icons/flag20.svg" width={16} height={16} alt="" />{!compact && "Логик алдаа мэдэгдэх"}</Link>
      )}
      {mounted && open === "add" && <AddCategory tree={tree} onClose={close} start={start} />}
      {mounted && open === "report" && <ReportCategory tree={tree} onClose={close} start={start} />}
    </div>
  );
}
