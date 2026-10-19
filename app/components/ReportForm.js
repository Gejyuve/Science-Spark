"use client";

import { useState } from "react";
import RichEditor from "./RichEditor";
import ImageInput from "./ImageInput";

// Даалгавар сонгох: хайж олоод нэгийг сонгоно
function TaskPicker({ tasks, initial }) {
  const [sel, setSel] = useState(tasks.some((x) => x.id === initial && !x.done) ? initial : 0);
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const shown = tasks.filter((x) => !query || x.title.toLowerCase().includes(query) || x.club_name.toLowerCase().includes(query));
  return (
    <div className="rp-pick">
      <input className="rp-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Даалгаврын нэр эсвэл клубээр хайх" />
      <div className="rp-list" role="radiogroup" aria-label="Даалгавар">
        {shown.map((x) => (
          <button key={x.id} type="button" role="radio" aria-checked={sel === x.id} disabled={x.done}
            className={"rp-opt" + (sel === x.id ? " on" : "")} onClick={() => setSel(x.id)}>
            {x.image_id ? <img src={`/img/${x.image_id}`} alt="" /> : <span className="rp-noimg" />}
            <span className="rp-txt">
              <b>{x.title}</b>
              <small>{x.club_name}{(x.types || []).length ? ` · ${x.types.join(", ")}` : ""}</small>
            </span>
            <span className="rp-rew">{x.done ? "Илгээсэн" : <><img src="/icons/spark.svg" width={14} height={14} alt="" />{x.reward || "—"}</>}</span>
          </button>
        ))}
        {!shown.length && <p className="rp-empty">{tasks.length ? "Хайлтад тохирох даалгавар алга." : "Одоохондоо нийтлэгдсэн даалгавар алга."}</p>}
      </div>
      <input className="tk-req" tabIndex={-1} aria-hidden="true" value={sel ? "1" : ""} required onChange={() => {}}
        ref={(el) => el && el.setCustomValidity(sel ? "" : "Биелүүлсэн даалгавраа сонгоно уу")} />
      <input type="hidden" name="task_id" value={sel || ""} />
    </div>
  );
}

// Клубын тайлан бичих самбар (нийтлэл бичихтэй ижил бүтэцтэй)
export default function ReportForm({ action, club, avatar, tasks, initial, error, share }) {
  return (
    <div className="wr-layout">
      <aside className="wr-side left" />
      <form action={action} className="wr-col">
        <input type="hidden" name="kind" value="Тайлан" />
        <section className="wr-card wr-head">
          <div className="wr-head-top">
            <img src="/icons/logo.svg" width={56} height={56} alt="" />
            <b>Клубынхээ хийсэн ажлыг хуваалцаж, бусад клубт урам өгье.</b>
          </div>
          <p className="tk-as">{avatar}<span><b>{club.name}</b> клубын нэрээр нийтлэгдэнэ</span></p>
          {error && <p className="error">{error}</p>}
        </section>

        <section className="wr-card">
          <div className="wr-sec-head">
            <div>
              <h2>Даалгавар сонгох <em className="wr-req">Заавал</em></h2>
              <p>Тайлан батлагдмагц клуб тань даалгаврын очийг бүтнээр авч, даалгаврыг нэмсэн клубт түүний {share}% нь очно.</p>
            </div>
          </div>
          <TaskPicker tasks={tasks} initial={initial} />
        </section>

        <section className="wr-card">
          <div className="wr-sec-head">
            <div><h2>Ковер зураг <em className="wr-req">Заавал</em></h2></div>
          </div>
          <ImageInput name="image" aspect={740 / 280} maxW={1600} variant="drop" required>
            <span className="wr-ring"><img src="/icons/imgadd.svg" width={26} height={26} alt="" /></span>
            <b>Ковер зураг нэмэх</b>
            <span className="wr-pick"><img src="/icons/plus16.svg" width={16} height={16} alt="" />Зураг сонгох</span>
            <small>JPG, PNG, WEBP · 740×280 харьцаагаар автоматаар тайрна</small>
          </ImageInput>
          <div className="wr-coversrc">
            <label><span>Ковер зургийн эх сурвалж <em>заавал биш</em></span>
              <input name="cover_source" maxLength={150} placeholder="Жишээ: Клубын гишүүдийн авсан зураг" /></label>
            <label><span>Эх сурвалжийн холбоос <em>заавал биш</em></span>
              <input name="cover_url" type="url" maxLength={300} placeholder="https://..." /></label>
          </div>
        </section>

        <section className="wr-card">
          <div className="wr-sec-head">
            <div><h2>Гарчиг</h2><p>Юу хийж, юу олж мэдсэнээ гарчгаас нь ойлгогдохоор бичээрэй.</p></div>
          </div>
          <label className="wr-label">Гарчиг <em>Заавал</em></label>
          <input className="wr-title" name="title" required maxLength={200} placeholder="Жишээ: Лаавын чийдэнгээр нягтын ялгааг ингэж харлаа"
            onInvalid={(e) => e.target.setCustomValidity("Гарчгаа бичнэ үү")} onInput={(e) => e.target.setCustomValidity("")} />
          <label className="wr-label">Товч тайлбар <span className="wr-hint">заавал биш · 250 хүртэл</span></label>
          <textarea className="wr-sub" name="subtitle" maxLength={250} rows={2} placeholder="Хэдэн гишүүн оролцож, ямар үр дүнд хүрсэн бэ?" />
        </section>

        <section className="wr-card">
          <div className="wr-sec-head">
            <div><h2>Тайлангийн агуулга</h2><p>Хэрхэн хийсэн, юу ажигласан, юу гайхшруулсан, дараа нь юуг өөрөөр хийхээ бичээрэй. Эх сурвалж нэмэх нь заавал биш.</p></div>
          </div>
          <div className="wr-editor">
            <RichEditor />
          </div>
        </section>

        <section className="wr-card wr-foot">
          <span className="cp-review"><img src="/icons/f_shield.svg" width={18} height={18} alt="" />Редакц шалгаж баталсны дараа нийтлэгдэнэ</span>
          <span className="ss-grow" />
          <button type="submit" className="wr-go">
            Редакц руу илгээх
            <img src="/icons/arrowr.svg" width={19} height={19} alt="" />
          </button>
        </section>
      </form>
      <aside className="wr-side right" />
    </div>
  );
}
