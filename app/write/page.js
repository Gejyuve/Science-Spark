import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { KINDS } from "@/lib/format";
import { createPost } from "../posts/actions";

export const metadata = { title: "Бичих · Science Spark" };

export default async function WritePage({ searchParams }) {
  const user = await getUser();
  if (!user) redirect("/login");
  const { error } = await searchParams;
  return (
    <div className="auth-wrap">
      <form className="auth-card wide" action={createPost}>
        <h1>Шинэ нийтлэл</h1>
        {error && <p className="error">{error}</p>}
        <label>Төрөл
          <select name="kind" defaultValue="Нийтлэл">
            {KINDS.map((k) => <option key={k}>{k}</option>)}
          </select>
        </label>
        <label>Гарчиг<input name="title" required maxLength={200} /></label>
        <label>Агуулга<textarea name="body" required rows={10} /></label>
        <button className="btn" type="submit">Нийтлэх</button>
        <p className="muted"><Link href="/">← Нүүр</Link></p>
      </form>
    </div>
  );
}
