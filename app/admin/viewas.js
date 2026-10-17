"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { VIEWAS_COOKIE } from "@/lib/admin";

// Зөвхөн жинхэнэ супер админ ашиглана
export async function startViewAs(formData) {
  const me = await getUser();
  if (!me || me.role !== "superadmin") redirect("/");
  const id = Number(formData.get("user_id"));
  if (!Number.isInteger(id)) redirect("/admin/users");
  (await cookies()).set(VIEWAS_COOKIE, String(id), { httpOnly: true, sameSite: "lax", secure: true, path: "/admin", maxAge: 3600 });
  redirect("/admin");
}

export async function stopViewAs(formData) {
  const back = String(formData?.get?.("back") || "");
  (await cookies()).set(VIEWAS_COOKIE, "", { path: "/admin", maxAge: 0 });
  redirect(/^\/admin\/users\/\d+$/.test(back) ? back : "/admin/users");
}
