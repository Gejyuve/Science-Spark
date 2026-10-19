"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { quickPost } from "../posts/actions";
import ImageInput, { sizeLabel } from "./ImageInput";
import BountyAsk from "./BountyAsk";
import { EVENT_TYPES, EVENT_FORMATS, EVENT_BODY_MIN, ANNOUNCE_TYPES, latinShare, LATIN_LIMIT, LATIN_MSG } from "@/lib/format";

// Figma: Нүүр · Асуулт бичих (шууд) / Хуваалцах (шууд) / Бодрол / Эвент / Зарлал
const Ic = ({ n, s = 18 }) => <img className="ic" src={`/icons/${n}.svg`} width={s} height={s} alt="" />;

function Counted({ name, max, min = 0, rows, placeholder, required, latinCheck }) {
  const [v, setV] = useState("");
  const tooLatin = latinCheck && latinShare(v) > LATIN_LIMIT;
  return (
    <div className={"cp-area" + (tooLatin ? " bad" : "")}>
      <textarea
        name={name} maxLength={max} minLength={min || undefined} rows={rows} value={v} placeholder={placeholder} required={required}
        onChange={(e) => {
          setV(e.target.value);
          e.target.setCustomValidity(latinCheck && latinShare(e.target.value) > LATIN_LIMIT ? LATIN_MSG : "");
        }}
      />
      {tooLatin && <em className="cp-latin">{LATIN_MSG}</em>}
      <span className={min && v.trim().length < min ? "cp-short" : ""}>{min && v.trim().length < min ? `дор хаяж ${min} · ` : ""}{v.length} / {max}</span>
    </div>
  );
}

// Огноо + цаг тусдаа: хагас цаг тутмаар сонгоно, анхааруулга монголоор
const TIMES = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
const msg = (text) => ({
  onInvalid: (e) => e.target.setCustomValidity(text),
  onInput: (e) => e.target.setCustomValidity(""),
});
// Улаанбаатарын одоогийн огноо, цаг ("YYYY-MM-DD", "HH:MM")
function nowUB() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ulaanbaatar", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}
// minDate өдөр сонгогдсон бол minTime-аас хойшхи цагийг л зөвшөөрнө
function DateTime({ icon, label, name, minDate, minTime, onPick, tooEarly }) {
  const [d, setD] = useState("");
  const [t, setT] = useState("");
  const sameDay = minDate && d === minDate;
  const timeBad = sameDay && t && minTime && t <= minTime;
  return (
    <label className="cp-field cp-dtf">
      <Ic n={icon} />
      <span className="cp-dt">{label} *</span>
      <input type="date" required value={d} min={minDate || undefined} aria-label={`${label} огноо`}
        {...msg(minDate && d && d < minDate ? tooEarly : "Огноогоо бүрэн сонгоно уу (он, сар, өдөр)")}
        onChange={(e) => { setD(e.target.value); onPick && onPick(e.target.value && t ? `${e.target.value}T${t}` : "", e.target.value); e.target.setCustomValidity(""); }} />
      <select required value={t} aria-label={`${label} цаг`} {...msg(timeBad ? tooEarly : "Цагаа сонгоно уу")}
        ref={(el) => el && el.setCustomValidity(timeBad ? tooEarly : "")}
        onChange={(e) => { setT(e.target.value); onPick && onPick(d && e.target.value ? `${d}T${e.target.value}` : "", d); }}>
        <option value="" disabled>Цаг</option>
        {TIMES.map((x) => <option key={x} disabled={!!(sameDay && minTime && x <= minTime)}>{x}</option>)}
      </select>
      <input type="hidden" name={name} value={d && t ? `${d}T${t}` : ""} />
    </label>
  );
}

function Field({ icon, children }) {
  return <label className="cp-field"><Ic n={icon} />{children}</label>;
}

const slotW = (aspect) => (aspect && aspect <= 1 ? 1080 : 1600);
function ImageSlot({ name, title, hint, wide, aspect, required }) {
  return <ImageInput name={name} aspect={aspect} maxW={slotW(aspect)} variant={wide ? "slot wide" : "slot"} title={title} hint={hint} required={required} />;
}

function Head({ icon, title, right }) {
  return (
    <div className="cp-head">
      <span className="cp-ico"><img src={`/icons/${icon}.svg`} width={20} height={20} alt="" /></span>
      <b>{title}</b>
      <span className="ss-grow" />
      {right}
    </div>
  );
}

const Req = () => <i className="cp-req">*</i>;

