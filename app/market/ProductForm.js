"use client";

import { useActionState, useEffect, useRef, useState, startTransition } from "react";
import { saveProduct } from "./actions";
import { uploadImageFile } from "../components/ImageInput";
import Spark from "../components/Spark";
import MongolPost from "./MongolPost";
import {
  PRODUCT_TYPES, MAX_IMAGES, PARCEL_SIZES, POST_FROM, PREP_DAYS, COMMISSION_PCT, needsPost, feeOf, fmtMnt,
} from "@/lib/market-shared";

const Err = ({ e }) => (e ? <small className="mc-err">{e}</small> : null);
const digits = (v) => String(v || "").replace(/\D/g, "").slice(0, 9);
const group = (v) => (v ? Number(v).toLocaleString("en-US") : "");

// Бүтээгдэхүүн байршуулах маягт: мэдээлэл, зураг, үнэ, Монгол шуудангийн хүргэлт
export default function ProductForm({ p, tariff, stage, canDraft = true }) {
  const [state, action, pending] = useActionState(saveProduct, null);
  const [intent, setIntent] = useState("");
  const [type, setType] = useState(p?.type || "");
  const [desc, setDesc] = useState(p?.description || "");
  const [imgs, setImgs] = useState((p?.image_ids || []).map(String));
  const [up, setUp] = useState(0);
  const [imgErr, setImgErr] = useState("");
  const [price, setPrice] = useState(p?.price ? String(p.price) : "");
  const d = p?.delivery || {};
  const [weight, setWeight] = useState(d.weight ? String(d.weight) : "");
  const [size, setSize] = useState(d.size || "");
  const [from, setFrom] = useState(d.from || "Улаанбаатар");
  const file = useRef(null);
  const top = useRef(null);
  const errors = state?.errors || {};
  const post = needsPost(type);
  useEffect(() => { if (state) top.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [state]);

  const addFiles = async (list) => {
    const files = [...list].slice(0, MAX_IMAGES - imgs.length);
    if (!files.length) return;
    setImgErr(""); setUp(files.length);
    for (const f of files) {
      try {
        const id = await uploadImageFile(f, { maxW: 1200, aspect: 1 });
        setImgs((cur) => (cur.length < MAX_IMAGES ? [...cur, id] : cur));
      } catch (e) { setImgErr(e.message); }
      setUp((n) => n - 1);
    }
  };
  const move = (i, to) => setImgs((cur) => { const a = [...cur]; const [x] = a.splice(i, 1); a.splice(to, 0, x); return a; });

  return (
    <form id="product-form" ref={top} className="mc-col mk-form" onSubmit={(e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget, e.nativeEvent.submitter);
      setIntent(String(fd.get("intent") || ""));
      startTransition(() => action(fd));
    }}>
      {p?.id && <input type="hidden" name="pid" value={p.id} />}
      {imgs.map((id) => <input key={id} type="hidden" name="image_ids" value={id} />)}
      {state?.error && <p className="mc-flash bad">{state.error}</p>}
      {state?.ok && <p className="mc-flash ok">{state.ok}</p>}

      <section className="pf-card">
        <h2>1. Бүтээгдэхүүн</h2>
        <label className="pf-label" htmlFor="pr-title"><span>Нэр<i>*</i></span></label>
        <div className={"pf-input" + (errors.title ? " bad" : "")}><input id="pr-title" name="title" defaultValue={p?.title || ""} maxLength={120} placeholder="Жишээ нь: Сансрын атлас, 2-р хэвлэл" /></div>
        <Err e={errors.title} />
        <div className="pf-label"><span>Төрөл<i>*</i></span></div>
        <div className="mc-chips">
          {PRODUCT_TYPES.map((t) => (
            <label key={t} className="pf-chip"><input type="radio" name="type" value={t} checked={type === t} onChange={() => setType(t)} /><span>{t}</span></label>
          ))}
        </div>
        <Err e={errors.type} />
        <label className="pf-label" htmlFor="pr-desc"><span>Тайлбар<i>*</i></span><small className="mk-count">{desc.length} / 3000</small></label>
        <div className={"pf-area" + (errors.description ? " bad" : "")}>
          <textarea id="pr-desc" name="description" rows={6} maxLength={3000} value={desc} onChange={(e) => setDesc(e.target.value)}
            placeholder="Агуулга, хэмжээ, материал, нас, хэвлэлийн мэдээлэл гэх мэт худалдан авагчид хэрэгтэй бүх мэдээлэл" />
        </div>
        <Err e={errors.description} />
      </section>

      <section className="pf-card">
        <h2>2. Зураг</h2>
        <p className="pf-sub">{MAX_IMAGES} хүртэл зураг · дөрвөлжин (1:1) болж тайрагдана · эхний зураг нүүр зураг болно</p>
        <div className="mk-imgs">
          {imgs.map((id, i) => (
            <div key={id} className="mk-img">
              <img src={`/img/${id}`} alt="" />
              {i === 0 ? <em>Нүүр зураг</em> : <button type="button" className="mk-first" onClick={() => move(i, 0)}>Нүүр болгох</button>}
              <button type="button" className="mk-x" aria-label="Устгах" onClick={() => setImgs((c) => c.filter((x) => x !== id))}>×</button>
            </div>
          ))}
          {Array.from({ length: up }).map((_, i) => <div key={"u" + i} className="mk-img busy"><Spark size={28} /></div>)}
          {imgs.length + up < MAX_IMAGES && (
            <button type="button" className={"mk-add" + (errors.images ? " bad" : "")} onClick={() => file.current?.click()}>
              <img className="ic" src="/icons/plus18.svg" width={18} height={18} alt="" />
              <span>Зураг нэмэх</span>
            </button>
          )}
        </div>
        <input ref={file} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        <Err e={imgErr || errors.images} />
      </section>

      <section className="pf-card">
        <h2>3. Үнэ, тоо ширхэг</h2>
        <div className="pf-grid2">
          <div className="mc-field">
            <label className="pf-label" htmlFor="pr-price"><span>Үнэ<i>*</i></span></label>
            <div className={"pf-input" + (errors.price ? " bad" : "")}>
              <input id="pr-price" inputMode="numeric" value={group(price)} onChange={(e) => setPrice(digits(e.target.value))} placeholder="50,000" />
              <span>₮</span>
            </div>
            <input type="hidden" name="price" value={price} />
            <Err e={errors.price} />
          </div>
          <div className="mc-field">
            <label className="pf-label" htmlFor="pr-stock"><span>Борлуулах тоо ширхэг<i>*</i></span></label>
            <div className={"pf-input" + (errors.stock ? " bad" : "")}><input id="pr-stock" name="stock" inputMode="numeric" defaultValue={p?.stock ?? ""} placeholder="10" maxLength={6} /><span>ш</span></div>
            <Err e={errors.stock} />
          </div>
        </div>
        <dl className="mk-calc">
          <div><dt>Худалдан авагч төлөх</dt><dd>{price ? fmtMnt(price) : "—"}</dd></div>
          <div><dt>Зуучлалын шимтгэл {COMMISSION_PCT}%</dt><dd>{price ? `−${fmtMnt(feeOf(price))}` : "—"}</dd></div>
          <div className="tot"><dt>Таны авах дүн</dt><dd>{price ? fmtMnt(Number(price) - feeOf(price)) : "—"}</dd></div>
        </dl>
        <p className="mc-note">Хүргэлтийн төлбөрийг худалдан авагч тусад нь төлнө. Мерчантын авах дүнг сар бүрийн тооцоогоор банкны дансанд шилжүүлнэ.</p>
      </section>

      <section className="pf-card">
        <h2>4. Хүргэлт</h2>
        {!type ? (
          <p className="mc-note">Эхлээд бүтээгдэхүүний төрлөө сонгоно уу.</p>
        ) : !post ? (
          <div className="mk-digital"><b>Хүргэлт шаардлагагүй</b><span>{type}: худалдан авагч сайтаас болон и-мэйлээр хүлээн авна.</span></div>
        ) : (
          <div className="mk-post">
            <MongolPost tariff={tariff} weight={weight} />
            <div className="pf-grid2">
              <div className="mc-field">
                <label className="pf-label" htmlFor="pr-w"><span>Илгээмжийн жин (савлагаатай)<i>*</i></span></label>
                <div className={"pf-input" + (errors.weight ? " bad" : "")}><input id="pr-w" name="weight" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value.replace(/[^\d.,]/g, "").slice(0, 6))} placeholder="0.8" /><span>кг</span></div>
                <Err e={errors.weight} />
              </div>
              <div className="mc-field">
                <label className="pf-label" htmlFor="pr-from"><span>Илгээх аймаг, хот<i>*</i></span></label>
                <div className={"pf-select" + (errors.from ? " bad" : "")}>
                  <select id="pr-from" name="from" value={from} onChange={(e) => setFrom(e.target.value)}>
                    {POST_FROM.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <img src="/icons/chev16.svg" width={16} height={16} alt="" />
                </div>
                <Err e={errors.from} />
              </div>
            </div>
            <div className="pf-label"><span>Хайрцгийн хэмжээ<i>*</i></span></div>
            <div className="mk-sizes">
              {PARCEL_SIZES.map(([k, label, dim]) => (
                <label key={k} className={"mk-size" + (size === k ? " on" : "")}>
                  <input type="radio" name="size" value={k} checked={size === k} onChange={() => setSize(k)} />
                  <svg viewBox="0 0 40 32" width={k === "S" ? 26 : k === "M" ? 32 : 38} aria-hidden="true"><path d="M4 9 20 2l16 7v15l-16 7-16-7z M4 9l16 7 16-7 M20 16v15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
                  <b>{label}</b><small>{dim}</small>
                </label>
              ))}
            </div>
            <Err e={errors.size} />
            <div className="pf-label"><span>Захиалга бэлтгэх хугацаа<i>*</i></span></div>
            <div className="mc-chips">
              {PREP_DAYS.map((n) => (
                <label key={n} className="pf-chip"><input type="radio" name="prep" value={n} defaultChecked={(d.prep || 2) === n} /><span>{n} өдөр</span></label>
              ))}
            </div>
            <Err e={errors.prep} />
            <p className="mc-note">Захиалга орж ирэхэд хаяг, илгээмжийн шошгыг автоматаар бэлдэнэ. Та илгээмжийг ойрын шуудангийн салбарт хүлээлгэн өгч, илгээмжийн дугаарыг оруулна.</p>
          </div>
        )}
      </section>

      <section className="pf-card">
        <h2>5. Буцаалтын нөхцөл</h2>
        <div className="pf-area">
          <textarea name="return_policy" rows={3} maxLength={1000} defaultValue={p?.return_policy || ""}
            placeholder="Жишээ нь: Гэмтэлтэй, буруу бараа ирсэн бол хүлээн авснаас хойш 7 хоногт буцааж, солиулна." />
        </div>
      </section>

      <section className="pf-card pf-foot mc-foot" id="send">
        {stage !== "ready" && <span className="mk-next">Дараагийн алхам: мерчантын гэрээ</span>}
        <span className="pf-grow" />
        {canDraft && <button className="mc-btn ghost" name="intent" value="save" disabled={pending || up > 0}>{pending && intent === "save" ? <Spark mono size={16} /> : null}Ноорог хадгалах</button>}
        <button className="mc-btn" name="intent" value="submit" disabled={pending || up > 0}>{pending && intent === "submit" ? <Spark mono size={16} /> : null}Редакц руу илгээх</button>
      </section>
    </form>
  );
}
