"use client";

import ImageInput from "../../components/ImageInput";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { saveProfile } from "../actions";
import { POINTS, POINTS_TOTAL, OPTIONS, COUNTRIES, MN_CITIES, SCHOOLS, SOCIALS, countWords, nameCase, checkName } from "@/lib/profile";
import { AGREEMENT } from "@/lib/agreement";
import { useDraft, hhmm } from "@/lib/useDraft";

const MONTHS = ["1-р сар", "2-р сар", "3-р сар", "4-р сар", "5-р сар", "6-р сар", "7-р сар", "8-р сар", "9-р сар", "10-р сар", "11-р сар", "12-р сар"];
const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: THIS_YEAR - 1930 + 1 }, (_, i) => THIS_YEAR - i);
// Сонгосон он, сард байх өдрийн тоо (2-р сарын 30 гэх мэт буруу огноо сонгогдохгүй)
const daysIn = (y, m) => (m ? new Date(Date.UTC(Number(y) || 2000, Number(m), 0)).getUTCDate() : 31);

function earnedFrom(form) {
  if (!form) return {};
  const fd = new FormData(form);
  const has = (k) => String(fd.get(k) || "").trim() !== "";
  const e = {};
  for (const k of ["gender", "about", "birth_country", "birth_city", "live_country", "live_city", "education", "school", "orcid", "profession", "job", "origin_view", "religion", "belief", "politics"]) {
    if (has(k)) e[k] = true;
  }
  if (has("by") && has("bm") && has("bd")) e.birth_date = true;
  if (SOCIALS.some((s) => has(`s_${s.key}`))) e.socials = true;
  return e;
}

function Pts({ k, on }) {
  return (
    <span className={"pf-pts" + (on ? " on" : "")}>
      <img src="/icons/pts.svg" width={14} height={14} alt="" />+{POINTS[k]} оч
    </span>
  );
}

function Label({ children, k, on, required }) {
  return (
    <div className="pf-label">
      <span>{children}{required && <i>*</i>}</span>
      {required && <em>Заавал</em>}
      {k && <Pts k={k} on={on} />}
    </div>
  );
}

function Select({ name, options, value, placeholder, onChange }) {
  return (
    <div className="pf-select">
      <select name={name} defaultValue={value || ""} onChange={onChange}>
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <img src="/icons/chev16.svg" width={16} height={16} alt="" />
    </div>
  );
}

