import Link from "next/link";
import TopNav from "../components/TopNav";
import { redirect } from "next/navigation";
import { sql, ensureSchema } from "@/lib/db";
import { getUser, isStaff, needsName } from "@/lib/auth";
import { levelFor } from "@/lib/levels";
import { canApproveWords } from "@/lib/terms";
import AdminNav from "../admin/_c/AdminNav";
import { visibleSections, homeFor } from "@/lib/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Хяналт · Science Spark" };

// Figma: Хяналт · Нийтлэл хянагчийн боард (бараан цэстэй, админ боардтай ижил загвар)
export default async function ReviewLayout({ children }) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (needsName(user)) redirect("/profile/edit");
  // Редакц эсвэл шинэ үг зөвшөөрөх түвшинд (5+) хүрсэн хэрэглэгч
  if (!isStaff(user) && !canApproveWords(user)) redirect("/");
  await ensureSchema();
  const staff = isStaff(user);
  const lv = levelFor(user.points).n;
  let pending = 0;
  if (staff) {
    try {
      pending = (await sql`SELECT COUNT(*)::int AS n FROM posts WHERE status = 'pending'`)[0].n;
    } catch (e) {}
  }
  // Редакц: засварлах самбар (/review/:id) нь админ боардын Контент хэсгийн нэг хэсэг
  const items = staff
    ? visibleSections(user).map((s) =>
        s.key === "content" ? { ...s, exact: true, match: "^/(review/(\\d+|word)|admin/content)", badge: pending || null } : s)
    : [
        { key: "words", label: "Шинэ үг зөвшөөрөх", icon: "a_content", href: "/review", exact: true, match: "^/review/word" },
      ];
  const chip = staff
    ? (user.role === "superadmin" ? "СУПЕР АДМИН · РЕДАКЦ" : "АДМИН · РЕДАКЦ")
    : `ТҮВШИН ${lv}`;
  return (
    <div className="adm">
      <aside className="adm-side">
        <Link href={staff ? homeFor(user) : "/review"} className="adm-brand">
          <img src="/icons/a_brand.svg" width={22} height={22} alt="" />
          <b>Science Spark</b>
        </Link>
        <span className="adm-chip">{chip}</span>
        <AdminNav items={items} />
        <span className="ss-grow" />
        <Link href="/" className="adm-back">
          <img src="/icons/logo.svg" width={36} height={36} alt="" />
          <span>← Буцах</span>
        </Link>
      </aside>
      <main className="adm-main">
        <TopNav />{children}</main>
    </div>
  );
}
