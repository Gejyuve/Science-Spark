import Link from "next/link";
import { getUser } from "@/lib/auth";
import { ensureSchema } from "@/lib/db";
import { plainTree, rollup } from "@/lib/tree";
import { categoryCounts, kindCount } from "@/lib/archive";
import Shell from "../components/Shell";
import PageHero from "../components/PageHero";
import TreeList from "../components/TreeList";
import TreeGraph from "../components/TreeGraph";

export const dynamic = "force-dynamic";
export const metadata = { title: "Шинжлэх ухааны мод · Science Spark" };

// Figma 86:17 · Мод: салбарын жагсаалт ба интерактив мод
export default async function TreePage() {
  const user = await getUser();
  await ensureSchema();
  const [cc, nArticles, nNews] = await Promise.all([categoryCounts(), kindCount("Нийтлэл"), kindCount("Мэдээ")]);
  const counts = rollup(cc);
  const tree = plainTree(counts);
  return (
    <Shell user={user} active="/tree" header="nav">
      <PageHero
        tone="tree"
        title="Шинжлэх ухааны мод"
        text="Шинжлэх ухааныг салбар, дэд салбараар нь том мод хэлбэрээр хараарай. Салаа дээр дарж мод задлах, салбар бүрийн дэргэдэх тоогоор агуулгын тоог харах, салбар дээр дарж тухайн сэдвийн бүх агуулгыг уншиж болно."
      >
        <Link href="/articles" className="ph-btn"><span className="e" aria-hidden="true">📖</span><b>Бүх нийтлэл</b><small>{nArticles} →</small></Link>
        <Link href="/news" className="ph-btn"><span className="e" aria-hidden="true">📡</span><b>Бүх мэдээ</b><small>{nNews} →</small></Link>
      </PageHero>
      <TreeList tree={tree} loggedIn={!!user} />
      <TreeGraph tree={tree} loggedIn={!!user} />
    </Shell>
  );
}
