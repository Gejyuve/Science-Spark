import { notFound, redirect } from "next/navigation";
import { sql, ensureSchema } from "@/lib/db";

export const dynamic = "force-dynamic";

// Хуучин холбоос, мэдэгдэл: видео бүр одоо контентын хуудастай (/post/[id])
export default async function VideoRedirect({ params }) {
  const { id } = await params;
  await ensureSchema();
  const [v] = await sql`SELECT post_id FROM videos WHERE id = ${Number(id) || 0}`;
  if (!v?.post_id) notFound();
  redirect(`/post/${v.post_id}`);
}
