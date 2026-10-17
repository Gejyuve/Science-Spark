import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { sql, ensureSchema } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { crumbs } from "@/lib/tree";
import { render } from "@/lib/md";
import { submitDraft } from "../../../posts/actions";
import Shell from "../../../components/Shell";
import { Person } from "../../../components/Bits";
import { Sources } from "../../../components/RichEditor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Урьдчилж харах · Science Spark" };

// Figma 454:272 · Нийтлэл · Урьдчилж харах (зөвхөн бичээчид)
export default async function PreviewPage({ params, searchParams }) {
  const { id } = await params;
  const { error } = await searchParams;
  const postId = Number(id);
  if (!Number.isInteger(postId)) notFound();
  const user = await getUser();
  if (!user) redirect("/login");
  await ensureSchema();
  const [post] = await sql`
    SELECT p.*, COALESCE((SELECT SUM(delta) FROM points_ledger WHERE user_id = p.author_id), 0)::int AS author_points,
           (SELECT COUNT(*) FROM follows WHERE followee_id = p.author_id)::int AS author_followers
    FROM posts p WHERE p.id = ${postId} AND p.author_id = ${user.id}`;
  if (!post) notFound();
  if (post.status !== "draft") redirect(`/post/${postId}`);
  const m = post.meta || {};
  const sources = Array.isArray(m.sources) ? m.sources : [];
  return (
    <Shell user={user} header="nav">
      <div className="ar-col">
        <section className="pv-top">
          <span className="pv-eye"><img className="ic" src="/icons/eye.svg" width={20} height={20} alt="" /></span>
          <span className="pv-tx">
            <b>Урьдчилж харах</b>
            <small>Нийтлэгдсэний дараа ийм харагдана. Энэ хуудас зөвхөн танд харагдана.</small>
          </span>
          <Link href={`/post/${post.id}/edit`} className="pv-back">← Засах руу буцах</Link>
        </section>

        <article className="ar-card">
          {post.image_id && (
            <figure className="ar-coverfig">
              <img className="ar-cover" src={`/img/${post.image_id}`} alt="" />
              {m.cover?.source && <figcaption>Зураг: {m.cover.url ? <a href={m.cover.url} target="_blank" rel="noopener noreferrer nofollow">{m.cover.source}</a> : m.cover.source}</figcaption>}
            </figure>
          )}
          <div className="ar-content">
            <div className="ar-chips">
              <span className="ar-chip main">{post.kind}</span>
              {crumbs(post.category).map((c) => <span key={c.path} className="ar-chip cat">{c.name}</span>)}
            </div>
            <h1 className="ar-title">{post.title}</h1>
            {post.subtitle && (<><p className="ar-lead">{post.subtitle}</p><div className="ar-divider" /></>)}
            <div className="ar-body">
              {render(post.body)}
              {sources.length > 0 && <Sources sources={sources} />}
            </div>
            <div className="ar-credits">
              <div>
                <span className="ar-label">Бичсэн:</span>
                <Person id={user.id} initial={user.initial} first_name={user.first_name} avatar={user.avatar} points={post.author_points} followers={post.author_followers} viewer={null} following={null} />
              </div>
              <div>
                <span className="ar-label">Хянасан:</span>
                <span className="pv-wait">Редакц хянасны дараа энд гарна</span>
              </div>
            </div>
          </div>
        </article>

        <form action={submitDraft} className="pv-send">
          <input type="hidden" name="post_id" value={post.id} />
          {error && <p className="error">{error}</p>}
          <label className="pv-agree">
            <input type="checkbox" name="agree" value="1" required />
            <span><Link href="/och" target="_blank">Дүрэм ба зарчмыг</Link> зөвшөөрөх</span>
          </label>
          <span className="ss-grow" />
          <button type="submit" className="wr-go">Редакц руу илгээх <img src="/icons/arrowr.svg" width={19} height={19} alt="" /></button>
        </form>
      </div>
    </Shell>
  );
}
