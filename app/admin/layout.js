import Link from "next/link";
import { redirect } from "next/navigation";
import { sql, ensureSchema } from "@/lib/db";
import { displayName, ROLE_LABELS } from "@/lib/auth";
import { SECTIONS, canSee, isAdminRole, getAdminUser } from "@/lib/admin";
import { stopViewAs } from "./viewas";
import AdminNav from "./_c/AdminNav";

export const dynamic = "force-dynamic";
export const metadata = { title: "Редакц · Админ · Science Spark" };

// Figma: Админ боард. Нэг боард — супер админд бүх хэсэг, админд зөвшөөрөгдсөн хэсгүүд.
export default async function AdminLayout({ children }) {
  const user = await getAdminUser();
  if (!user) redirect("/");
  const va = user.viewAs;
  if (!isAdminRole(user) && !va) redirect("/");
  await ensureSchema();

  const banner = va && (
    <form action={stopViewAs} className="adm-viewas">
      <input type="hidden" name="back" value={`/admin/users/${va.id}`} />
      <span>👁 Та <b>{displayName(va)}</b> ({ROLE_LABELS[va.role]})-ийн нүдээр харж байна. Энэ горимд та зөвхөн тэдний эрхээр үйлдэл хийнэ.</span>
      <button className="adm-btn">Гарах</button>
    </form>
  );

  // Хянагч, энгийн хэрэглэгч админ боард огт харахгүй
  if (!isAdminRole(user)) {
    return (
      <div className="adm">
        <aside className="adm-side">
          <span className="adm-brand"><img src="/icons/a_brand.svg" width={22} height={22} alt="" /><b>Science Spark</b></span>
        </aside>
        <main className="adm-main">
          {banner}
          <section className="adm-card adm-soon">
            <b>Админ боард харагдахгүй</b>
            <p>
              {ROLE_LABELS[va.role]} эрхтэй хүн энэ боард руу орох боломжгүй, шууд нүүр хуудас руу буцна.
              {va.role === "reviewer" && " Тэр зөвхөн зүүн цэсний «Хяналт» товчоор хүлээгдэж буй нийтлэлүүдийг хянана."}
            </p>
            {va.role === "reviewer" && <Link href="/review" className="adm-btn dark">Хяналт хуудсыг харах</Link>}
          </section>
        </main>
      </div>
    );
  }

  let pending = 0;
  try {
    pending = (await sql`SELECT COUNT(*)::int AS n FROM posts WHERE status = 'pending'`)[0].n;
  } catch (e) {}
  const items = SECTIONS.filter((s) => canSee(user, s.key)).map((s) => ({
    ...s,
    badge: s.key === "content" && pending > 0 ? pending : null,
  }));
  return (
    <div className="adm">
      <aside className="adm-side">
        <Link href="/admin" className="adm-brand">
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
        {banner}
        {children}
      </main>
    </div>
  );
}
