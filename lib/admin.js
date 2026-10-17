import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sql, ensureSchema } from "./db";
import { getUser } from "./auth";

// Админ боардын хэсгүүд. Супер админ бүгдийг; админ "Тойм" + супер админы зөвшөөрсөн хэсгүүдийг харна.
export const SECTIONS = [
  { key: "overview", label: "Тойм", icon: "a_overview", href: "/admin" },
  { key: "requests", label: "Хянагчийн хүсэлт", icon: "a_requests", href: "/admin/requests", soon: true },
  { key: "meetings", label: "Уулзалтууд", icon: "a_meetings", href: "/admin/meetings", soon: true },
  { key: "reviewers", label: "Хянагчид", icon: "a_reviewers", href: "/admin/reviewers" },
  { key: "users", label: "Хэрэглэгчид", icon: "a_users", href: "/admin/users" },
  { key: "content", label: "Контент", icon: "a_content", href: "/admin/content" },
  { key: "logic", label: "Логик алдаа", icon: "a_logic", href: "/admin/logic", soon: true },
  { key: "points", label: "Оч ба Түвшин", icon: "a_points", href: "/admin/points" },
  { key: "audit", label: "Аудит лог", icon: "a_audit", href: "/admin/audit" },
  { key: "settings", label: "Тохиргоо", icon: "a_settings", href: "/admin/settings", soon: true },
];
// Супер админ админд олгож болох хэсгүүд
export const GRANTABLE = SECTIONS.filter((s) => s.key !== "overview");

export const isAdminRole = (u) => !!u && (u.role === "admin" || u.role === "superadmin");

export function canSee(user, key) {
  if (!user) return false;
  if (user.role === "superadmin") return true;
  if (user.role !== "admin") return false;
  return key === "overview" || (user.perms || []).includes(key);
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

// Супер админ өөр хэрэглэгчийн нүдээр боардыг харах горим (зөвхөн харах, cookie: ss_viewas)
export const VIEWAS_COOKIE = "ss_viewas";
export async function getAdminUser() {
  const real = await getUser();
  if (!real || real.role !== "superadmin") return real;
  let id = null;
  try {
    id = Number((await cookies()).get(VIEWAS_COOKIE)?.value);
  } catch (e) {}
  if (!Number.isInteger(id) || id === real.id) return real;
  await ensureSchema();
  const r = await sql`SELECT id, email, initial, first_name, role, perms FROM users WHERE id = ${id}`;
  const t = r[0];
  if (!t || t.role === "superadmin") return real;
  return { ...real, role: t.role, perms: t.perms || [], viewAs: t };
}

// Хуудас бүрийн эхэнд: эрхгүй бол буцаана.
export async function requireSection(key) {
  const user = await getAdminUser();
  if (!isAdminRole(user)) redirect(user?.viewAs ? "/admin/preview" : "/");
  if (!canSee(user, key)) redirect("/admin");
  await ensureSchema();
  return user;
}

export const STATUS_LABELS = { pending: "Хүлээгдэж буй", published: "Нийтлэгдсэн", rejected: "Буцаасан", removed: "Нуусан" };
export const AUDIT_TABS = [
  ["", "Бүгд"],
  ["role", "Эрх · түвшин"],
  ["points", "Оч · торгууль"],
  ["content", "Контент"],
  ["login", "Нэвтрэлт"],
];
export const ago = (d) => {
  const s = Math.max(0, (Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "дөнгөж сая";
  if (s < 3600) return `${Math.floor(s / 60)} мин өмнө`;
  if (s < 86400) return `${Math.floor(s / 3600)} цагийн өмнө`;
  return `${Math.floor(s / 86400)} өдрийн өмнө`;
};
