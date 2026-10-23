import Link from "next/link";
import TopNav from "../components/TopNav";
import { redirect } from "next/navigation";
import { sql, ensureSchema } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { visibleSections, isAdminRole, homeFor } from "@/lib/admin";
import AdminNav from "./_c/AdminNav";

export const dynamic = "force-dynamic";
export const metadata = { title: "Редакц · Админ · Science Spark" };

// Figma: Админ боард. Нэг боард — супер админд бүх хэсэг, админд зөвшөөрөгдсөн хэсгүүд.
export default async function AdminLayout({ children }) {
  const user = await getUser();
  if (!isAdminRole(user)) redirect("/");
  await ensureSchema();

  let pending = 0;
  let requests = 0;
  let logic = 0;
  let finance = 0;
  let del = 0;
  let mag = 0;
  try {
    const [c] = await sql`SELECT (SELECT COUNT(*) FROM posts WHERE status = 'pending')::int AS p,
      (SELECT COUNT(*) FROM reviewer_requests WHERE status = 'pending')::int AS r,
      (SELECT COUNT(*) FROM logic_reports WHERE status = 'open')::int AS l,
      ((SELECT COUNT(*) FROM payment_requests WHERE status = 'pending') + (SELECT COUNT(*) FROM withdrawals WHERE status = 'pending'))::int AS f,
      (SELECT COUNT(*) FROM users WHERE delete_pending_at IS NOT NULL)::int AS d,
      ((SELECT COUNT(*) FROM magazine_orders WHERE status = 'paid') + (SELECT COUNT(*) FROM magazine_requests WHERE status = 'new'))::int AS m`;
    pending = c.p;
    requests = c.r;
    logic = c.l;
    finance = c.f;
    del = c.d;
    mag = c.m;
  } catch (e) {}
  const sup = user.role === "superadmin";
  // Санхүү, устгах дарааллын тоо зөвхөн шийдэх эрхтэй супер админд
  const badges = { content: pending, requests, logic, finance: sup ? finance : 0, users: sup ? del : 0, magazine: sup ? mag : 0 };
  const items = visibleSections(user).map((s) => ({ ...s, badge: badges[s.key] || null }));
  return (
    <div className="adm">
      <aside className="adm-side">
        <Link href={homeFor(user)} className="adm-brand">
          <img src="/icons/a_brand.svg" width={22} height={22} alt="" />
          <b>Science Spark</b>
        </Link>
        <span className="adm-chip">{user.role === "superadmin" ? "СУПЕР АДМИН · РЕДАКЦ" : "АДМИН · РЕДАКЦ"}</span>
        <AdminNav items={items} />
        <span className="ss-grow" />
        <Link href="/" className="adm-back">
          <img src="/icons/logo.svg" width={36} height={36} alt="" />
          <span>← Буцах</span>
        </Link>
      </aside>
      <main className="adm-main">
        <TopNav />
        {children}
      </main>
    </div>
  );
}
