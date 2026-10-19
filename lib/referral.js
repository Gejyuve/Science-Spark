import { sql } from "./db";
import { notify } from "./notify";
import { REFERRAL_REWARD } from "./referral-shared";

export { REFERRAL_REWARD };

// Шинэ хэрэглэгч Science Spark-ийн тухай хэнээс (хүн, байгууллага, клуб) сонссоноо профайл
// үүсгэсний дараах баярын цонхонд (app/components/Celebrate.js) заавал биш хариулна.
// Сонгосон эх сурвалж нэг удаа оч авна: хүнд points_ledger, клуб/байгууллагад club_points.
export const REFERRAL_DAYS = 7; // бүртгүүлснээс хойш хэдэн хоногийн дотор хариулж болох
export const REFERRAL_DAILY_CAP = 10; // нэг эх сурвалж өдөрт хамгийн ихдээ хэдэн удаа оч авах
export const REFERRAL_KINDS = { person: "Хувь хүн", org: "Байгууллага", club: "Клуб" };

const likeOf = (q) => `%${q.replace(/[%_\\]/g, (m) => "\\" + m)}%`;

// Нэрээр хайна. Өөрийгөө, хязгаарлагдсан болон нэргүй хэрэглэгчийг харуулахгүй.
export async function searchSources(userId, kind, q) {
  q = String(q || "").trim().slice(0, 40);
  if (!REFERRAL_KINDS[kind] || q.length < 2) return [];
  const like = likeOf(q);
  if (kind === "person") {
    const rows = await sql`
      SELECT u.id, u.initial, u.first_name, u.surname, u.avatar_id AS avatar, p.job
      FROM users u LEFT JOIN profiles p ON p.user_id = u.id
      WHERE u.id <> ${userId} AND u.restricted_at IS NULL AND u.first_name <> '' AND u.account_type = 'person'
        AND (u.first_name ILIKE ${like} OR u.surname ILIKE ${like} OR (u.surname || ' ' || u.first_name) ILIKE ${like} OR (u.initial || '.' || u.first_name) ILIKE ${like})
      ORDER BY u.first_name LIMIT 8`;
    return rows.map((r) => ({ id: r.id, name: `${r.initial}.${r.first_name}`, img: r.avatar, sub: r.job || "" }));
  }
  const rows = await sql`
    SELECT id, name, logo_id AS logo, city FROM clubs
    WHERE kind = ${kind} AND status = 'active' AND name ILIKE ${like}
    ORDER BY name LIMIT 8`;
  return rows.map((r) => ({ id: r.id, name: r.name, img: r.logo, sub: r.city || "" }));
}

// Хариултыг хадгалж, эх сурвалжид оч олгоно. { ok, name, reward } эсвэл { error } буцаана.
export async function saveReferral(user, kind, targetId) {
  const id = Number(targetId);
  if (!REFERRAL_KINDS[kind] || !Number.isInteger(id)) return { error: "Буруу хүсэлт" };
  if (user.restricted_at) return { error: "Энэ үйлдлийг хийх боломжгүй" };
  if (Date.now() - new Date(user.created_at).getTime() > REFERRAL_DAYS * 86400000) return { error: "Энэ асуултад зөвхөн шинээр бүртгүүлэхдээ хариулна" };

  let name, club = null;
  if (kind === "person") {
    if (id === user.id) return { error: "Өөрийгөө сонгох боломжгүй" };
    const [t] = await sql`SELECT id, initial, first_name, created_at FROM users
                          WHERE id = ${id} AND restricted_at IS NULL AND first_name <> '' AND account_type = 'person'`;
    // Өөрөөсөө хойш бүртгүүлсэн хүн таныг урьсан байх боломжгүй
    if (!t || new Date(t.created_at) >= new Date(user.created_at)) return { error: "Хэрэглэгч олдсонгүй" };
    name = `${t.initial}.${t.first_name}`;
  } else {
    [club] = await sql`SELECT id, name, leader_id FROM clubs WHERE id = ${id} AND kind = ${kind} AND status = 'active'`;
    if (!club) return { error: kind === "club" ? "Клуб олдсонгүй" : "Байгууллага олдсонгүй" };
    if (club.leader_id === user.id) return { error: "Өөрийн бүртгүүлсэн байгууллагыг сонгох боломжгүй" };
    name = club.name;
  }

  // Нэг эх сурвалж өдөрт хэт олон удаа оч авбал (хуурамч бүртгэл) зөвхөн хариултыг бүртгэнэ
  const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM referrals
                            WHERE kind = ${kind} AND target_id = ${id} AND reward > 0 AND created_at > now() - interval '1 day'`;
  const reward = n < REFERRAL_DAILY_CAP ? REFERRAL_REWARD : 0;
  const ins = await sql`INSERT INTO referrals (user_id, kind, target_id, reward) VALUES (${user.id}, ${kind}, ${id}, ${reward})
                        ON CONFLICT (user_id) DO NOTHING RETURNING user_id`;
  if (!ins.length) return { error: "Та энэ асуултад аль хэдийн хариулсан байна" };

  if (reward) {
    if (kind === "person") {
      await sql`INSERT INTO points_ledger (user_id, delta, reason) VALUES (${id}, ${reward}, ${"referral:" + user.id})`;
      await notify({ userId: id, kind: "referral", actorId: user.id });
    } else {
      await sql`INSERT INTO club_points (club_id, delta, reason) VALUES (${id}, ${reward}, ${"referral:" + user.id})`;
      if (club.leader_id) await notify({ userId: club.leader_id, kind: "referral_club", actorId: user.id, note: club.name });
    }
  }
  return { ok: true, name, reward };
}