export default function Composer({ loggedIn, me, initial, error, wallet = 0, club = null, clubAv = null, initialAs }) {
  const [mode, setMode] = useState(initial || null);
  // Клубын удирдагч: «Өөрөө» эсвэл «Клуб»-ын нэрээр. Клубын нэрээр бол Даалгавар · Тайлан · Хуваалцъя
  const [asClub, setAsClub] = useState(!!club && initialAs === "club");
  // Сүүлд сонгосноо санана (зөвхөн энэ хөтөчид)
  useEffect(() => {
    if (!club || initialAs) return;
    try { if (localStorage.getItem("ss-as") === "club") setAsClub(true); } catch (e) {}
  }, [club, initialAs]);
  useEffect(() => {
    if (!club) return;
    try { localStorage.setItem("ss-as", asClub ? "club" : "me"); } catch (e) {}
  }, [club, asClub]);
  const clubIn = asClub ? <input type="hidden" name="as_club" value="1" /> : null;
  const by = (k) => (asClub ? `${k} · ${club.name} клубын нэрээр` : k);
  const [start, setStart] = useState({ full: "", date: "" });
  const [now, setNow] = useState({ date: "", time: "" });
  useEffect(() => setNow(nowUB()), [mode]);
  const toggle = (m) => setMode((cur) => (cur === m ? null : m));
  const shareModes = ["share", "Бодрол", "Эвент", "Зарлал"];

  // Асуулт: «Асуух» дарахад нийтлэхээс өмнө шагнал нэмэх эсэхийг асууна
  const askForm = useRef(null);
  const askBounty = useRef(null);
  const [bqOpen, setBqOpen] = useState(false);
  const closeBq = useCallback(() => setBqOpen(false), []);
  const pickBq = (amt) => {
    const f = askForm.current;
    setBqOpen(false);
    if (!f) return;
    askBounty.current.value = amt > 0 ? String(amt) : "";
    f.dataset.go = "1";
    f.requestSubmit();
    delete f.dataset.go;
  };

  let panel = null;
  if (mode === "Асуулт") {
    panel = (
      <form action={quickPost} className="cp-panel cp-ask" ref={askForm}
        onSubmit={(e) => { if (!e.currentTarget.dataset.go) { e.preventDefault(); setBqOpen(true); } }}>
        <input type="hidden" name="kind" value="Асуулт" />
        <input type="hidden" name="bounty" ref={askBounty} />
        {bqOpen && <BountyAsk wallet={wallet} onPick={pickBq} onClose={closeBq} />}
        <div className="cp-ask-row">
          {me || <img src="/icons/person.svg" width={32} height={32} alt="" />}
          <Counted name="body" max={300} rows={3} required latinCheck placeholder="Хариултаас илүү асуултаар нь хүнийг амархан таньж болно.   -Voltaire" />
        </div>
        <div className="cp-actions"><span className="ss-grow" /><button type="submit" className="cp-btn">Асуух</button></div>
      </form>
    );
  } else if (mode === "share") {
    panel = (
      <div className="cp-panel cp-options">
        {[["Бодрол", "sh_bulb"], ["Эвент", "sh_cal"], ["Зарлал", "sh_mega"]].map(([k, ic]) => (
          <button key={k} type="button" className="cp-option" onClick={() => setMode(k)}>
            <span className="cp-ico big"><img src={`/icons/${ic}.svg`} width={22} height={22} alt="" /></span>
            <b>{k}</b>
          </button>
        ))}
      </div>
    );
  } else if (mode === "Бодрол") {
    panel = (
      <form action={quickPost} className="cp-panel">
        <input type="hidden" name="kind" value="Бодрол" />
        {clubIn}
        <Head icon="sh_bulb" title={by("Бодрол")} />
        <Counted name="body" max={300} rows={5} required latinCheck placeholder={"Би сэтгэж байна, тиймээс би оршиж байна...\n\n-Рене Декарт"} />
        <div className="cp-split">
          <ImageSlot name="image" aspect={2} title="Зураг нэмэх (1 ширхэг)" hint="2:1 · өргөн" wide />
          <div className="cp-col">
            <span className="cp-label">Эх сурвалж</span>
            <Field icon="f_link"><input name="source" type="url" maxLength={300} placeholder="Эх сурвалжийн холбоос (https://…)" /></Field>
            <small className="cp-hint">Зөвхөн 1 зураг. Хэмжээ нь нийтлэлийн ковертой ижил (2:1) эсвэл арай өргөн. Эх сурвалж заавал биш.</small>
          </div>
        </div>
        <div className="cp-actions"><span className="ss-grow" /><button type="submit" className="cp-btn">Шидэх</button></div>
      </form>
    );
  } else if (mode === "Эвент") {
    panel = (
      <form action={quickPost} className="cp-panel">
        <input type="hidden" name="kind" value="Эвент" />
        {clubIn}
        <Head icon="sh_cal" title={by("Эвент")} right={<span className="cp-note"><Req /> Заавал бөглөх талбар</span>} />
        <div className="cp-grid">
          <Field icon="f_text"><input name="title" required maxLength={200} placeholder="Эвентийн нэр *" /></Field>
          <Field icon="f_tag">
            <select name="type" required defaultValue="">
              <option value="" disabled>Төрөл: Лекц *</option>
              {EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
            <Ic n="f_chev" />
          </Field>
          <DateTime icon="f_date" label="Эхлэх" name="starts_at" minDate={now.date || undefined} minTime={now.time || undefined}
            tooEarly="Өнгөрсөн огноо, цаг сонгох боломжгүй" onPick={(full, date) => setStart({ full, date })} />
          <DateTime icon="f_clock" label="Дуусах" name="ends_at" minDate={start.date || now.date || undefined} minTime={start.full ? start.full.slice(11) : now.time || undefined}
            tooEarly="Дуусах цаг эхлэх цагаас хойш байх ёстой" />
          <Field icon="f_globe">
            <select name="format" required defaultValue="">
              <option value="" disabled>Хэлбэр: Онлайн / Танхим / Хосолсон *</option>
              {EVENT_FORMATS.map((t) => <option key={t}>{t}</option>)}
            </select>
            <Ic n="f_chev" />
          </Field>
          <Field icon="f_pin"><input name="location" required maxLength={200} placeholder="Байршил (хаяг эсвэл онлайн холбоос) *" /></Field>

          <Field icon="f_ticket"><input name="price" required maxLength={60} placeholder="Тасалбарын үнэ (₮ эсвэл үнэгүй) *" /></Field>
          <Field icon="f_people"><input name="capacity" inputMode="numeric" maxLength={10} placeholder="Бүртгэх хүний хязгаар (заавал биш)" /></Field>
        </div>
        <Counted name="body" max={1000} min={EVENT_BODY_MIN} rows={5} required latinCheck placeholder={`Эвентийн дэлгэрэнгүй тайлбар (дор хаяж ${EVENT_BODY_MIN} тэмдэгт)… *`} />
        <Counted name="register" max={500} rows={3} required latinCheck placeholder="Бүртгүүлэх заавар (хэрхэн бүртгүүлэх, ямар мэдээлэл шаардах, холбоос хэзээ ирэх)… *" />
        <div className="cp-split">
          <div className="cp-col">
            <span className="cp-label">Ковер зураг <Req /></span>
            <div className="cp-row"><ImageSlot name="image" aspect={1} title="Зураг нэмэх" hint="1:1" required /><small className="cp-hint">Дөрвөлжин (1:1), сайтад <b>{sizeLabel(1, slotW(1))}</b> хэмжээтэй орно. Ийм эсвэл үүнээс том дөрвөлжин зураг оруулбал тайрагдахгүй. Зөвхөн 1 зураг.</small></div>
          </div>
          <div className="cp-col">
            <span className="cp-label">Хөтөлбөрийн зураг <em className="cp-opt">Заавал биш</em></span>
            <ImageSlot name="program" title="Хөтөлбөрийн зураг нэмэх" hint="Хүсвэл тайлбар дээрээ бичиж болно" wide />
          </div>
        </div>
        <span className="cp-label">Бүртгэлийн холбоос / эх сурвалж (заавал биш)</span>
        <Field icon="f_link"><input name="link" type="url" maxLength={300} placeholder="Энд линкээ хуулж тавиарай." /></Field>
        <small className="cp-hint">Бүртгүүлэх хуудас эсвэл эвентийн вэб холбоос. Заавал биш.</small>
        <div className="cp-actions">
          <span className="cp-review"><img src="/icons/f_shield.svg" width={18} height={18} alt="" />Редакцын зөвшөөрлөөр нийтлэгдэнэ</span>
          <span className="ss-grow" />
          <button type="submit" className="cp-btn">Редакц руу илгээх</button>
        </div>
      </form>
    );
  } else if (mode === "Зарлал") {
    panel = (
      <form action={quickPost} className="cp-panel">
        <input type="hidden" name="kind" value="Зарлал" />
        {clubIn}
        <Head icon="sh_mega" title={by("Зарлал")} right={<span className="cp-note"><Req /> Заавал бөглөх талбар</span>} />
        <div className="cp-grid">
          <Field icon="f_text"><input name="title" required maxLength={200} placeholder="Зарлалын гарчиг *" {...msg("Гарчгаа бичнэ үү")} /></Field>
          <Field icon="f_tag">
            <select name="type" required defaultValue="" {...msg("Зарлалын төрлөө сонгоно уу")}>
              <option value="" disabled>Зарлалын төрөл: Элсэлт *</option>
              {ANNOUNCE_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
            <Ic n="f_chev" />
          </Field>
          <label className="cp-field cp-dtf half">
            <Ic n="f_date" />
            <span className="cp-dt">Хүртэл *</span>
            <input type="date" name="valid_until" required min={now.date || undefined} aria-label="Хүчинтэй хугацаа (хүртэл)"
              {...msg("Зарлал хүчинтэй байх сүүлийн өдрийг сонгоно уу (өнөөдрөөс хойш)")} />
          </label>
          <Field icon="f_phone"><input name="contact" required maxLength={120} placeholder="Холбоо барих (утас эсвэл и-мэйл) *" {...msg("Холбоо барих утас эсвэл и-мэйлээ бичнэ үү")} /></Field>
          <Field icon="f_pin"><input name="location" maxLength={200} placeholder="Байршил (заавал биш)" /></Field>
          <Field icon="f_link"><input name="link" type="url" maxLength={300} placeholder="Холбоос (заавал биш)" {...msg("Холбоос https:// -ээр эхэлнэ")} /></Field>
        </div>
        <Counted name="body" max={500} min={EVENT_BODY_MIN} rows={5} required latinCheck placeholder={`Зарлалын агуулга (дор хаяж ${EVENT_BODY_MIN} тэмдэгт)… *`} />
        <span className="cp-label">Зураг <Req /></span>
        <div className="cp-row"><ImageSlot name="image" aspect={1} title="Зураг нэмэх" hint="1:1" required /><small className="cp-hint">Дөрвөлжин (1:1), сайтад <b>{sizeLabel(1, slotW(1))}</b> хэмжээтэй орно. Ийм эсвэл үүнээс том дөрвөлжин зураг оруулбал тайрагдахгүй. Зөвхөн 1 зураг.</small></div>
        <div className="cp-actions">
          <span className="cp-review"><img src="/icons/f_shield.svg" width={18} height={18} alt="" />Редакцын зөвшөөрлөөр нийтлэгдэнэ</span>
          <span className="ss-grow" />
          <button type="submit" className="cp-btn">Редакц руу илгээх</button>
        </div>
      </form>
    );
  }

  const asSwitch = club && (
    <div className="cp-as" role="radiogroup" aria-label="Хэний нэрээр">
      <button type="button" role="radio" aria-checked={!asClub} className={asClub ? "" : "on"}
        onClick={() => { setAsClub(false); setMode(null); }}>{me}<span>Өөрөө</span></button>
      <button type="button" role="radio" aria-checked={asClub} className={asClub ? "on" : ""}
        onClick={() => { setAsClub(true); setMode((m) => (shareModes.includes(m) ? m : null)); }}>{clubAv}<span>{club.name}</span></button>
    </div>
  );

  if (asClub) {
    return (
      <>
        {error && <p className="error cp-error">{error}</p>}
        {asSwitch}
        {(mode !== "Асуулт" && panel) || (
          <Link href="/tasks/new" className="ss-composer">
            {clubAv}
            <span>Клубынхээ туршлагыг хуваалцаж, бусад клубт урам өгье</span>
          </Link>
        )}
        <div className="ss-tabs">
          <Link href="/tasks/new"><Ic n="task" s={22} /><span>Даалгавар</span></Link>
          <Link href="/reports/new"><Ic n="report" s={22} /><span>Тайлан</span></Link>
          <button type="button" className={shareModes.includes(mode) ? "on" : ""} onClick={() => setMode((c) => (shareModes.includes(c) ? null : "share"))}><Ic n="share" s={22} /><span>Хуваалцъя</span></button>
        </div>
      </>
    );
  }

  return (
    <>
      {error && <p className="error cp-error">{error}</p>}
      {asSwitch}
      {panel || (
        <Link href={loggedIn ? "/write" : "/login"} className="ss-composer">
          {me || <img src="/icons/person.svg" width={32} height={32} alt="" />}
          <span>{loggedIn ? "Өнөөдөр ямар оч асаах гэж байна даа?" : "Нийтлэл бичихийн тулд нэвтэрнэ үү"}</span>
        </Link>
      )}
      <div className="ss-tabs">
        <Link href={loggedIn ? "/write" : "/login"}><Ic n="write" s={22} /><span>Бичье</span></Link>
        {loggedIn ? (
          <button type="button" className={mode === "Асуулт" ? "on" : ""} onClick={() => toggle("Асуулт")}><Ic n="asktab" s={22} /><span>Асууя</span></button>
        ) : (
          <Link href="/login"><Ic n="asktab" s={22} /><span>Асууя</span></Link>
        )}
        {loggedIn ? (
          <button type="button" className={shareModes.includes(mode) ? "on" : ""} onClick={() => setMode((c) => (shareModes.includes(c) ? null : "share"))}><Ic n="share" s={22} /><span>Хуваалцъя</span></button>
        ) : (
          <Link href="/login"><Ic n="share" s={22} /><span>Хуваалцъя</span></Link>
        )}
      </div>
    </>
  );
}
