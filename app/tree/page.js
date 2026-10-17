import Link from "next/link";
import { getUser } from "@/lib/auth";
import { ensureSchema } from "@/lib/db";
import { plainTree, rollup } from "@/lib/tree";
import { categoryCounts } from "@/lib/archive";
import Shell from "../components/Shell";
import TreeList from "../components/TreeList";
import TreeGraph from "../components/TreeGraph";

export const dynamic = "force-dynamic";
export const metadata = { title: "Шинжлэх ухааны мод · Science Spark" };

// Figma 86:17 · Мод: салбарын жагсаалт ба интерактив мод
export default async function TreePage() {
  const user = await getUser();
  await ensureSchema();
  const counts = rollup(await categoryCounts());
  const tree = plainTree(counts);
  return (
    <Shell user={user} active="/tree" header="nav">
      <section className="tr-intro">
        <div>
          <h1>Шинжлэх ухааны мод</h1>
          <p>
            Шинжлэх ухааныг салбар, дэд салбараар нь том мод хэлбэрээр хараарай. Салаа дээр дарж мод задлах, салбар бүрийн дэргэдэх
            тоогоор агуулгын тоог харах, салбар дээр дарж тухайн сэдвийн бүх агуулгыг уншиж болно.
          </p>
        </div>
        <div className="tr-arch">
          <Link href="/articles"><b>Бүх нийтлэл</b><small>Архив →</small></Link>
          <Link href="/news"><b>Бүх мэдээ</b><small>Архив →</small></Link>
        </div>
      </section>
      <TreeList tree={tree} loggedIn={!!user} />
      <TreeGraph tree={tree} loggedIn={!!user} />
    </Shell>
  );
}