function Inner({ user, profile, error, isNew, formRef, dr }) {
  const p = profile || {};
  const [earned, setEarned] = useState(() => {
    const e = {};
    for (const k of Object.keys(POINTS)) if (p[k] && k !== "socials") e[k] = true;
    if (p.socials && Object.keys(p.socials).length) e.socials = true;
    return e;
  });
  const [surname, setSurname] = useState(user.surname || "");
  const [first, setFirst] = useState(user.first_name || "");
  const [about, setAbout] = useState(p.about || "");
  const total = Object.keys(earned).reduce((a, k) => a + (POINTS[k] || 0), 0);
  const bd = p.birth_date ? new Date(p.birth_date) : null;
  const [ym, setYm] = useState({ y: bd ? bd.getUTCFullYear() : "", m: bd ? bd.getUTCMonth() + 1 : "" });
  const [terms, setTerms] = useState(false);
  const preview = surname && first ? `${surname.trim()[0]?.toUpperCase() || ""}.${nameCase(first.trim(), user.account_type || "person")}` : "Х.Нэр";
  // Овог, нэрийн алдааг бичих зуур харуулж, алдаатай бол хадгалахыг хөтөч дээрээ зогсооно
  const surnameErr = surname.trim() ? checkName(surname, user.account_type || "person") : null;
  const firstErr = first.trim() ? checkName(first, user.account_type || "person") : null;
  const surnameRef = useRef(null), firstRef = useRef(null);
  useEffect(() => {
    surnameRef.current?.setCustomValidity(surnameErr ? `Овог ${surnameErr}` : "");
    firstRef.current?.setCustomValidity(firstErr ? `Нэр ${firstErr}` : "");
  }, [surnameErr, firstErr]);

  return (
    <form ref={formRef} action={saveProfile} className="pf-col" onChange={() => setEarned(earnedFrom(formRef.current))} onSubmit={dr.drop}>
      <section className="pf-card pf-head">
        <div className="pf-head-top">
          <img src="/icons/logo.svg" width={56} height={56} alt="" />
          <b>{isNew ? "Өөрийгөө танилцуулж улам тод гэрэлтээрэй!" : "Профайлаа засварлах"}</b>
          <span className="pf-total"><strong>{total}</strong> / {POINTS_TOTAL} оч</span>
        </div>
        <div className="pf-bar"><i style={{ width: `${(total / POINTS_TOTAL) * 100}%` }} /></div>
        {dr.restoredAt && (
          <p className="wr-restored"><span>↺ Өмнө бөглөж байсан ноорог тань сэргээгдлээ ({hhmm(dr.restoredAt)}).</span>
            <button type="button" onClick={dr.clear}>Ноорог устгах</button></p>
        )}
        {isNew && <p className="pf-intro">Заавал бөглөх нь зөвхөн <b>овог, нэр</b>. Бусад мэдээллийг хүссэн үедээ нөхөж, талбар бүрээр оч цуглуулаарай.</p>}
        {error && <p className="error">{error}</p>}
        {dr.savedAt && <small className="cf-saved">✓ Ноорог энэ төхөөрөмж дээр хадгалагдсан · {hhmm(dr.savedAt)}</small>}
      </section>

      <section className="pf-card">
        <div className="pf-coverwrap">
          <ImageInput name="cover" aspect={3} maxW={1920} variant="cover" adjust size={false} initial={p.cover_id || null} initialSrc={p.cover_src || null} initialPos={p.cover_pos || null}>
            <img src="/icons/camera18.svg" width={18} height={18} alt="" />
            <b>Ковер зураг нэмэх</b>
            <small>Өргөн зураг · 1920×640 px (3:1) · JPG, PNG, WEBP</small>
          </ImageInput>
          <span className="pf-cover-pts"><Pts k="cover" on={!!p.cover_id} /></span>
        </div>
        <div className="pf-photo">
          <ImageInput name="avatar" aspect={1} maxW={480} variant="avatar" adjust size={false} initial={user.avatar || null} initialSrc={user.avatar_src || null} initialPos={user.avatar_pos || null}
            badge={<span className="pf-cam"><img src="/icons/cam16.svg" width={16} height={16} alt="" /></span>}>
            <img src="/icons/person40.svg" width={40} height={40} alt="" />
          </ImageInput>
          <div><b>Нүүр зураг</b><Pts k="photo" /><small className="cf-hint pf-size">Дөрвөлжин зураг · 480×480 px</small></div>
        </div>
        <label className="pf-email">
          <span className="pf-mailtile"><img src="/icons/mail.svg" width={20} height={20} alt="" /></span>
          <b>{user.email}</b>
          <span className="pf-grow" />
          <span className="pf-muted">Бусдад харуулах</span>
          <input type="checkbox" name="email_public" defaultChecked={!!p.email_public} className="pf-switch" />
        </label>
      </section>

      <section className="pf-card">
        <h2>Би хэн бэ?</h2>
        <p className="pf-sub">Бөглөсөн тохиолдолд бусад хүмүүст харагдана</p>
        <div className="pf-grid2">
          <div>
            <Label required>Овог</Label>
            <div className={"pf-input" + (surnameErr ? " bad" : "")}>
              <input ref={surnameRef} name="surname" required maxLength={20} value={surname} onChange={(e) => setSurname(e.target.value)} placeholder="Овгоо бичнэ үү" autoComplete="family-name" aria-invalid={!!surnameErr} />
              <span>{surname.length} / 20</span>
            </div>
          </div>
          <div>
            <Label required>Нэр</Label>
            <div className={"pf-input" + (firstErr ? " bad" : "")}>
              <input ref={firstRef} name="first_name" required maxLength={20} value={first} onChange={(e) => setFirst(e.target.value)} placeholder="Нэрээ бичнэ үү" autoComplete="given-name" aria-invalid={!!firstErr} />
              <span>{first.length} / 20</span>
            </div>
          </div>
        </div>
        <p className={"pf-rule" + (surnameErr || firstErr ? " bad" : "")}>
          {surnameErr || firstErr
            ? <>{surnameErr ? `Овог ${surnameErr}` : `Нэр ${firstErr}`}. Тоо, тэмдэг, зай оруулахгүй; давхар нэрийг зураасаар (Бат-Эрдэнэ) бичнэ.</>
            : <>Зөвхөн кирилл үсгээр бичнэ (латин үсэг хориглоно). Нийтэд «<b>{preview}</b>» гэж харагдана.</>}
        </p>

        <Label k="gender" on={earned.gender}>Хүйс</Label>
        <div className="pf-chips">
          {OPTIONS.gender.map((g) => (
            <label key={g} className="pf-chip">
              <input type="radio" name="gender" value={g} defaultChecked={p.gender === g} />
              <span>{g}</span>
            </label>
          ))}
        </div>

        <Label k="birth_date" on={earned.birth_date}>Төрсөн он, сар, өдөр</Label>
        <div className="pf-grid3">
          <Select name="by" options={YEARS.map(String)} value={bd ? String(bd.getUTCFullYear()) : ""} placeholder="Он" onChange={(e) => setYm((v) => ({ ...v, y: e.target.value }))} />
          <div className="pf-select">
            <select name="bm" defaultValue={bd ? String(bd.getUTCMonth() + 1) : ""} onChange={(e) => setYm((v) => ({ ...v, m: e.target.value }))}>
              <option value="">Сар</option>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <img src="/icons/chev16.svg" width={16} height={16} alt="" />
          </div>
          <Select name="bd" options={Array.from({ length: daysIn(ym.y, ym.m) }, (_, i) => String(i + 1))} value={bd ? String(bd.getUTCDate()) : ""} placeholder="Өдөр" />
        </div>

        <Label k="about" on={earned.about}>Миний тухай</Label>
        <div className="pf-area">
          <textarea name="about" rows={3} value={about} onChange={(e) => setAbout(e.target.value)} placeholder="Өөрийгөө хэдэн мөртөд…" />
          <span className={countWords(about) > 100 ? "bad" : ""}>{countWords(about)} / 100 үг</span>
        </div>
      </section>

      <section className="pf-card">
        <h2>Би хаана төрөө вэ?</h2>
        <p className="pf-sub">Хаанаас ирсэн, хаана амьдарч байгаагаа хуваалцаарай</p>
        <div className="pf-grid2">
          <div><Label k="birth_country" on={earned.birth_country}>Төрсөн улс</Label><Select name="birth_country" options={COUNTRIES} value={p.birth_country} placeholder="Улс сонгох" /></div>
          <div><Label k="birth_city" on={earned.birth_city}>Төрсөн хот, аймаг</Label>
            <div className="pf-input"><input name="birth_city" list="pf-cities" maxLength={120} defaultValue={p.birth_city || ""} placeholder="Хот сонгох эсвэл өөрөө бичих" /><img src="/icons/pen16.svg" width={16} height={16} alt="" /></div></div>
          <div><Label k="live_country" on={earned.live_country}>Амьдарч буй улс</Label><Select name="live_country" options={COUNTRIES} value={p.live_country} placeholder="Улс сонгох" /></div>
          <div><Label k="live_city" on={earned.live_city}>Амьдарч буй хот, аймаг</Label>
            <div className="pf-input"><input name="live_city" list="pf-cities" maxLength={120} defaultValue={p.live_city || ""} placeholder="Хот сонгох эсвэл өөрөө бичих" /><img src="/icons/pen16.svg" width={16} height={16} alt="" /></div></div>
        </div>
        <datalist id="pf-cities">{MN_CITIES.map((c) => <option key={c} value={c} />)}</datalist>
      </section>

      <section className="pf-card">
        <h2>Би хаана юу сурсан бэ?</h2>
        <p className="pf-sub">Ижил сонирхолтой хүмүүстэй холбогдоход тусална</p>
        <Label k="education" on={earned.education}>Одоогийн боловсролын түвшин</Label>
        <Select name="education" options={OPTIONS.education} value={p.education} placeholder="Түвшин сонгох" />
        <Label k="school" on={earned.school}>Сургуулийн нэр</Label>
        <div className="pf-input"><input name="school" list="pf-schools" maxLength={160} defaultValue={p.school || ""} placeholder="Сургуулиа хайх эсвэл өөрөө бичих" /><img src="/icons/pen16.svg" width={16} height={16} alt="" /></div>
        <datalist id="pf-schools">{SCHOOLS.map((c) => <option key={c} value={c} />)}</datalist>
        <Label k="orcid" on={earned.orcid}>ORCID iD</Label>
        <div className="pf-input"><input name="orcid" maxLength={19} defaultValue={p.orcid || ""} placeholder="0000-0000-0000-0000" pattern="\d{4}-\d{4}-\d{4}-\d{3}[\dX]" /></div>
        <div className="pf-grid2">
          <div><Label k="profession" on={earned.profession}>Мэргэжил</Label><div className="pf-input"><input name="profession" maxLength={120} defaultValue={p.profession || ""} placeholder="Жишээ: Физикч" /></div></div>
          <div><Label k="job" on={earned.job}>Ажил</Label><div className="pf-input"><input name="job" maxLength={160} defaultValue={p.job || ""} placeholder="Ажлын газар, албан тушаал" /></div></div>
        </div>
      </section>

      <section className="pf-card">
        <div className="pf-sechead"><div><h2>Миний сошиал хаягууд</h2><p className="pf-sub">Хэдэн ч хаяг нэмж болно</p></div><Pts k="socials" on={earned.socials} /></div>
        {SOCIALS.map((s) => (
          <div key={s.key} className="pf-social">
            <img src={`/icons/${s.icon}.svg`} width={44} height={44} alt={s.key} />
            <div className="pf-input"><input name={`s_${s.key}`} type="url" maxLength={300} defaultValue={p.socials?.[s.key] || ""} placeholder="Холбоос (https://…)" /></div>
          </div>
        ))}
      </section>

      <section className="pf-card">
        <h2>Миний үзэл суртал</h2>
        <p className="pf-sub">Бөглөсөн тохиолдолд бусад хүмүүст харагдана</p>
        <Label k="origin_view" on={earned.origin_view}>Амьдралын үүслийн тухай үзэл</Label>
        <Select name="origin_view" options={OPTIONS.origin_view} value={p.origin_view} placeholder="Сонгоно уу" />
        <Label k="religion" on={earned.religion}>Шашны урсгал</Label>
        <Select name="religion" options={OPTIONS.religion} value={p.religion} placeholder="Сонгоно уу" />
        <Label k="belief" on={earned.belief}>Итгэл үнэмшил</Label>
        <Select name="belief" options={OPTIONS.belief} value={p.belief} placeholder="Сонгоно уу" />
        <Label k="politics" on={earned.politics}>Улс төрийн суртал</Label>
        <Select name="politics" options={OPTIONS.politics} value={p.politics} placeholder="Сонгоно уу" />
      </section>

      <section className="pf-card pf-foot">
        {p.agreed_at ? (
          <Link href={`/u/${user.id}`} className="pf-agree">Цуцлах</Link>
        ) : (
          <label className="pf-agree">
            <input type="checkbox" name="agree" required />
            <span><button type="button" className="pf-terms-link" onClick={(e) => { e.preventDefault(); setTerms(true); }}>Хэрэглэгчийн гэрээ</button>-г зөвшөөрөх</span>
          </label>
        )}
        <span className="pf-grow" />
        <button type="submit" className="pf-save">
          <img src="/icons/savespark.svg" width={16} height={16} alt="" />Хадгалах
        </button>
      </section>
      {terms && <Agreement onClose={() => setTerms(false)} />}
    </form>
  );
}

