"use client";

import { useState } from "react";
import Link from "next/link";
import { quickPost } from "../posts/actions";
import { EVENT_TYPES, EVENT_FORMATS } from "@/lib/format";

// Figma: Нүүр · Асуулт бичих (шууд) / Хуваалцах (шууд) / Бодрол / Эвент / Зарлал
const Ic = ({ n, s = 18 }) => <img className="ic" src={`/icons/${n}.svg`} width={s} height={s} alt="" />;

function Counted({ name, max, rows, placeholder, required }) {
  const [v, setV] = useState("");
  return (
    <div className="cp-area">
      <textarea name={name} maxLength={max} rows={rows} value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} required={required} />
      <span>{v.length} / {max}</span>
    </div>
  );
}

function Field({ icon, children }) {
  return <label className="cp-field"><Ic n={icon} />{children}</label>;
}

function ImageSlot({ title, hint, wide }) {
  return (
    <div className={"cp-img soon" + (wide ? " wide" : "")} title="Зураг оруулах боломж тун удахгүй">
      <Ic n="sh_img" s={22} />
      <b>{title}</b>
      <small>{hint}</small>
    </div>
  );
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

export default function Composer({ loggedIn, initial, error }) {
  const [mode, setMode] = useState(initial || null);
  const toggle = (m) => setMode((cur) => (cur === m ? null : m));
  const shareModes = ["share", "Бодрол", "Эвент", "Зарлал"];

  let panel = null;
  if (mode === "Асуулт") {
    panel = (
      <form action={quickPost} className="cp-panel cp-ask">
        <input type="hidden" name="kind" value="Асуулт" />
        <div className="cp-ask-row">
          <img src="/icons/person.svg" width={32} height={32} alt="" />
          <Counted name="body" max={300} rows={3} required placeholder="Хариултаас илүү асуултаар нь хүнийг амархан таньж болно.   -Voltaire" />
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
        <Head icon="sh_bulb" title="Бодрол" />
        <Counted name="body" max={300} rows={5} required placeholder={"Би сэтгэж байна, тиймээс би оршиж байна...\n\n-Рене Декарт"} />
        <div className="cp-split">
          <ImageSlot title="Зураг нэмэх (1 ширхэг)" hint="2:1 · өргөн · тун удахгүй" wide />
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
        <Head icon="sh_cal" title="Эвент" right={<span className="cp-note"><Req /> Заавал бөглөх талбар</span>} />
        <div className="cp-grid">
          <Field icon="f_text"><input name="title" required maxLength={200} placeholder="Эвентийн нэр *" /></Field>
          <Field icon="f_tag">
            <select name="type" required defaultValue="">
              <option value="" disabled>Төрөл: Лекц *</option>
              {EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
            <Ic n="f_chev" />
          </Field>
          <Field icon="f_date"><input name="starts_at" type="datetime-local" required aria-label="Огноо ба эхлэх цаг *" /></Field>
          <Field icon="f_globe">
            <select name="format" required defaultValue="">
              <option value="" disabled>Хэлбэр: Онлайн / Танхим / Хосолсон *</option>
              {EVENT_FORMATS.map((t) => <option key={t}>{t}</option>)}
            </select>
            <Ic n="f_chev" />
          </Field>
          <Field icon="f_pin"><input name="location" required maxLength={200} placeholder="Байршил (хаяг эсвэл онлайн холбоос) *" /></Field>
          <Field icon="f_clock"><input name="duration" required maxLength={60} placeholder="Үргэлжлэх хугацаа (жишээ: 1 цаг 30 минут) *" /></Field>
          <Field icon="f_ticket"><input name="price" required maxLength={60} placeholder="Тасалбарын үнэ (₮ эсвэл үнэгүй) *" /></Field>
          <Field icon="f_people"><input name="capacity" inputMode="numeric" maxLength={10} placeholder="Бүртгэх хүний хязгаар (заавал биш)" /></Field>
        </div>
        <Counted name="body" max={1000} rows={5} required placeholder="Эвентийн дэлгэрэнгүй тайлбар… *" />
        <Counted name="register" max={500} rows={3} required placeholder="Бүртгүүлэх заавар (хэрхэн бүртгүүлэх, ямар мэдээлэл шаардах, холбоос хэзээ ирэх)… *" />
        <div className="cp-split">
          <div className="cp-col">
            <span className="cp-label">Ковер зураг</span>
            <div className="cp-row"><ImageSlot title="Зураг нэмэх" hint="1:1 · тун удахгүй" /><small className="cp-hint">Дөрвөлжин (1:1) хэмжээтэй, зөвхөн 1 зураг оруулна.</small></div>
          </div>
          <div className="cp-col">
            <span className="cp-label">Хөтөлбөрийн зураг <em className="cp-opt">Заавал биш</em></span>
            <ImageSlot title="Хөтөлбөрийн зураг нэмэх" hint="Хүсвэл тайлбар дээрээ бичиж болно · тун удахгүй" wide />
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
        <Head icon="sh_mega" title="Зарлал" />
        <Field icon="f_text"><input name="title" required maxLength={200} placeholder="Зарлалын гарчиг" /></Field>
        <div className="cp-grid">
          <Field icon="f_date"><input name="valid_until" type="date" aria-label="Хүчинтэй хугацаа" title="Хүчинтэй хугацаа" /></Field>
          <Field icon="f_phone"><input name="contact" maxLength={120} placeholder="Холбоо барих" /></Field>
        </div>
        <Counted name="body" max={500} rows={4} required placeholder="Зарлалын агуулга…" />
        <div className="cp-split">
          <ImageSlot title="Зураг" hint="1:1 харьцаа · тун удахгүй" />
          <div className="cp-col">
            <span className="cp-label">Эх сурвалж</span>
            <Field icon="f_link"><input name="source" type="url" maxLength={300} placeholder="Холбоос эсвэл эх сурвалж" /></Field>
            <small className="cp-hint">Зөвхөн 1 зураг оруулах боломжтой. Эх сурвалж заавал биш.</small>
          </div>
        </div>
        <div className="cp-actions">
          <span className="cp-review"><img src="/icons/f_shield.svg" width={18} height={18} alt="" />Редакцын зөвшөөрлөөр нийтлэгдэнэ</span>
          <span className="ss-grow" />
          <button type="submit" className="cp-btn">Редакц руу илгээх</button>
        </div>
      </form>
    );
  }

  return (
    <>
      {error && <p className="error cp-error">{error}</p>}
      {panel || (
        <Link href={loggedIn ? "/write" : "/login"} className="ss-composer">
          <img src="/icons/person.svg" width={32} height={32} alt="" />
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
