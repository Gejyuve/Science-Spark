"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql, ensureSchema } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { notifyStaff } from "@/lib/notify";
import { HELP_TYPES, HELP_OPEN_MAX } from "@/lib/help";

const back = (key, msg) => redirect(`/help?${key}=${encodeURIComponent(msg)}#send`);

// Тусламж хуудаснаас гомдол, алдаа, санал илгээнэ. Редакцын «Гомдол» хэсэгт очиж, шийдвэрлэмэгц бичсэн хүнд мэдэгдэл очно.
export async function sendHelp(formData) {
  const user = await getUser();
  if (!user) redirect("/login");
  await ensureSchema();
  const type = String(formData.get("type") || "");
  const body = String(formData.get("body") || "").trim().slice(0, 1000);
  if (!HELP_TYPES.includes(type)) back("error", "Төрлөө сонгоно уу");
  if (body.length < 10) back("error", "Дэлгэрэнгүй бичнэ үү (10-аас дээш тэмдэгт)");
  const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM logic_reports WHERE user_id = ${user.id} AND type = ANY(${HELP_TYPES}) AND status = 'open'`;
  if (n >= HELP_OPEN_MAX) back("error", `Таны ${HELP_OPEN_MAX} хүсэлт хянагдаж байна. Хариу ирсний дараа дахин илгээнэ үү`);
  await sql`INSERT INTO logic_reports (user_id, body, type) VALUES (${user.id}, ${body}, ${type})`;
  // Редакцад (админ, супер админ) шинэ хүсэлт ирснийг мэдэгдэнэ
  await notifyStaff({ kind: "help_new", actorId: user.id, note: body.slice(0, 120) });
  revalidatePath("/admin", "layout");
  revalidatePath("/help");
  back("ok", "Илгээлээ. Редакц хариу өгмөгц танд мэдэгдэл очно");
}
