import { redirect } from "next/navigation";

// Хуучин дэмжих хуудас: одоо бүх дэмжлэг цонхоор явна, хуучин холбоосыг зохих хуудас руу шилжүүлнэ
export default async function Support({ searchParams }) {
  const sp = await searchParams;
  const post = Number(sp.post);
  redirect(Number.isInteger(post) && post > 0 ? `/post/${post}` : "/san");
}
