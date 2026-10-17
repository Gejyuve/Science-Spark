import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/auth";
import { ensureSchema } from "@/lib/db";
import { nodeOf, crumbs, rollup } from "@/lib/tree";
import { listPosts, categoryCounts, kindCount } from "@/lib/archive";
import Shell from "../../components/Shell";
import { ArticleCard, NewsCard, ArchiveRow } from "../../components/Cards";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { path } = await params;
  const n = nodeOf((path || []).map(decodeURIComponent).join("/"));
  return { title: `${n ? n.name : "Мод"} · Science Spark` };
}

const fmt = (n) => Number(n || 0).toLocaleString("en-US");

// Figma 732:944 · Категори: салбарын нүүр (дэд салбарууд, нийтлэл, мэдээ)
export default async function CategoryPage({ params, searchParams }) {
  const { path } = await params;
  const { type, sort = "new", n: more } = await searchParams;
  const key = (path || []).map(decodeURIComponent).join("/");
  const node = nodeOf(key);
  if (!node || !key) notFound();
  const user = await getUser();
  await ensureSchema();
  const counts = rollup(await categoryCounts());
  const trail = crumbs(key);
  const kids = node.children.length ? node.children : (nodeOf(node.parent)?.children || []).filter((c) => c.path !== key);
  const kidsTitle = node.children.length ? "Дэд салбарууд" : "Хөрш салбарууд";
  const base = `/tree/${key}`;
  const q = (o) => {
    const s = new URLSearchParams();
    const v = { type, sort, ...o };
    if (v.type) s.set("type", v.type);
    if (v.sort === "old") s.set("sort", "old");
    if (v.n) s.set("n", v.n);
    const str = s.toString();
    return str ? `${base}?${str}` : base;
  };
  const listKind = type === "article" ? "Нийтлэл" : type === "news" ? "Мэдээ" : null;
  const limit = Math.min(200, Number(more) || 20);

  let articles = [], news = [], list = [], nA = 0, nN = 0, nList = 0;
  if (listKind) {
    [list, nList] = await Promise.all([listPosts({ kind: listKind, category: key, sort, limit }), kindCount(listKind, key)]);
  } else {
    [articles, news, nA, nN] = await Promise.all([
      listPosts({ kind: "Нийтлэл", category: key, sort, limit: 4 }),
      listPosts({ kind: "Мэдээ", category: key, sort, limit: 2 }),
      kindCount("Нийтлэл", key),
      kindCount("Мэдээ", key),
    ]);
  }

  return (
    <Shell user={user} active="/tree" header="nav">
      <section className="ct-hero">
        <h1>{node.name} <em>{fmt(counts[key])}</em></h1>
        <p className="ct-trail">
          <Link href="/tree">Шинжлэх ухаан</Link>
          {trail.map((c) => (
            <span key={c.path}> › {c.path === key ? <b>{c.name}</b> : <Link href={`/tree/${c.path}`}>{c.name}</Link>}</span>
          ))}
        </p>
        <i className="tl-star a" aria-hidden="true" /><i className="tl-star b" aria-hidden="true" /><i className="tl-star c" aria-hidden="true" />
      </section>

      {kids.length > 0 && (
        <section className="ct-kids">
          <b>{kidsTitle} · {kids.length}</b>
          <div>
            {kids.map((c) => (
              <Link key={c.path} href={`/tree/${c.path}`}>{c.name} <em>{fmt(counts[c.path])}</em></Link>
            ))}
          </div>
        </section>
      )}

      <div className="ct-tools">
        {listKind && <Link href={q({ type: null, n: null })} className="ct-back">← {node.name}</Link>}
        <span className="ss-grow" />
        <Link href={q({ sort: sort === "old" ? "new" : "old", n: null })} className="ct-sort" title="Эрэмбэ солих">
          {sort === "old" ? "Хуучин → шинэ" : "Шинэ → хуучин"}
        </Link>
      </div>

      {listKind ? (
        <section className="sr-sec">
          <div className="sr-head"><h2>{listKind}</h2><em>{fmt(nList)}</em></div>
          {list.length === 0 ? (
            <div className="sr-empty"><b>Энэ салбарт {listKind.toLowerCase()} алга</b></div>
          ) : (
            <div className="ac-list">{list.map((p) => <ArchiveRow key={p.id} p={p} />)}</div>
          )}
          {nList > list.length && <Link href={q({ n: limit + 20 })} className="tl-more" scroll={false}>Цааш үзэх</Link>}
        </section>
      ) : (
        <>
          <section className="sr-sec">
            <div className="sr-head">
              <h2>Нийтлэл</h2><em>{fmt(nA)}</em><span className="ss-grow" />
              {nA > articles.length && <Link href={q({ type: "article" })}>Бүгдийг харах →</Link>}
            </div>
            {articles.length ? (
              <div className="sr-grid4">{articles.map((p) => <ArticleCard key={p.id} p={p} />)}</div>
            ) : (
              <div className="ct-empty">
                <p>«{node.name}» салбарт одоохондоо нийтлэл алга. Анхны нийтлэлийг та бичээрэй ✦</p>
                <Link href={user ? "/write" : "/login"} className="sr-btn">Нийтлэл бичих</Link>
              </div>
            )}
          </section>
          {news.length > 0 && (
            <section className="sr-sec">
              <div className="sr-head">
                <h2>Мэдээ</h2><em>{fmt(nN)}</em><span className="ss-grow" />
                {nN > news.length && <Link href={q({ type: "news" })}>Бүгдийг харах →</Link>}
              </div>
              <div className="sr-grid2">{news.map((p) => <NewsCard key={p.id} p={p} />)}</div>
            </section>
          )}
        </>
      )}
    </Shell>
  );
}
