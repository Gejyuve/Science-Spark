import Link from "next/link";
import TopNav from "../components/TopNav";
import { redirect } from "next/navigation";
import { sql, ensureSchema } from "@/lib/db";
import { getUser, isStaff, isAdmin, needsName } from "@/lib/auth";
import { levelFor } from "@/lib/levels";
import { canApproveWords } from "@/lib/terms";
import AdminNav from "../admin/_c/AdminNav";
import { SECTIONS, canSee } from "@/lib/admin";

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
      pending = (await sql`SELECT COUNT(*)::int AS n FROM posts WHERE status = 'pending' AND author_id <> ${user.id}
        AND (${isAdmin(user)}::boolean OR kind NOT IN ('Даалгавар', 'Тайлан'))`)[0].n;
    } catch (e) {}
  }
  const items = staff
    ? [
        { key: "queue", label: "Хяналтын жагсаалт", icon: "a_content", href: "/review", exact: true, match: "^/review/\\d+", badge: pending || null },
        { key: "archive", label: "Миний шийдвэрүүд", icon: "a_audit", href: "/review/archive" },
        { key: "rules", label: "Редакцийн дүрэм", icon: "a_requests", href: "/review/rules" },
        // Редакцийн админы админ боардын хэсгүүд (Админ товч зөвхөн супер админд харагдана)
        ...(user.role === "admin" ? SECTIONS.filter((s) => s.key !== "overview" && canSee(user, s.key)) : []),
      ]
    : [
        { key: "words", label: "Шинэ үг зөвшөөрөх", icon: "a_content", href: "/review?t=words", match: "^/review/word" },
      ];
  const chip = staff
    ? `${user.role === "superadmin" ? "СУПЕР АДМИН" : "АДМИН"} · ТҮВШИН ${lv}`
    : `ТҮВШИН ${lv}`;
  return (
    <div className="adm">
      <aside className="adm-side">
        <Link href="/review" className="adm-brand">
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
