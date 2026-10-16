import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser, displayName } from "@/lib/auth";
import { levelFor } from "@/lib/levels";
import { logout } from "../auth/actions";

export const metadata = { title: "Профайл · Science Spark" };

export default async function ProfilePage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const level = levelFor(user.points);
  const joined = new Date(user.created_at).toISOString().slice(0, 10).replaceAll("-", ".");

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="avatar">{user.first_name[0]}</div>
        <h1>{displayName(user)}</h1>
        <p className="muted">{user.email}</p>
        <div className="stats">
          <div><b>{user.points}</b><span>оч</span></div>
          <div><b>{level.n}</b><span>{level.name}</span></div>
          <div><b>{joined}</b><span>Нэгдсэн</span></div>
        </div>
        <form action={logout}><button className="btn ghost" type="submit">Гарах</button></form>
        <p className="muted"><Link href="/">← Нүүр</Link></p>
      </div>
    </div>
  );
}
