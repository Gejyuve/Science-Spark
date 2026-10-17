import { getUser, ROLE_LABELS } from "@/lib/auth";
import { sql, ensureSchema } from "@/lib/db";
import { canSee, audit } from "@/lib/admin";

export const dynamic = "force-dynamic";

const cell = (v) => {
  const s = v == null ? "" : String(v);
  // Excel томьёо болж ажиллахаас сэргийлнэ
  const safe = /^[=+\-@]/.test(s) ? "'" + s : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

export async function GET(req) {
  const user = await getUser();
  if (!canSee(user, "users")) return new Response("Хандах эрхгүй", { status: 403 });
  await ensureSchema();
  const url = new URL(req.url);
  const t = url.searchParams.get("tab") || "";
  const like = `%${(url.searchParams.get("q") || "").trim().toLowerCase()}%`;
  const rows = await sql`
    SELECT u.id, u.email, u.surname, u.initial, u.first_name, u.role, u.account_type, u.restricted_at, u.created_at,
      COALESCE((SELECT SUM(delta) FROM points_ledger WHERE user_id = u.id), 0)::int AS points,
      (SELECT COUNT(*) FROM posts WHERE author_id = u.id)::int AS posts
    FROM users u
    WHERE (${t} = '' OR (${t} = 'reviewer' AND u.role = 'reviewer') OR (${t} = 'admin' AND u.role IN ('admin','superadmin'))
           OR (${t} = 'restricted' AND u.restricted_at IS NOT NULL) OR (${t} = 'new' AND u.created_at > now() - interval '7 days'))
      AND (${like} = '%%' OR lower(u.email) LIKE ${like} OR lower(u.first_name) LIKE ${like} OR lower(COALESCE(u.surname,'')) LIKE ${like})
    ORDER BY u.id`;
  const head = ["ID", "Мэйл", "Овог", "Нэр", "Төрөл", "Эрх", "Оч", "Нийтлэл", "Хязгаарласан", "Бүртгүүлсэн"];
  const lines = [head.map(cell).join(",")].concat(
    rows.map((r) =>
      [r.id, r.email, r.surname, r.first_name, r.account_type, ROLE_LABELS[r.role], r.points, r.posts,
       r.restricted_at ? "тийм" : "", new Date(r.created_at).toISOString().slice(0, 10)].map(cell).join(",")
    )
  );
  await audit({ actorId: user.id, category: "role", action: `Хэрэглэгчийн жагсаалт татсан (${rows.length})`, targetType: "export" });
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="science-spark-users.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
