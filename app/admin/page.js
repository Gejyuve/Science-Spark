import Link from "next/link";
import { redirect } from "next/navigation";
import { sql, ensureSchema } from "@/lib/db";
import { getUser, isSuperAdmin, ROLE_LABELS } from "@/lib/auth";
import { setRole } from "../posts/actions";
import Shell from "../components/Shell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Супер админ · Science Spark" };

const ROLES = [
  ["user", "Хэрэглэгч"],
  ["reviewer", "Хянагч"],
  ["admin", "Админ"],
];

export default async function AdminPage() {
  const user = await getUser();
  if (!isSuperAdmin(user)) redirect("/");
  await ensureSchema();
  const users = await sql`SELECT id, initial, first_name, email, role FROM users ORDER BY id`;
  return (
    <Shell user={user} header={false}>
      <div className="ss-card ss-page">
        <p className="muted"><Link href="/">← Нүүр</Link></p>
        <h1>Хэрэглэгчид</h1>
        {users.map((u) => (
          <form key={u.id} action={setRole} className="user-row">
            <input type="hidden" name="user_id" value={u.id} />
            <div>
              <b>{u.initial}.{u.first_name}</b>
              <div className="muted">{u.email}</div>
            </div>
            {u.id === user.id || u.role === "superadmin" ? (
              <span className="muted">{ROLE_LABELS[u.role]}{u.id === user.id ? " (та)" : ""}</span>
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
    </Shell>
  );
}
