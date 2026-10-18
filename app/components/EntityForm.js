"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ImageInput from "./ImageInput";
import MiniMap from "./MiniMap";
import { createClub, createOrg, updateEntity } from "../clubs/actions";
import { parseLocation, inMongolia } from "@/lib/geo";
import { latinShare, LATIN_LIMIT, LATIN_MSG } from "@/lib/format";
import { CLUB_CATEGORIES, ORG_TYPES, BOARD_MAX } from "@/lib/clubs-shared";
import { COUNTRIES, MN_CITIES, SOCIALS, countWords } from "@/lib/profile";
import { useDraft, hhmm } from "@/lib/useDraft";

const MONTHS = ["1-р сар", "2-р сар", "3-р сар", "4-р сар", "5-р сар", "6-р сар", "7-р сар", "8-р сар", "9-р сар", "10-р сар", "11-р сар", "12-р сар"];
const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: THIS_YEAR - 1950 + 1 }, (_, i) => THIS_YEAR - i);
const SOC_PH = { facebook: "facebook.com/…", instagram: "instagram.com/…", x: "x.com/…", linkedin: "linkedin.com/company/…", youtube: "youtube.com/@…" };
const msg = (text) => ({ onInvalid: (e) => e.target.setCustomValidity(text), onInput: (e) => e.target.setCustomValidity("") });

function Label({ children, required, right }) {
  return (
    <div className="pf-label">
      <span>{children}{required && <i>*</i>}</span>
      {required && <em>Заавал</em>}
      {right}
    </div>
  );
}

