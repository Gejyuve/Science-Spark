import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { sql, ensureSchema } from "@/lib/db";
import { getUser, canWrite, isStaff } from "@/lib/auth";
import { writeLevel } from "@/lib/levels";
import { KINDS } from "@/lib/format";
import { updatePost, deletePost, editContent } from "../../../posts/actions";
import PostForm from "../../../components/PostForm";
import Shell from "../../../components/Shell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Засах · Science Spark" };

// Бичээч өөрийн, редакц (админ, супер админ) бүх контентыг засна. Засвар бүр түүхэнд үлдэнэ.
export default async function EditPage({ params, searchParams }) {
  const { id } = await params;
  const { error } = await searchParams;
  const postId = Number(id);
  if (!Number.isInteger(postId)) notFound();
  const user = await getUser();
  if (!user) redirect("/login");
  await ensureSchema();
  const [post] = await sql`SELECT * FROM posts WHERE id = ${postId}`;
  if (!post || post.kind === "Үг") notFound();
  const own = post.author_id === user.id;
  const staff = isStaff(user) && !own;
  if (!own && !staff) notFound();
  if (post.status === "merged") redirect(`/post/${post.meta?.merged_into || ""}`);
  // Хүлээгдэж буй контентыг редакц засварлах самбараас засна
  if (staff && post.status === "pending") redirect(`/review/${post.id}`);
  const live = staff || post.status === "published";
  const noteField = live && (
    <label className="ed-note">
      <span>Юу зассан бэ? (засварын түүхэнд нийтэд харагдана)</span>
      <input name="edit_note" maxLength={300} placeholder="Жишээ нь: тоон мэдээллийг шинэчилсэн" />
    </label>
  );

  if (KINDS.includes(post.kind)) {
    return (
      <>
        <PostForm
          action={updatePost}
          post={post}
          error={error}
          heading={staff ? "Редакц: нийтлэл засварлах" : "Нийтлэлээ засварлах"}
          kinds={["Нийтлэл", "Мэдээ"].filter((k) => k === post.kind || canWrite(user, k))}
          locked={{ Нийтлэл: writeLevel("Нийтлэл"), Мэдээ: writeLevel("Мэдээ") }}
          submit={live ? "Засвар хадгалах" : undefined}
          extra={<>{noteField}<Link href={`/post/${post.id}`} className="wr-cancel">Цуцлах</Link></>}
        />
        {own && (
          <form action={deletePost} className="wr-delete">
            <input type="hidden" name="post_id" value={post.id} />
            <button className="btn ghost danger" type="submit">Нийтлэлийг устгах</button>
          </form>
        )}
      </>
    );
  }

  const m = post.meta || {};
  const short = post.kind === "Асуулт" || post.kind === "Бодрол";
  const f = (name, label, v, props = {}) => (
    <label key={name}><span>{label}</span><input name={name} defaultValue={v ?? ""} {...props} /></label>
  );
  return (
    <Shell user={user} header="nav">
      <div className="ed-page">
        <Link href={`/post/${post.id}`} className="pv-back">← Буцах</Link>
        <h1>{staff ? `Редакц: ${post.kind} засварлах` : `${post.kind} засварлах`}</h1>
        {error && <p className="error">{error}</p>}
        <form action={editContent} className="ed-form">
          <input type="hidden" name="post_id" value={post.id} />
          {!short && f("title", "Гарчиг", post.title, { required: true, maxLength: 200 })}
          {(post.kind === "Даалгавар" || post.kind === "Тайлан") && f("subtitle", "Товч тайлбар", post.subtitle, { maxLength: 250 })}
          <label><span>{short ? "Агуулга" : "Тайлбар"}</span>
            <textarea name="body" required rows={short ? 4 : 10} maxLength={short ? 300 : post.kind === "Эвент" ? 1000 : post.kind === "Зарлал" ? 500 : 40000} defaultValue={post.body} />
          </label>
          {post.kind === "Бодрол" && f("source", "Эх сурвалж (холбоос)", m.source, { maxLength: 300 })}
          {post.kind === "Эвент" && (<div className="ed-grid">
            {f("starts_at", "Эхлэх", m.starts_at, { type: "datetime-local", required: true })}
            {f("ends_at", "Дуусах", m.ends_at, { type: "datetime-local", required: true })}
            {f("location", "Байршил", m.location, { maxLength: 200 })}
            {f("price", "Тасалбар", m.price, { maxLength: 60 })}
            {f("capacity", "Багтаамж", m.capacity, { maxLength: 10 })}
            {f("link", "Холбоос", m.link, { maxLength: 300 })}
            {f("register", "Бүртгэлийн заавар", m.register, { maxLength: 500 })}
          </div>)}
          {post.kind === "Зарлал" && (<div className="ed-grid">
            {f("valid_until", "Хүчинтэй хугацаа", m.valid_until, { type: "date", required: true })}
            {f("contact", "Холбоо барих", m.contact, { maxLength: 120, required: true })}
            {f("location", "Байршил", m.location, { maxLength: 200 })}
            {f("link", "Холбоос", m.link, { maxLength: 300 })}
          </div>)}
          {noteField || (
            <label className="ed-note"><span>Юу зассан бэ? (засварын түүхэнд нийтэд харагдана)</span><input name="edit_note" maxLength={300} /></label>
          )}
          <button className="btn">Засвар хадгалах</button>
        </form>
      </div>
    </Shell>
  );
}
