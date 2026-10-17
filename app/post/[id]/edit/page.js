import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { sql, ensureSchema } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { updatePost, deletePost } from "../../../posts/actions";
import PostForm from "../../../components/PostForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Засах · Science Spark" };

export default async function EditPage({ params, searchParams }) {
  const { id } = await params;
  const { error } = await searchParams;
  const postId = Number(id);
  if (!Number.isInteger(postId)) notFound();
  const user = await getUser();
  if (!user) redirect("/login");
  await ensureSchema();
  const rows = await sql`SELECT * FROM posts WHERE id = ${postId} AND author_id = ${user.id}`;
  if (!rows.length) notFound();
  const post = rows[0];
  return (
    <>
      <PostForm
        action={updatePost}
        post={post}
        error={error}
        heading="Нийтлэлээ засварлах"
        extra={<Link href={`/post/${post.id}`} className="wr-cancel">Цуцлах</Link>}
      />
      <form action={deletePost} className="wr-delete">
        <input type="hidden" name="post_id" value={post.id} />
        <button className="btn ghost danger" type="submit">Нийтлэлийг устгах</button>
      </form>
    </>
  );
}