// Сонгох эсвэл өөрөө бичих талбар (Figma: «Өөрөө бичих» товч)
function PickOrWrite({ name, options, placeholder, required, reqMsg, initial = "" }) {
  const [own, setOwn] = useState(initial && !options.includes(initial));
  const [v, setV] = useState(initial);
  return (
    <div className="cf-pick">
      {own ? (
        <div className="pf-input"><input name={name} value={v} onChange={(e) => setV(e.target.value)} maxLength={60} required={required} placeholder="Өөрөө бичнэ үү" {...msg(reqMsg)} autoFocus /></div>
      ) : (
        <div className="pf-select">
          <select name={name} value={v} onChange={(e) => setV(e.target.value)} required={required} {...msg(reqMsg)}>
            <option value="">{placeholder}</option>
            {options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <img src="/icons/chev16.svg" width={16} height={16} alt="" />
        </div>
      )}
      <button type="button" className="cf-own" onClick={() => { setOwn((x) => !x); setV(""); }}>
        <img className="ic" src={own ? "/icons/chev16.svg" : "/icons/pen16.svg"} width={14} height={14} alt="" />{own ? "Жагсаалтаас" : "Өөрөө бичих"}
      </button>
    </div>
  );
}

// Удирдах зөвлөлийн гишүүн хайж нэмэх
function Board({ initial = [] }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState([]);
  const [picked, setPicked] = useState(initial);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (q.trim().length < 2) { setRes([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/users?q=${encodeURIComponent(q.trim())}`);
        const j = await r.json();
        setRes(j.users || []);
      } catch (e) { setRes([]); }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);
  const add = (u) => { if (picked.length < BOARD_MAX && !picked.some((p) => p.id === u.id)) setPicked([...picked, u]); setQ(""); setRes([]); };
  return (
    <div className="cf-board">
      <input type="hidden" name="board" value={picked.map((p) => p.id).join(",")} />
      <input type="hidden" name="board_keep" value={picked.filter((p) => p.keep).map((p) => p.id).join(",")} />
      <input type="hidden" name="board_json" value={JSON.stringify(picked)} />
      {picked.map((u) => (
        <div key={u.id} className="cf-member">
          <Av u={u} />
          <div><b>{u.name}</b><small>{u.job || "Удирдах зөвлөлийн гишүүн"} · {u.keep ? (u.invited ? "Урилга хүлээгдэж байна" : "Зөвлөлийн гишүүн") : "Урилга илгээгдэнэ"}</small></div>
          <button type="button" className="cf-ghost" onClick={() => setPicked(picked.filter((p) => p.id !== u.id))}>Хасах</button>
        </div>
      ))}
      {open ? (
        <div className="cf-search">
          <div className="pf-input"><img src="/icons/search.svg" width={16} height={16} alt="" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Гишүүний нэрээр хайх…" autoFocus onKeyDown={(e) => e.key === "Enter" && e.preventDefault()} /></div>
          {res.length > 0 && (
            <ul className="cf-results">
              {res.map((u) => (
                <li key={u.id}><button type="button" onClick={() => add(u)} disabled={picked.some((p) => p.id === u.id)}><Av u={u} size={28} /><b>{u.name}</b>{u.job && <small>{u.job}</small>}</button></li>
              ))}
            </ul>
          )}
          {q.trim().length >= 2 && res.length === 0 && <small className="cf-none">Ийм нэртэй хэрэглэгч олдсонгүй.</small>}
        </div>
      ) : (
        picked.length < BOARD_MAX && <button type="button" className="cf-add" onClick={() => setOpen(true)}>+ Гишүүн нэмэх <span>{picked.length} / {BOARD_MAX}</span></button>
      )}
      {open && <button type="button" className="cf-add" onClick={() => { setOpen(false); setQ(""); }}>Болсон <span>{picked.length} / {BOARD_MAX}</span></button>}
    </div>
  );
}

const COLORS = ["#37C3B3", "#5B8DEF", "#F59E0B", "#E5484D", "#8E6CEF", "#00A89B", "#EF6C9C"];
function Av({ u, size = 36 }) {
  if (u.avatar) return <img className="ss-avatar" src={`/img/${u.avatar}`} width={size} height={size} alt="" style={{ width: size, height: size, objectFit: "cover" }} />;
  return <span className="ss-avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.42), background: COLORS[u.id % COLORS.length] }}>{(u.name || "?").split(".").pop()[0]}</span>;
}

const ACTIONS = { club: createClub, org: createOrg, edit: updateEntity };

// Клуб, байгууллага бүртгүүлэх / засах маягт (Figma: Клубээр бүртгүүлэх, Байгууллагаар бүртгүүлэх)
function Inner({ leader, kind, entity, board, init, formRef, dr }) {
  const org = kind === "org";
  const e = init;
  const [state, action, pending] = useActionState(ACTIONS[entity ? "edit" : kind], null);
  const form = formRef;
  const [name, setName] = useState(e.name || "");
  const [address, setAddress] = useState(e.address || "");
  const [about, setAbout] = useState(e.about || "");
  const [rules, setRules] = useState(e.rules || "");
  const [loc, setLoc] = useState(e._loc ?? (e.lat != null ? `${e.lat}, ${e.lng}` : ""));
  const [country, setCountry] = useState(e.country || "Монгол");
  const [filled, setFilled] = useState(0);
  const p = useMemo(() => parseLocation(loc), [loc]);
  const shortLink = !p && /^https:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)\//i.test(loc.trim());
  const outside = p && country === "Монгол" && !inMongolia(p);
  const fd0 = e.founded ? new Date(e.founded) : null;
  const L = org ? "Байгууллагын" : "Клубын";

  // Бөглөсөн хувь (Figma: дээд талын 0–100%)
  const KEYS = org ? ["logo", "cover", "name", "category", "fy", "about", "city", "address", "field", "website", "email", "phone"]
    : ["logo", "cover", "name", "category", "fy", "city", "address", "location", "about", "rules", "website", "email", "phone"];
  const recount = () => {
    if (!form.current) return;
    const fd = new FormData(form.current);
    const n = KEYS.filter((k) => String(fd.get(k) || "").trim()).length + (SOCIALS.some((s) => String(fd.get(`s_${s.key}`) || "").trim()) ? 1 : 0);
    setFilled(Math.round((n / (KEYS.length + 1)) * 100));
  };
  useEffect(() => { recount(); const t = setInterval(recount, 800); return () => clearInterval(t); }, []);
  useEffect(() => { if (state?.error) window.scrollTo({ top: 0, behavior: "smooth" }); }, [state]);
  const lat = (v) => latinShare(v) > LATIN_LIMIT;
  const wc = (v) => countWords(v);

  return (
    <form ref={form} action={action} className="pf-col cf-col" onChange={recount} onSubmit={dr.drop}>
      {entity && <input type="hidden" name="id" value={entity.id} />}
      <section className="pf-card pf-head">
        <div className="pf-head-top">
          <img src="/icons/logo.svg" width={56} height={56} alt="" />
          <b>{entity ? `${e.name} — мэдээлэл засах` : org ? "Байгууллагаа бүртгүүлж, нийгэмлэгийн нэг хэсэг болоорой" : "Клубээ бүртгүүлж, гишүүдээ угтаарай"}</b>
          <span className="pf-total"><strong>{filled}</strong> / 100%</span>
        </div>
        <div className="pf-bar"><i style={{ width: `${filled}%` }} /></div>
        {dr.restoredAt && (
          <p className="wr-restored"><span>↺ Өмнө бөглөж байсан ноорог тань сэргээгдлээ ({hhmm(dr.restoredAt)}).</span>
            <button type="button" onClick={dr.clear}>Ноорог устгах</button></p>
        )}
        {state?.error && <p className="error">{state.error}</p>}
        {dr.savedAt && <small className="cf-saved">✓ Ноорог энэ төхөөрөмж дээр хадгалагдсан · {hhmm(dr.savedAt)}</small>}
      </section>

      <section className="pf-card">
        <div className="pf-coverwrap">
          <ImageInput name="cover" aspect={3} maxW={1920} variant="cover" adjust initial={e.cover_id || null} initialSrc={e.cover_src || null} initialPos={e.cover_pos || null}>
            <img src="/icons/camera18.svg" width={18} height={18} alt="" />
            <b>Ковер зураг нэмэх</b>
            <small>Өргөн зураг (3:1) · JPG, PNG, WEBP</small>
          </ImageInput>
        </div>
        <div className="pf-photo">
          <ImageInput name="logo" aspect={1} maxW={512} variant="avatar" required requiredMsg={`${L} лого оруулна уу`} initial={e.logo_id || null}
            badge={<span className="pf-cam"><img src="/icons/cam16.svg" width={16} height={16} alt="" /></span>}>
            <img src={org ? "/icons/torg.svg" : "/icons/clubstar.svg"} width={40} height={40} alt="" />
          </ImageInput>
          <div><b>{L} лого <em className="cf-req">Заавал</em></b><small className="cf-hint">PNG эсвэл JPG, 512×512-ээс багагүй. Лого оруулаагүй бол бүртгэл баталгаажихгүй.</small></div>
        </div>
      </section>

      <section className="pf-card">
        <h2>{org ? "Үндсэн мэдээлэл" : "Клубын мэдээлэл"}</h2>
        <p className="pf-sub">Заавал талбарыг бөглөснөөр бүртгэл баталгаажна</p>
        <Label required>{L} нэр</Label>
        <div className="pf-input"><input name="name" required minLength={2} maxLength={30} value={name} onChange={(ev) => setName(ev.target.value)} placeholder={org ? "Жишээ: Сансар судлалын хүрээлэн" : "Жишээ: Сансрын судлаачид"} {...msg(`${L} нэрээ бичнэ үү`)} /><span>{name.length} / 30</span></div>

        <Label required>{org ? "Байгууллагын төрөл" : "Клубын ангилал"}</Label>
        <PickOrWrite name="category" options={org ? ORG_TYPES : CLUB_CATEGORIES} initial={e.category || ""} placeholder={org ? "Төрөл сонгох" : "Ангилал сонгох"} required reqMsg={org ? "Төрлөө сонгоно уу" : "Ангиллаа сонгоно уу"} />

        <Label>Байгуулагдсан он, сар, өдөр</Label>
        <div className="pf-grid3">
          <div className="pf-select"><select name="fy" defaultValue={e._fy ?? (fd0 ? fd0.getUTCFullYear() : "")}><option value="">Он</option>{YEARS.map((y) => <option key={y} value={y}>{y}</option>)}</select><img src="/icons/chev16.svg" width={16} height={16} alt="" /></div>
          <div className="pf-select"><select name="fm" defaultValue={e._fm ?? (fd0 ? fd0.getUTCMonth() + 1 : "")}><option value="">Сар</option>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select><img src="/icons/chev16.svg" width={16} height={16} alt="" /></div>
          <div className="pf-select"><select name="fd" defaultValue={e._fd ?? (fd0 ? fd0.getUTCDate() : "")}><option value="">Өдөр</option>{Array.from({ length: 31 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select><img src="/icons/chev16.svg" width={16} height={16} alt="" /></div>
        </div>

        {org && (
          <>
            <Label required>Байгууллагын тухай</Label>
            <div className={"pf-area" + (lat(about) || wc(about) > 100 ? " bad" : "")}>
              <textarea name="about" rows={3} required value={about} onChange={(ev) => setAbout(ev.target.value)} placeholder="Байгууллага тань юу хийдэг вэ?" {...msg("Байгууллагынхаа тухай бичнэ үү")} />
              <span className={lat(about) || wc(about) > 100 ? "bad" : ""}>{lat(about) ? LATIN_MSG : `${wc(about)} / 100 үг`}</span>
            </div>
          </>
        )}
      </section>

      <section className="pf-card">
        {org && <><h2>Хаана байдаг вэ?</h2><p className="pf-sub">Төв оффисын байршил</p></>}
        <div className="pf-grid2 cf-place">
          <div>
            <Label>Улс</Label>
            <div className="pf-select"><select name="country" value={country} onChange={(ev) => setCountry(ev.target.value)}>{COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}</select><img src="/icons/chev16.svg" width={16} height={16} alt="" /></div>
          </div>
          <div>
            <Label required>Хот, аймаг</Label>
            <PickOrWrite name="city" options={MN_CITIES} initial={e.city || ""} placeholder="Хот, аймаг сонгох" required reqMsg="Хот, аймгаа сонгоно уу" />
          </div>
        </div>

        <Label>Хаяг</Label>
        <div className="pf-area">
          <textarea name="address" rows={2} maxLength={org ? 1000 : 150} value={address} onChange={(ev) => setAddress(ev.target.value)} placeholder="Дүүрэг, хороо, гудамж, байр, давхар…" />
          <span className={org && wc(address) > 100 ? "bad" : ""}>{org ? `${wc(address)} / 100 үг` : `${address.length} / 150`}</span>
        </div>

        <Label required={!org} right={<small className="cf-lochint">{org ? "Заавал биш" : "Газрын зураг дээр клуб тань энд гэрэлтэнэ"}</small>}>Байршил (координат эсвэл Google Maps холбоос)</Label>
        <div className={"pf-input cf-loc" + (outside || (loc && !p && !shortLink) ? " bad" : p ? " ok" : "")}>
          <img src="/icons/f_pin.svg" width={16} height={16} alt="" />
          <input name="location" required={!org} maxLength={600} value={loc} onChange={(ev) => setLoc(ev.target.value)} placeholder="47.9184, 106.9177 эсвэл https://maps.google.com/…" {...msg(`${L} байршлыг оруулна уу`)} />
        </div>
        <p className="cf-locinfo">
          {p ? (outside ? "Энэ цэг Монгол Улсын нутагт биш байна. Координатаа шалгана уу." : `✓ Байршил олдлоо: ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`)
            : shortLink ? "Богино холбоосыг хадгалах үед шалгаж, байршлыг нь уншина."
            : loc ? "Байршлыг уншиж чадсангүй. «47.9184, 106.9177» хэлбэрээр эсвэл Google Maps-ийн бүтэн холбоосоор оруулна уу."
            : "Google Maps дээр байршил дээрээ хулганы баруун товч дарж координатыг хуулж болно. Эсвэл «Хуваалцах» холбоосыг оруулна уу."}
        </p>
        {p && !outside && <MiniMap lat={p.lat} lng={p.lng} className="mm cf-mini" />}

        {!org && (
          <>
            <Label required>Клубын тухай</Label>
            <div className={"pf-area" + (lat(about) ? " bad" : "")}>
              <textarea name="about" rows={3} required maxLength={500} value={about} onChange={(ev) => setAbout(ev.target.value)} placeholder="Клуб тань юугаар хичээллэдэг, хэнд зориулагдсан бэ?" {...msg(lat(about) ? LATIN_MSG : "Клубынхээ тухай бичнэ үү")} />
              <span className={lat(about) ? "bad" : ""}>{lat(about) ? LATIN_MSG : `${about.length} / 500`}</span>
            </div>
            <Label>Клубын дүрэм</Label>
            <div className={"pf-area" + (lat(rules) ? " bad" : "")}>
              <textarea name="rules" rows={3} maxLength={1000} value={rules} onChange={(ev) => setRules(ev.target.value)} placeholder="1. Бусдыг хүндэлж, нээлттэй санал солилцоно. 2. …" />
              <span className={lat(rules) ? "bad" : ""}>{lat(rules) ? LATIN_MSG : `${rules.length} / 1000`}</span>
            </div>
          </>
        )}
      </section>

      <section className="pf-card">
        <h2>Хэрхэн холбогдох вэ?</h2>
        <p className="pf-sub">Албан ёсны холбоо барих мэдээлэл</p>
        {org && (
          <>
            <Label>Үйл ажиллагааны чиглэл</Label>
            <div className="pf-input"><input name="field" maxLength={120} defaultValue={e.field || ""} placeholder="Жишээ: Физик · Сансар судлал" /></div>
          </>
        )}
        <Label>Вэбсайт</Label>
        <div className="pf-input"><input name="website" maxLength={200} defaultValue={e.website || ""} placeholder="https://…" /></div>
        <Label>{org ? "Албан ёсны имэйл" : "Клубын имэйл"}</Label>
        <div className="pf-input"><input name="email" type="email" maxLength={120} defaultValue={e.email || ""} placeholder="info@example.mn" {...msg("Имэйл хаягаа зөв бичнэ үү")} /></div>
        <Label>Утасны дугаар</Label>
        <div className="pf-input"><input name="phone" type="tel" maxLength={30} defaultValue={e.phone || ""} placeholder="+976 9911 2233" pattern="\+?[\d\s\-]{6,20}" {...msg("Утасны дугаараа зөв бичнэ үү")} /></div>
      </section>

      <section className="pf-card">
        <h2>{L} сошиал хаягууд</h2>
        <p className="pf-sub">Хэдэн ч хаяг нэмж болно</p>
        {SOCIALS.map((s) => (
          <div key={s.key} className="pf-social">
            <img src={`/icons/${s.icon}.svg`} width={44} height={44} alt={s.key} />
            <div className="pf-input"><input name={`s_${s.key}`} maxLength={300} defaultValue={e.socials?.[s.key] || ""} placeholder={SOC_PH[s.key]} /></div>
          </div>
        ))}
      </section>

      <section className="pf-card">
        <h2>{org ? "Бүртгүүлж буй хүн" : "Клубын удирдагч"}</h2>
        <p className="pf-sub">{org ? "Таны хувь хүний профайлаас автоматаар татагдсан тул эндээс өөрчлөх боломжгүй. Та байгууллагын админ болно." : "Та клубын удирдагч болж бүртгүүлнэ. Зөвхөн удирдагч админ эрхтэй."}</p>
        <div className="cf-member lead">
          <Av u={leader} size={40} />
          <div><b>{leader.name} <em className="cf-you">{org ? "Админ" : "Удирдагч"}</em></b><small>{[leader.job, leader.email].filter(Boolean).join(" · ")}</small></div>
          <Link href="/profile/edit" className="cf-ghost">Профайл засах</Link>
        </div>
        {[["Овог, нэр", leader.full], ["Одоо хийж буй ажил", leader.job || "—"], ["Имэйл", leader.email]].map(([k, v]) => (
          <div key={k}>
            <Label right={<span className="cf-lock">🔒 Профайлаас</span>}>{k}</Label>
            <div className="pf-input cf-locked"><input value={v} readOnly tabIndex={-1} /></div>
          </div>
        ))}
      </section>

      {!org && (
        <section className="pf-card">
          <h2>Удирдах зөвлөл</h2>
          <p className="pf-sub">Хамгийн ихдээ {BOARD_MAX} гишүүн. Нэмсэн хүмүүст урилга очих бөгөөд зөвшөөрвөл зөвлөлд орно.</p>
          <Board initial={e._board || board} />
        </section>
      )}

      <section className="pf-card pf-foot">
        {entity ? (
          <Link href={`/${org ? "org" : "club"}/${entity.id}`} className="pf-agree">Цуцлах</Link>
        ) : (
          <label className="pf-agree">
            <input type="checkbox" name="agree" required {...msg("Нөхцөлийг зөвшөөрнө үү")} />
            <span>{L} бүртгэлийн нөхцөлийг зөвшөөрөх</span>
          </label>
        )}
        <span className="pf-grow" />
        <button type="submit" className="pf-save" disabled={pending}>
          <img src="/icons/savespark.svg" width={16} height={16} alt="" />{pending ? "Хадгалж байна…" : entity ? "Хадгалах" : org ? "Бүртгүүлэх" : "Клуб бүртгүүлэх"}
        </button>
      </section>
    </form>
  );
}

// Нооргийн утгыг маягтын анхны утга болгоно
function fromDraft(e, d) {
  if (!d) return e;
  const x = { ...e };
  for (const k of ["name", "category", "country", "city", "address", "about", "rules", "field", "website", "email", "phone"]) if (k in d) x[k] = d[k];
  x.socials = { ...(e.socials || {}) };
  for (const s of SOCIALS) if (`s_${s.key}` in d) x.socials[s.key] = d[`s_${s.key}`];
  if ("fy" in d) { x._fy = d.fy; x._fm = d.fm; x._fd = d.fd; }
  if ("location" in d) x._loc = d.location;
  const num = (v) => (v ? Number(v) : null);
  if ("logo" in d) x.logo_id = num(d.logo);
  if ("cover" in d) { x.cover_id = num(d.cover); x.cover_src = num(d.cover_src); x.cover_pos = d.cover_pos || null; }
  try { if (d.board_json) x._board = JSON.parse(d.board_json); } catch (er) {}
  return x;
}

export default function ClubForm({ leader, kind = "club", entity = null, board = [] }) {
  const formRef = useRef(null);
  const key = entity ? `ss-draft:entity:${entity.id}` : `ss-draft:${kind}:new`;
  const dr = useDraft(key, formRef, { skip: ["agree", "id", "board_keep"] });
  const init = fromDraft(entity || {}, dr.draft);
  return <Inner key={dr.ver} leader={leader} kind={kind} entity={entity} board={board} init={init} formRef={formRef} dr={dr} />;
}
