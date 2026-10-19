import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { sql, ensureSchema } from "@/lib/db";
import { getUser, isStaff } from "@/lib/auth";
import { mergePosts } from "../../../posts/actions";
import PostForm from "../../../components/PostForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Нийтлэл нэгтгэх · Science Spark" };

const name = (u) => (u.first_name ? `${u.initial}.${u.first_name}` : u.email);

// Редакц: хоёр нийтлэлийг бичих самбар дээр нэгтгэнэ. Сонгосон нийтлэл үндсэн нийтлэлийн төгсгөлөөс үргэлжилнэ.
export default async function MergeEditor({ params, searchParams }) {
  const { id } = await params;
  const { b, error } = await searchParams;
  const a = Number(id);
  const bid = Number(b);
  if (!Number.isInteger(a)) notFound();
  const user = await getUser();
  if (!user) redirect("/login");
  if (!isStaff(user)) notFound();
  await ensureSchema();
  if (!Number.isInteger(bid) || bid === a) redirect(`/admin/content/merge?a=${a}`);
  const rows = await sql`SELECT * FROM posts WHERE id IN (${a}, ${bid}) AND kind = 'Нийтлэл' AND status = 'published'`;
  const A = rows.find((r) => r.id === a);
  const B = rows.find((r) => r.id === bid);
  if (!A || !B) redirect(`/admin/content/merge?a=${a}&error=${encodeURIComponent("Нийтлэгдсэн хоёр нийтлэлийг л нэгтгэнэ")}`);

  // Хоёр нийтлэлийн бичээчид (өмнө нэгтгэгдсэн бичээчдийг оруулаад), бичсэн дарааллаар
  const authors = await sql`
    SELECT DISTINCT ON (u.id) u.id, u.initial, u.first_name, u.email, x.at
    FROM (
      SELECT ${A.author_id}::int AS user_id, ${A.created_at}::timestamptz AS at
      UNION ALL SELECT ${B.author_id}::int, ${B.created_at}::timestamptz
      UNION ALL SELECT user_id, at FROM post_credits WHERE post_id IN (${a}, ${bid}) AND role = 'author'
    ) x JOIN users u ON u.id = x.user_id
    ORDER BY u.id, x.at`;
  const prev = A.meta?.author_order || [];
  const rank = (u) => (prev.includes(u.id) ? prev.indexOf(u.id) : 1000 + new Date(u.at).getTime() / 1e13);
  authors.sort((x, y) => rank(x) - rank(y));

  const seen = new Set();
  const sources = [...(A.meta?.sources || []), ...(B.meta?.sources || [])].filter((s) => {
    const k = JSON.stringify(s);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const post = { ...A, body: `${A.body}\n\n${B.body}`, meta: { ...(A.meta || {}), sources } };

  const panel = (
    <section className="wr-card mg-panel">
      <input type="hidden" name="b" value={B.id} />
      <div className="wr-sec-head">
        <div><h2>Нэгтгэл</h2><p>«{B.title}» нийтлэл «{A.title}» нийтлэлийн төгсгөлөөс үргэлжилж байна. Агуулгыг давхардалгүй, уялдаатай болгож засаарай.</p></div>
      </div>
      <div className="mg-pair">
        <span><b>Үндсэн:</b> <Link href={`/post/${A.id}`} target="_blank">{A.title}</Link></span>
        <span><b>Нэгтгэх:</b> <Link href={`/post/${B.id}`} target="_blank">{B.title}</Link></span>
      </div>
      <label className="wr-label">Бичээчдийн дараалал <em>Заавал</em> <span className="wr-hint">нийтлэлийн доор энэ дарааллаар харагдана</span></label>
      <ol className="mg-order">
        {authors.map((u, i) => (
          <li key={u.id}>
            <select name={`order_${u.id}`} defaultValue={i + 1} aria-label={`${name(u)}-ийн дараалал`}>
              {authors.map((_, j) => <option key={j} value={j + 1}>{j + 1}</option>)}
            </select>
            <b>{name(u)}</b>
            <small>{u.id === A.author_id ? "Үндсэн нийтлэлийн бичээч" : u.id === B.author_id ? "Нэгтгэх нийтлэлийн бичээч" : "Өмнө нэгтгэгдсэн"}</small>
          </li>
        ))}
      </ol>
      <label className="mg-note">
        <span>Редакцын тайлбар <em className="wr-req">Заавал</em> · нийтлэлийн доор өөр өнгөөр, нэгтгэсэн огноотойгоо харагдана</span>
        <textarea name="merge_note" required maxLength={500} rows={3} placeholder="Жишээ нь: Ижил сэдэвтэй хоёр нийтлэлийг нэгтгэж, давхардсан хэсгийг хассан." />
      </label>
    </section>
  );

  return (
    <PostForm
      action={mergePosts}
      post={post}
      error={error}
      heading="Редакц: нийтлэл нэгтгэх"
      kinds={["Нийтлэл"]}
      submit="Нэгтгэх"
      draftKey={`ss-draft:merge:${A.id}:${B.id}`}
      panel={panel}
      extra={<Link href={`/admin/content/merge?a=${A.id}`} className="wr-cancel">Цуцлах</Link>}
    />
  );
}