// Хэрэглэгчийн гэрээг бүртгэлээс гаралгүй уншина
function Agreement({ onClose }) {
  const dlg = useRef(null);
  useEffect(() => { dlg.current?.showModal(); }, []);
  return (
    <dialog ref={dlg} className="lr-dlg pf-terms" onClose={onClose} onClick={(e) => e.target === dlg.current && dlg.current.close()}>
      <div className="lr-box">
        <div className="lr-head">
          <span className="lr-ico"><img className="ic" src="/icons/f_shield.svg" width={22} height={22} alt="" /></span>
          <div><b>Хэрэглэгчийн гэрээ</b><small>Science Spark-ийг хамтдаа аюулгүй, сонирхолтой газар болгоё.</small></div>
          <button type="button" className="lr-x" aria-label="Хаах" onClick={() => dlg.current.close()}>×</button>
        </div>
        <ol className="pf-terms-list">
          {AGREEMENT.map(([h, t]) => <li key={h}><b>{h}</b><span>{t}</span></li>)}
        </ol>
        <button type="button" className="pf-save pf-terms-ok" onClick={() => dlg.current.close()}>Ойлголоо</button>
      </div>
    </dialog>
  );
}

const PF_KEYS = ["about", "gender", "birth_country", "birth_city", "live_country", "live_city", "education", "school", "orcid", "profession", "job", "origin_view", "religion", "belief", "politics"];
function merge(user, profile, d) {
  if (!d) return { user, profile };
  const u = { ...user }, p = { ...(profile || {}) };
  if ("surname" in d) u.surname = d.surname;
  if ("first_name" in d) u.first_name = d.first_name;
  for (const k of PF_KEYS) if (k in d) p[k] = d[k];
  p.email_public = "email_public" in d;
  if (d.by && d.bm && d.bd) p.birth_date = new Date(Date.UTC(+d.by, +d.bm - 1, +d.bd)).toISOString();
  p.socials = { ...(p.socials || {}) };
  for (const s of SOCIALS) if (`s_${s.key}` in d) p.socials[s.key] = d[`s_${s.key}`];
  const num = (v) => (v ? Number(v) : null);
  // Ноорогт зураг хоосон байвал (жишээ нь оруулах үед алдаа гарсан) хадгалсан зургийг дарж харуулахгүй
  if (d.cover) { p.cover_id = num(d.cover); p.cover_src = num(d.cover_src); p.cover_pos = d.cover_pos || null; }
  if (d.avatar) { u.avatar = num(d.avatar); u.avatar_src = num(d.avatar_src); u.avatar_pos = d.avatar_pos || null; }
  return { user: u, profile: p };
}

// Профайлын маягт: бөглөсөн утга энэ төхөөрөмж дээр ноорог болж хадгалагдана
export default function ProfileForm(props) {
  const formRef = useRef(null);
  const dr = useDraft(`ss-draft:profile:${props.user.id}`, formRef, { skip: ["agree"] });
  const { user, profile } = merge(props.user, props.profile, dr.draft);
  return <Inner key={dr.ver} {...props} user={user} profile={profile} formRef={formRef} dr={dr} />;
}
