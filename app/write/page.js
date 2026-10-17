import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { KINDS } from "@/lib/format";
import { createPost } from "../posts/actions";
import PostForm from "../components/PostForm";

export const metadata = { title: "Бичих · Science Spark" };

export default async function WritePage({ searchParams }) {
  const user = await getUser();
  if (!user) redirect("/login");
  const { error, kind } = await searchParams;
  return (
    <PostForm
      action={createPost}
      error={error}
      post={{ kind: KINDS.includes(kind) ? kind : "Нийтлэл" }}
    />
  );
}
