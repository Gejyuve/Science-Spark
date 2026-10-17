import Link from "next/link";
import { KINDS } from "@/lib/format";
import ContentField from "./ContentField";
import ImageInput from "./ImageInput";
import TopNav from "./TopNav";
import DictAdd from "./DictAdd";

// Figma: Нийтлэл бичих. Шинэ болон засах хуудсанд хоёуланд нь ашиглана.
export default function PostForm({ action, post = {}, error, extra, heading = "Мэдлэг бол хуваалцах тусам арвижих баялаг юм." }) {
  const kind = KINDS.includes(post.kind) ? post.kind : "Нийтлэл";
  return (
    <div className="wr-page">
      <span className="au-blob a" aria-hidden="true" />
      <span className="au-blob b" aria-hidden="true" />
      <TopNav className="wr-nav" />
      <div className="ar-pagebar wr-bar">
        <Link href={post.id ? `/post/${post.id}` : "/"} className="ar-back">← Буцах</Link>
      </div>

      <form action={action} className="wr-col">
        {post.id && <input type="hidden" name="post_id" value={post.id} />}

        <section className="wr-card wr-head">
          <div className="wr-head-top">
            <img src="/icons/logo.svg" width={56} height={56} alt="" />
            <b>{heading}</b>
          </div>
          <div className="wr-steps">
            {["Гарчиг", "Төрөл", "Агуулга", "Илгээх"].map((s) => (
              <span key={s}><i />{s}</span>
            ))}
          </div>
          <p className="wr-note">Илгээсэн нийтлэл өөр хянагчийн шалгалтаар орж, батлагдсаны дараа нийтлэгдэнэ.</p>
          {error && <p className="error">{error}</p>}
        </section>

        <section className="wr-card">
          <div className="wr-sec-head">
            <div><h2>Нийтлэлийн ковер</h2><p>Нийтлэлийн нүүр зураг. 740×280 харьцаатай зураг тохиромжтой.</p></div>
          </div>
          <ImageInput name="image" aspect={740 / 280} maxW={1600} variant="drop" initial={post.image_id || null}>
            <span className="wr-ring"><img src="/icons/imgadd.svg" width={26} height={26} alt="" /></span>
            <b>Ковер зураг нэмэх</b>
            <span className="wr-pick"><img src="/icons/plus16.svg" width={16} height={16} alt="" />Зураг сонгох</span>
            <small>JPG, PNG, WEBP · 740×280 харьцаагаар автоматаар тайрна</small>
          </ImageInput>
        </section>

        <section className="wr-card">
          <div className="wr-sec-head">
            <div><h2>Гарчиг ба төрөл</h2><p>Уншигчийн анхаарлыг татах товч, тод гарчиг бичээрэй.</p></div>
          </div>
          <label className="wr-label">Үндсэн гарчиг <em>Заавал</em></label>
          <input className="wr-title" name="title" required maxLength={200} defaultValue={post.title || ""} placeholder="Үндсэн гарчиг" />
          <label className="wr-label">Дэд гарчиг <span className="wr-hint">заавал биш · 250 хүртэл</span></label>
          <textarea className="wr-sub" name="subtitle" maxLength={250} rows={2} defaultValue={post.subtitle || ""} placeholder="Дэд гарчиг" />
          <label className="wr-label">Төрөл сонгох <em>Заавал</em></label>
          <div className="wr-select">
            <select name="kind" defaultValue={kind} aria-label="Төрөл">
              {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
            <img src="/icons/chevdown.svg" width={20} height={20} alt="" />
          </div>
        </section>

        <section className="wr-card">
          <div className="wr-sec-head">
            <div><h2>Нийтлэлийн агуулга</h2><p>Догол мөр хооронд хоосон мөр үлдээвэл тусдаа догол болж харагдана.</p></div>
          </div>
          <div className="wr-editor">
            <ContentField defaultValue={post.body || ""} />
          </div>
          <div className="wr-inserts">
            <DictAdd className="wr-insert" label="Шинэ үгийн тайлбар нэмэх" icon={<img src="/icons/book18.svg" width={18} height={18} alt="" />} />
            <span className="wr-insert soon" title="Тун удахгүй"><img src="/icons/link18.svg" width={18} height={18} alt="" />Эх сурвалж нэмэх</span>
          </div>
        </section>

        <section className="wr-card wr-foot">
          {extra}
          <span className="ss-grow" />
          <button type="submit" className="wr-go">
            Хянуулахаар илгээх
            <img src="/icons/arrowr.svg" width={19} height={19} alt="" />
          </button>
        </section>
      </form>
    </div>
  );
}
