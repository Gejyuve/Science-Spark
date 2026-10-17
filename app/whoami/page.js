import Link from "next/link";
import { getUser, superAdminEmails, ROLE_LABELS } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Оношилгоо: зөвхөн өөрийн эрх, SUPER_ADMIN_EMAILS-д орсон эсэхийг харуулна (бусдын имэйл задлахгүй).
export default async function WhoAmI() {
  const user = await getUser();
  const list = superAdminEmails();
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>Оношилгоо</h1>
        <p>Нэвтэрсэн имэйл: <b>{user ? user.email : "нэвтрээгүй"}</b></p>
        <p>Эрх: <b>{user ? ROLE_LABELS[user.role] || user.role : "-"}</b></p>
        <p>SUPER_ADMIN_EMAILS тохируулсан эсэх: <b>{list.length ? "тийм" : "үгүй"}</b></p>
        <p>Таны имэйл жагсаалтад: <b>{user && list.includes(user.email.toLowerCase()) ? "тийм" : "үгүй"}</b></p>
        <p className="muted"><Link href="/">← Нүүр</Link></p>
      </div>
    </div>
  );
}
