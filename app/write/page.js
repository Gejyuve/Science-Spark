import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser, canWrite } from "@/lib/auth";
import { KINDS } from "@/lib/format";
import { LEVELS, writeLevel, ARTICLE_LEVEL } from "@/lib/levels";
import { createPost } from "../posts/actions";
import PostForm from "../components/PostForm";
import TopNav from "../components/TopNav";

export const metadata = { title: "Бичих · Science Spark" };

const ART = ["Нийтлэл", "Мэдээ"];

export default async function WritePage({ searchParams }) {
  const user = await getUser();
  if (!user) redirect("/login");
  const { error, kind } = await searchParams;
  const kinds = ART.filter((k) => canWrite(user, k));
  // Түвшин 1 хүрээгүй: нийтлэл бичих эрх хараахан нээгдээгүй
  if (!kinds.length) {
    const need = LEVELS[ARTICLE_LEVEL];
    const left = Math.max(0, need.min - (user.points || 0));
    const pct = Math.min(100, Math.round(((user.points || 0) / need.min) * 100));
    return (
      <div className="wr-page">
        <span className="au-blob a" aria-hidden="true" />
        <span className="au-blob b" aria-hidden="true" />
        <TopNav className="wr-nav" />
        <section className="wr-lock">
          <img src={`/icons/lv${need.n}.svg`} width={64} height={64} alt="" />
          <h1>Нийтлэл бичих эрх Түвшин {need.n} · {need.name}-аас нээгдэнэ</h1>
          <p>Танд одоо {(user.points || 0).toLocaleString("en-US")} оч байна. Дахиад {left.toLocaleString("en-US")} оч цуглуулбал нийтлэл бичих боломжтой болно.</p>
          <span className="och-bar"><span style={{ width: `${pct}%`, background: need.color }} /></span>
          <p className="wr-lock-sub">Асуулт асуух, бодрол хуваалцах, бусдын контентод оч өгөх, профайлаа бөглөх зэргээр оч цуглуулаарай.</p>
          <div className="wr-lock-acts">
            <Link href="/" className="wr-go">Нүүр хуудас руу</Link>
            <Link href="/och" className="wr-lock-link">Очны учир</Link>
          </div>
        </section>
      </div>
    );
  }
  const want = KINDS.includes(kind) && kinds.includes(kind) ? kind : kinds[0];
  return (
    <PostForm
      action={createPost}
      error={error}
      post={{ kind: want }}
      kinds={kinds}
      locked={{ Нийтлэл: writeLevel("Нийтлэл"), Мэдээ: writeLevel("Мэдээ") }}
    />
  );
}
