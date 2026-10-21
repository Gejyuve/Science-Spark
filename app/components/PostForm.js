import TopNav from "./TopNav";
import WriteForm from "./WriteForm";
import { plainTree } from "@/lib/tree";
import { writeLevel } from "@/lib/levels";

// Figma: Нийтлэл бичих. Шинэ болон засах хуудсанд хоёуланд нь ашиглана.
export default function PostForm({ action, post = {}, error, extra, heading = "Мэдлэг бол хуваалцах тусам арвижих баялаг юм.", kinds, locked, submit, draftKey, panel, rules }) {
  return (
    <div className="wr-page">
      <span className="au-blob a" aria-hidden="true" />
      <span className="au-blob b" aria-hidden="true" />
      <TopNav className="wr-nav" />

      <WriteForm action={action} post={post} tree={plainTree()} error={error} extra={extra} heading={heading} kinds={kinds} locked={locked || { Нийтлэл: writeLevel("Нийтлэл"), Мэдээ: writeLevel("Мэдээ") }} submit={submit} draftKey={draftKey} panel={panel} rules={rules} />
      <div className="wr-mobile">
        <img src="/icons/logo.svg" width={56} height={56} alt="" />
        <b>Бичих самбар зөвхөн компьютерээс ажиллана</b>
        <p>Урт нийтлэл бичих, зураг, эх сурвалж оруулахад том дэлгэц хэрэгтэй. Компьютерээсээ нэвтэрч бичээрэй. Утаснаасаа асуулт, бодрол, эвент, зарлалыг нүүр хуудаснаас шууд нийтэлж болно.</p>
        <a href="/" className="wr-go">Нүүр хуудас руу</a>
      </div>
    </div>
  );
}
