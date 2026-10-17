import Link from "next/link";
import { redirect } from "next/navigation";
import { sql, ensureSchema } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { setRole } from "../posts/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Админ · Science Spark" };

const ROLES = [
  ["user", "Хэрэглэгч"],
  ["reviewer", "Хянагч"],
  ["admin", "Админ"],
];

export default async function AdminPage() {
  const user = await getUser();
  if (!user || user.role !== "admin") redirect("/");
  await ensureSchema();
  const users = await sql`SELECT id, initial, first_name, email, role FROM users ORDER BY id`;
  return (
    <div className="auth-wrap top">
      <div className="auth-card wide">
        <p className="muted"><Link href="/">← Нүүр</Link></p>
        <h1>Хэрэглэгчид</h1>
        {users.map((u) => (
          <form key={u.id} action={setRole} className="user-row">
            <input type="hidden" name="user_id" value={u.id} />
            <div>
              <b>{u.initial}.{u.first_name}</b>
              <div className="muted">{u.email}</div>
            </div>
            {u.id === user.id ? (
              <span className="muted">{ROLES.find((r) => r[0] === u.role)[1]} (та)</span>
            ) : (
              <>
                <select name="role" defaultValue={u.role}>
                  {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <button className="btn ghost" type="submit">Хадгалах</button>
              </>
            )}
          </form>
        ))}
      </div>
    </div>
  );
}
