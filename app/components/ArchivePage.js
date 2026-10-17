import Link from "next/link";
import { getUser } from "@/lib/auth";
import { ensureSchema } from "@/lib/db";
import { listPosts, kindCount } from "@/lib/archive";
import Shell from "./Shell";
import { ArchiveRow } from "./Cards";

const fmt = (n) => Number(n || 0).toLocaleString("en-US");

// Figma 732:496 / 732:736 · Нийтлэл, Мэдээ · Жагсаалт (архив)
export default async function ArchivePage({ kind, path, title, sub, sp }) {
  const user = await getUser();
  await ensureSchema();
  const sort = sp.sort === "old" ? "old" : "new";
  const limit = Math.min(300, Number(sp.n) || 20);
  const [rows, total] = await Promise.all([listPosts({ kind, sort, limit }), kindCount(kind)]);
  const q = (o) => {
    const s = new URLSearchParams();
    const v = { sort, n: null, ...o };
    if (v.sort === "old") s.set("sort", "old");
    if (v.n) s.set("n", v.n);
    const str = s.toString();
    return str ? `${path}?${str}` : path;
  };
  return (
    <Shell user={user} header="nav">
      <section className="ct-hero big">
        <h1>{title}</h1>
        <p>{sub}</p>
        <i className="tl-star a" aria-hidden="true" /><i className="tl-star b" aria-hidden="true" /><i className="tl-star c" aria-hidden="true" />
      </section>
      <div className="ct-tools">
        <small>{fmt(total)} {kind.toLowerCase()}</small>
        <span className="ss-grow" />
        <Link href="/tree" className="ct-back">Мод →</Link>
        <Link href={q({ sort: sort === "old" ? "new" : "old" })} className="ct-sort">{sort === "old" ? "Хуучин → шинэ" : "Шинэ → хуучин"}</Link>
      </div>
      {rows.length === 0 ? (
        <div className="sr-empty"><b>Одоохондоо {kind.toLowerCase()} алга</b><p>Анхныхыг нь та бичээрэй ✦</p></div>
      ) : (
        <div className="ac-list">{rows.map((p) => <ArchiveRow key={p.id} p={p} />)}</div>
      )}
      {total > rows.length && <Link href={q({ n: limit + 20 })} className="tl-more" scroll={false}>Цааш үзэх</Link>}
    </Shell>
  );
}
