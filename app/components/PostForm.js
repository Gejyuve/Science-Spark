import TopNav from "./TopNav";
import WriteForm from "./WriteForm";
import { plainTree } from "@/lib/tree";

// Figma: Нийтлэл бичих. Шинэ болон засах хуудсанд хоёуланд нь ашиглана.
export default function PostForm({ action, post = {}, error, extra, heading = "Мэдлэг бол хуваалцах тусам арвижих баялаг юм." }) {
  return (
    <div className="wr-page">
      <span className="au-blob a" aria-hidden="true" />
      <span className="au-blob b" aria-hidden="true" />
      <TopNav className="wr-nav" />

      <WriteForm action={action} post={post} tree={plainTree()} error={error} extra={extra} heading={heading} />
    </div>
  );
}
