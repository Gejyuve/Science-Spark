import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sql, ensureSchema } from "./db";
import { getUser } from "./auth";

// Админ боардын хэсгүүд. Супер админ бүгдийг; редакцийн админ зөвхөн EDITORIAL хэсгүүдийг харна.
export const SECTIONS = [
  { key: "overview", label: "Тойм", icon: "a_overview", href: "/admin" },
  { key: "users", label: "Хэрэглэгчид", icon: "a_users", href: "/admin/users" },
  { key: "content", label: "Контент", icon: "a_content", href: "/admin/content" },
  { key: "logic", label: "Логик алдаа", icon: "a_logic", href: "/admin/logic" },
  { key: "finance", label: "Санхүү · Шагналын сан", icon: "a_points", href: "/admin/finance" },
  { key: "audit", label: "Аудит лог", icon: "a_audit", href: "/admin/audit" },
  { key: "settings", label: "Тохиргоо", icon: "a_settings", href: "/admin/settings" },
];
// Админы тогтмол хэсгүүд. Эрх олгох, хэрэглэгч, оч, санхүү, аудит, тохиргоо зөвхөн супер админд.
export const EDITORIAL = ["overview", "content", "logic"];

export const isAdminRole = (u) => !!u && (u.role === "admin" || u.role === "superadmin");

export function canSee(user, key) {
  if (!user) return false;
  if (user.role === "superadmin") return true;
  if (user.role !== "admin") return false;
  return EDITORIAL.includes(key);
}

// Аудит лог: бүх эрх, оч, контент, нэвтрэлтийн үйлдэл бичигдэнэ (засах, устгах боломжгүй)
export async function audit({ actorId = null, category, action, targetType = null, targetId = null, targetLabel = null, ok = true }) {
  let ip = null;
  try {
    const h = await headers();
    ip = (h.get("x-forwarded-for") || "").split(",")[0].trim() || h.get("x-real-ip") || null;
  } catch (e) {}
  try {
    await sql`INSERT INTO audit_log (actor_id, category, action, target_type, target_id, target_label, ok, ip)
              VALUES (${actorId}, ${category}, ${action}, ${targetType}, ${targetId}, ${targetLabel}, ${ok}, ${ip})`;
  } catch (e) {}
}

export const maskIp = (ip) => (ip ? ip.replace(/^(\d+\.\d+)\.\d+\.(\d+)$/, "$1.xx.$2") : "—");

// Хуудас бүрийн эхэнд: эрхгүй бол буцаана.
export async function requireSection(key) {
  const user = await getUser();
  if (!isAdminRole(user)) redirect("/");
  if (!canSee(user, key)) redirect("/admin");
  await ensureSchema();
  return user;
}

export const STATUS_LABELS = { pending: "Хүлээгдэж буй", approved: "Нийтлэхэд бэлэн", published: "Нийтлэгдсэн", rejected: "Буцаасан", removed: "Нуусан", discussion: "Хэлэлцэж байна", draft: "Ноорог" };
export const AUDIT_TABS = [
  ["", "Бүгд"],
  ["role", "Эрх · түвшин"],
  ["points", "Оч · торгууль"],
  ["content", "Контент"],
  ["login", "Нэвтрэлт"],
  ["settings", "Тохиргоо"],
];
export const ago = (d) => {
  const s = Math.max(0, (Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "дөнгөж сая";
  if (s < 3600) return `${Math.floor(s / 60)} мин өмнө`;
  if (s < 86400) return `${Math.floor(s / 3600)} цагийн өмнө`;
  return `${Math.floor(s / 86400)} өдрийн өмнө`;
};
