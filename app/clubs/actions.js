"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql, ensureSchema } from "@/lib/db";
import { getUser, needsName } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { ownImage, cleanPos } from "@/lib/images";
import { SOCIALS } from "@/lib/profile";
import { latinShare, LATIN_LIMIT, LATIN_MSG } from "@/lib/format";
import { resolveLocation, inMongolia } from "@/lib/geo";
import { BOARD_MAX, JOIN_REWARD, membershipOf } from "@/lib/clubs";

const txt = (fd, k, n) => String(fd.get(k) || "").trim().replace(/[ \t]+/g, " ").slice(0, n);
const withScheme = (v) => (!v || /^https?:\/\//i.test(v) ? v : "https://" + v.replace(/^\/+/, ""));

// Анхны клубт нэгдэхэд 1 л удаа оч олгоно
async function firstClubReward(userId) {
  const had = await sql`SELECT 1 FROM points_ledger WHERE user_id = ${userId} AND reason = 'club:first'`;
  if (!had.length) await sql`INSERT INTO points_ledger (user_id, delta, reason) VALUES (${userId}, ${JOIN_REWARD}, 'club:first')`;
}

// Клуб бүртгүүлэх (Figma: Клубээр бүртгүүлэх). Удирдагч нь бүртгүүлж буй хувь хүн.
export async function createClub(prev, fd) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (needsName(user)) redirect("/profile/edit");
  if (user.restricted_at) return { error: "Таны эрх хязгаарлагдсан тул клуб бүртгүүлэх боломжгүй." };
  await ensureSchema();
  const mine = await membershipOf(user.id);
  if (mine) return { error: `Та «${mine.name}» клубын гишүүн байна. Шинэ клуб бүртгүүлэхийн тулд эхлээд тэр клубээсээ гарна уу.` };

  const name = txt(fd, "name", 30);
  const category = txt(fd, "category", 60);
  const country = txt(fd, "country", 60) || "Монгол";
  const city = txt(fd, "city", 60);
  const address = txt(fd, "address", 150);
  const about = String(fd.get("about") || "").trim().slice(0, 500);
  const rules = String(fd.get("rules") || "").trim().slice(0, 1000);
  const website = withScheme(txt(fd, "website", 200));
  const email = txt(fd, "email", 120);
  const phone = txt(fd, "phone", 30);
  const y = Number(fd.get("fy")), m = Number(fd.get("fm")), d = Number(fd.get("fd"));

  if (name.length < 2) return { error: "Клубын нэрээ бичнэ үү." };
  if (!category) return { error: "Клубын ангиллаа сонгоно уу." };
  if (!city) return { error: "Клубын хот, аймгаа сонгоно уу." };
  if (!about) return { error: "Клубынхээ тухай бичнэ үү." };
  for (const v of [about, rules, address]) if (v && latinShare(v) > LATIN_LIMIT) return { error: LATIN_MSG };
  if (website && !/^https?:\/\/\S+\.\S+/.test(website)) return { error: "Вэбсайтын хаягаа зөв оруулна уу." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Клубын имэйл хаяг буруу байна." };
  if (phone && !/^\+?[\d\s-]{6,20}$/.test(phone)) return { error: "Утасны дугаараа зөв бичнэ үү." };
  let founded = null;
  if (y || m || d) {
    if (!(y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return { error: "Байгуулагдсан он, сар, өдрөө бүрэн сонгоно уу." };
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCDate() !== d) return { error: "Байгуулагдсан огноо буруу байна." };
    if (dt > new Date()) return { error: "Байгуулагдсан огноо ирээдүйд байж болохгүй." };
    founded = dt.toISOString().slice(0, 10);
  }

  // Байршил: координат эсвэл Google Maps холбоос
  const locRaw = txt(fd, "location", 600);
  if (!locRaw) return { error: "Клубын байршлыг (координат эсвэл Google Maps холбоос) оруулна уу." };
  const loc = await resolveLocation(locRaw);
  if (!loc) return { error: "Байршлыг уншиж чадсангүй. Координатыг «47.9184, 106.9177» хэлбэрээр эсвэл Google Maps-ийн холбоосыг бүтнээр нь оруулна уу." };
  if (country === "Монгол" && !inMongolia(loc)) return { error: "Оруулсан байршил Монгол Улсын нутагт биш байна. Координатаа шалгана уу." };

  const logo = await ownImage(user.id, fd.get("logo"));
  if (!logo) return { error: "Клубын лого оруулна уу." };
  const cover = await ownImage(user.id, fd.get("cover"));
  const coverSrc = cover ? await ownImage(user.id, fd.get("cover_src")) : null;
  const coverPos = cover ? cleanPos(fd.get("cover_pos")) : null;

  const socials = {};
  for (const s of SOCIALS) {
    const v = withScheme(txt(fd, `s_${s.key}`, 300));
    if (!v) continue;
    if (!/^https?:\/\/\S+\.\S+/.test(v)) return { error: "Сошиал хаягийн холбоосоо зөв оруулна уу." };
    socials[s.key] = v;
  }
  if (!fd.get("agree")) return { error: "Клубын бүртгэлийн нөхцөлийг зөвшөөрнө үү." };

  const board = [...new Set(String(fd.get("board") || "").split(",").map(Number).filter((x) => Number.isInteger(x) && x > 0 && x !== user.id))].slice(0, BOARD_MAX);

  const dup = await sql`SELECT id FROM clubs WHERE lower(name) = lower(${name})`;
  if (dup.length) return { error: "Ийм нэртэй клуб аль хэдийн бүртгэлтэй байна." };

  let id;
  try {
    const [c] = await sql`
      INSERT INTO clubs (name, logo_id, cover_id, cover_src, cover_pos, category, founded, country, city, address, lat, lng,
        about, rules, website, email, phone, socials, leader_id)
      VALUES (${name}, ${logo}, ${cover}, ${coverSrc}, ${coverPos}, ${category}, ${founded}, ${country}, ${city}, ${address || null},
        ${loc.lat}, ${loc.lng}, ${about}, ${rules || null}, ${website || null}, ${email || null}, ${phone || null},
        ${JSON.stringify(socials)}::jsonb, ${user.id})
      RETURNING id`;
    id = c.id;
  } catch (e) {
    return { error: "Клуб бүртгэхэд алдаа гарлаа. Дахин оролдоно уу." };
  }
  await sql`INSERT INTO club_members (user_id, club_id, role) VALUES (${user.id}, ${id}, 'leader') ON CONFLICT (user_id) DO NOTHING`;
  await firstClubReward(user.id);
  if (board.length) {
    const ok = await sql`SELECT id FROM users WHERE id = ANY(${board}) AND restricted_at IS NULL AND first_name <> ''`;
    for (const { id: uid } of ok) {
      await sql`INSERT INTO club_invites (club_id, user_id, role) VALUES (${id}, ${uid}, 'board') ON CONFLICT DO NOTHING`;
      await notify({ userId: uid, kind: "club_invite", actorId: user.id, note: name, clubId: id });
    }
  }
  revalidatePath("/", "layout");
  redirect(`/club/${id}`);
}

export async function toggleClubFollow(fd) {
  const user = await getUser();
  if (!user) redirect("/login");
  const club = Number(fd.get("club_id"));
  if (!Number.isInteger(club)) return;
  await ensureSchema();
  const del = await sql`DELETE FROM club_follows WHERE user_id = ${user.id} AND club_id = ${club} RETURNING 1`;
  if (!del.length) await sql`INSERT INTO club_follows (user_id, club_id) SELECT ${user.id}, id FROM clubs WHERE id = ${club} ON CONFLICT DO NOTHING`;
  revalidatePath("/", "layout");
}

// Клубт нэгдэх. Өөр клубт байгаа бол «шилжих» баталгаа шаардана.
export async function joinClub(fd) {
  const user = await getUser();
  const club = Number(fd.get("club_id"));
  if (!user) redirect(`/login`);
  if (needsName(user)) redirect("/profile/edit");
  if (!Number.isInteger(club)) redirect("/clubs");
  await ensureSchema();
  if (user.restricted_at) redirect(`/club/${club}?join=blocked`);
  const [c] = await sql`SELECT id, name, leader_id FROM clubs WHERE id = ${club} AND status = 'active'`;
  if (!c) redirect("/clubs");
  const mine = await membershipOf(user.id);
  if (mine && mine.club_id === club) redirect(`/club/${club}`);
  if (mine) {
    if (mine.role === "leader") redirect(`/club/${club}?join=leader`);
    if (fd.get("switch") !== "1") redirect(`/club/${club}?join=switch`);
    await sql`DELETE FROM club_members WHERE user_id = ${user.id}`;
  }
  const inv = await sql`DELETE FROM club_invites WHERE club_id = ${club} AND user_id = ${user.id} RETURNING role`;
  await sql`INSERT INTO club_members (user_id, club_id, role) VALUES (${user.id}, ${club}, ${inv[0]?.role || "member"})`;
  await firstClubReward(user.id);
  if (c.leader_id) await notify({ userId: c.leader_id, kind: "club_join", actorId: user.id, note: c.name, clubId: club });
  revalidatePath("/", "layout");
  redirect(`/club/${club}?join=ok`);
}

export async function leaveClub(fd) {
  const user = await getUser();
  if (!user) redirect("/login");
  const club = Number(fd.get("club_id"));
  await ensureSchema();
  const mine = await membershipOf(user.id);
  if (!mine || mine.club_id !== club) redirect(`/club/${club}`);
  if (mine.role === "leader") redirect(`/club/${club}?join=leaderleave`);
  await sql`DELETE FROM club_members WHERE user_id = ${user.id} AND club_id = ${club}`;
  revalidatePath("/", "layout");
  redirect(`/club/${club}`);
}

export async function declineInvite(fd) {
  const user = await getUser();
  if (!user) redirect("/login");
  const club = Number(fd.get("club_id"));
  await sql`DELETE FROM club_invites WHERE club_id = ${club} AND user_id = ${user.id}`;
  revalidatePath("/", "layout");
  redirect(`/club/${club}`);
}
