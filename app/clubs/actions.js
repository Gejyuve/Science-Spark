"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql, ensureSchema } from "@/lib/db";
import { getUser, needsName } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { ownImage, cleanPos } from "@/lib/images";
import { SOCIALS, countWords } from "@/lib/profile";
import { latinShare, LATIN_LIMIT, LATIN_MSG } from "@/lib/format";
import { resolveLocation, inMongolia } from "@/lib/geo";
import { cookies } from "next/headers";
import { AS_COOKIE } from "@/lib/acting";
import { leaderClub, leaderOrg } from "@/lib/tasks";
import { BOARD_MAX, JOIN_REWARD, REASON_WORDS, membershipOf, cooldownOf, rewardBalance, hadFirstReward, ymd } from "@/lib/clubs";

const txt = (fd, k, n) => String(fd.get(k) || "").trim().replace(/[ \t]+/g, " ").slice(0, n);
const withScheme = (v) => (!v || /^https?:\/\//i.test(v) ? v : "https://" + v.replace(/^\/+/, ""));
const KIND = { club: "Клуб", org: "Байгууллага" };

// Клуб, байгууллагын маягтыг шалгаж, хадгалах утгуудыг гаргана
async function readEntity(fd, user, kind, current = null) {
  const L = kind === "org" ? "Байгууллагын" : "Клубийн";
  const v = {};
  v.name = txt(fd, "name", 30);
  v.category = txt(fd, "category", 60);
  v.country = txt(fd, "country", 60) || "Монгол";
  v.city = txt(fd, "city", 60);
  v.field = kind === "org" ? txt(fd, "field", 120) || null : null;
  v.address = String(fd.get("address") || "").trim().slice(0, 1000) || null;
  v.about = String(fd.get("about") || "").trim().slice(0, 1500);
  v.rules = kind === "club" ? String(fd.get("rules") || "").trim().slice(0, 1000) || null : null;
  v.website = withScheme(txt(fd, "website", 200)) || null;
  v.email = txt(fd, "email", 120) || null;
  v.phone = txt(fd, "phone", 30) || null;
  if (v.name.length < 2) return { error: `${L} нэрээ бичнэ үү.` };
  if (!v.category) return { error: kind === "org" ? "Байгууллагын төрлөө сонгоно уу." : "Клубийн ангиллаа сонгоно уу." };
  if (!v.city) return { error: `${L} хот, аймгаа сонгоно уу.` };
  if (!v.about) return { error: `${kind === "org" ? "Байгууллагынхаа" : "Клубийнхаа"} тухай бичнэ үү.` };
  if (kind === "org") {
    if (countWords(v.about) > 100) return { error: "Байгууллагын тухай 100 үгээс хэтрэхгүй." };
    if (v.address && countWords(v.address) > 100) return { error: "Хаяг 100 үгээс хэтрэхгүй." };
  } else {
    if (v.about.length > 500) return { error: "Клубийн тухай 500 тэмдэгтээс хэтрэхгүй." };
    if (v.address && v.address.length > 150) return { error: "Хаяг 150 тэмдэгтээс хэтрэхгүй." };
  }
  // Латины хязгаар зөвхөн тайлбар бичвэрт (нэр, хаяг латин байж болно)
  if (latinShare(v.about) > LATIN_LIMIT) return { error: `«${kind === "org" ? "Байгууллагын" : "Клубийн"} тухай» хэсгийг кириллээр бичнэ үү.` };
  if (v.rules && latinShare(v.rules) > LATIN_LIMIT) return { error: "«Клубийн дүрэм» хэсгийг кириллээр бичнэ үү." };
  if (v.website && !/^https?:\/\/\S+\.\S+/.test(v.website)) return { error: "Вэбсайтын хаягаа зөв оруулна уу." };
  if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) return { error: "Имэйл хаяг буруу байна." };
  if (v.phone && !/^\+?[\d\s-]{6,20}$/.test(v.phone)) return { error: "Утасны дугаараа зөв бичнэ үү." };
  const y = Number(fd.get("fy")), m = Number(fd.get("fm")), d = Number(fd.get("fd"));
  v.founded = null;
  if (y || m || d) {
    if (!(y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return { error: "Байгуулагдсан он, сар, өдрөө бүрэн сонгоно уу." };
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCDate() !== d) return { error: "Байгуулагдсан огноо буруу байна." };
    if (dt > new Date()) return { error: "Байгуулагдсан огноо ирээдүйд байж болохгүй." };
    v.founded = dt.toISOString().slice(0, 10);
  }
  // Байршил: клубт заавал, байгууллагад заавал биш
  const locRaw = txt(fd, "location", 600);
  v.lat = current?.lat ?? null; v.lng = current?.lng ?? null;
  if (locRaw) {
    const loc = await resolveLocation(locRaw);
    if (!loc) return { error: "Байршлыг уншиж чадсангүй. Координатыг «47.9184, 106.9177» хэлбэрээр эсвэл Google Maps-ийн холбоосыг бүтнээр нь оруулна уу." };
    if (v.country === "Монгол" && !inMongolia(loc)) return { error: "Оруулсан байршил Монгол Улсын нутагт биш байна. Координатаа шалгана уу." };
    v.lat = loc.lat; v.lng = loc.lng;
  } else if (kind === "club") return { error: "Клубийн байршлыг (координат эсвэл Google Maps холбоос) оруулна уу." };
  else { v.lat = null; v.lng = null; }

  const rawLogo = fd.get("logo");
  v.logo = String(rawLogo) === String(current?.logo_id || "") && current ? current.logo_id : await ownImage(user.id, rawLogo);
  if (!v.logo) return { error: `${L} лого оруулна уу.` };
  const rawCover = fd.get("cover");
  v.cover = current && String(rawCover) === String(current.cover_id || "") ? current.cover_id : await ownImage(user.id, rawCover);
  v.coverSrc = v.cover ? (current && String(fd.get("cover_src")) === String(current.cover_src || "") ? current.cover_src : await ownImage(user.id, fd.get("cover_src"))) : null;
  v.coverPos = v.cover ? cleanPos(fd.get("cover_pos")) : null;
  v.socials = {};
  for (const s of SOCIALS) {
    const x = withScheme(txt(fd, `s_${s.key}`, 300));
    if (!x) continue;
    if (!/^https?:\/\/\S+\.\S+/.test(x)) return { error: "Сошиал хаягийн холбоосоо зөв оруулна уу." };
    v.socials[s.key] = x;
  }
  const dup = await sql`SELECT id FROM clubs WHERE lower(name) = lower(${v.name}) AND id <> ${current?.id || 0}`;
  if (dup.length) return { error: "Ийм нэртэй клуб эсвэл байгууллага аль хэдийн бүртгэлтэй байна." };
  return { v };
}

async function guard() {
  const user = await getUser();
  if (!user) redirect("/login");
  if (needsName(user)) redirect("/profile/edit");
  await ensureSchema();
  return user;
}

// Удирдах зөвлөлийн урилга илгээнэ
async function inviteBoard(clubId, name, ids, user) {
  if (!ids.length) return;
  const ok = await sql`SELECT id FROM users WHERE id = ANY(${ids}) AND restricted_at IS NULL AND first_name <> ''`;
  for (const { id: uid } of ok) {
    const ins = await sql`INSERT INTO club_invites (club_id, user_id, role) VALUES (${clubId}, ${uid}, 'board') ON CONFLICT DO NOTHING RETURNING 1`;
    if (ins.length) await notify({ userId: uid, kind: "club_invite", actorId: user.id, note: name, clubId });
  }
}
const idList = (fd, k) => [...new Set(String(fd.get(k) || "").split(",").map(Number).filter((x) => Number.isInteger(x) && x > 0))];

// Клуб бүртгүүлэх (Figma: Клубээр бүртгүүлэх). Удирдагч нь бүртгүүлж буй хувь хүн.
export async function createClub(prev, fd) {
  const user = await guard();
  if (user.restricted_at) return { error: "Таны эрх хязгаарлагдсан тул клуб бүртгүүлэх боломжгүй." };
  const mine = await membershipOf(user.id);
  if (mine) return { error: `Та «${mine.name}» клубийн гишүүн байна. Шинэ клуб бүртгүүлэхийн тулд эхлээд тэр клубээсээ гарна уу.` };
  if (!fd.get("agree")) return { error: "Клубийн бүртгэлийн нөхцөлийг зөвшөөрнө үү." };
  const r = await readEntity(fd, user, "club");
  if (r.error) return r;
  const v = r.v;
  let id;
  try {
    const [c] = await sql`
      INSERT INTO clubs (kind, name, logo_id, cover_id, cover_src, cover_pos, category, founded, country, city, address, lat, lng,
        about, rules, website, email, phone, socials, leader_id)
      VALUES ('club', ${v.name}, ${v.logo}, ${v.cover}, ${v.coverSrc}, ${v.coverPos}, ${v.category}, ${v.founded}, ${v.country}, ${v.city}, ${v.address},
        ${v.lat}, ${v.lng}, ${v.about}, ${v.rules}, ${v.website}, ${v.email}, ${v.phone}, ${JSON.stringify(v.socials)}::jsonb, ${user.id})
      RETURNING id`;
    id = c.id;
  } catch (e) {
    return { error: "Бүртгэхэд алдаа гарлаа. Дахин оролдоно уу." };
  }
  await sql`DELETE FROM club_requests WHERE user_id = ${user.id}`;
  await sql`INSERT INTO club_members (user_id, club_id, role) VALUES (${user.id}, ${id}, 'leader') ON CONFLICT (user_id) DO NOTHING`;
  if (!(await hadFirstReward(user.id))) await sql`INSERT INTO points_ledger (user_id, delta, reason) VALUES (${user.id}, ${JOIN_REWARD}, 'club:first')`;
  await inviteBoard(id, v.name, idList(fd, "board").filter((x) => x !== user.id).slice(0, BOARD_MAX), user);
  revalidatePath("/", "layout");
  redirect(`/club/${id}`);
}

// Байгууллага бүртгүүлэх (Figma: Байгууллагаар бүртгүүлэх). Бүртгүүлсэн хүн админ нь болно.
export async function createOrg(prev, fd) {
  const user = await guard();
  if (user.restricted_at) return { error: "Таны эрх хязгаарлагдсан тул байгууллага бүртгүүлэх боломжгүй." };
  if (!fd.get("agree")) return { error: "Байгууллагын бүртгэлийн нөхцөлийг зөвшөөрнө үү." };
  const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM clubs WHERE kind = 'org' AND leader_id = ${user.id}`;
  if (n >= 3) return { error: "Нэг хүн 3-аас олон байгууллага бүртгүүлэх боломжгүй." };
  const r = await readEntity(fd, user, "org");
  if (r.error) return r;
  const v = r.v;
  let id;
  try {
    const [c] = await sql`
      INSERT INTO clubs (kind, name, logo_id, cover_id, cover_src, cover_pos, category, field, founded, country, city, address, lat, lng,
        about, website, email, phone, socials, leader_id)
      VALUES ('org', ${v.name}, ${v.logo}, ${v.cover}, ${v.coverSrc}, ${v.coverPos}, ${v.category}, ${v.field}, ${v.founded}, ${v.country}, ${v.city}, ${v.address},
        ${v.lat}, ${v.lng}, ${v.about}, ${v.website}, ${v.email}, ${v.phone}, ${JSON.stringify(v.socials)}::jsonb, ${user.id})
      RETURNING id`;
    id = c.id;
  } catch (e) {
    return { error: "Бүртгэхэд алдаа гарлаа. Дахин оролдоно уу." };
  }
  revalidatePath("/", "layout");
  redirect(`/org/${id}`);
}

// Засах (зөвхөн удирдагч, админ)
export async function updateEntity(prev, fd) {
  const user = await guard();
  const id = Number(fd.get("id"));
  const [cur] = await sql`SELECT * FROM clubs WHERE id = ${id} AND status = 'active'`;
  if (!cur || cur.leader_id !== user.id) return { error: "Зөвхөн удирдагч засах эрхтэй." };
  const r = await readEntity(fd, user, cur.kind, cur);
  if (r.error) return r;
  const v = r.v;
  await sql`UPDATE clubs SET name = ${v.name}, logo_id = ${v.logo}, cover_id = ${v.cover}, cover_src = ${v.coverSrc}, cover_pos = ${v.coverPos},
      category = ${v.category}, field = ${v.field}, founded = ${v.founded}, country = ${v.country}, city = ${v.city}, address = ${v.address},
      lat = ${v.lat}, lng = ${v.lng}, about = ${v.about}, rules = ${v.rules}, website = ${v.website}, email = ${v.email}, phone = ${v.phone},
      socials = ${JSON.stringify(v.socials)}::jsonb, updated_at = now()
    WHERE id = ${id}`;
  if (cur.kind === "club") {
    // Зөвлөл: хассан гишүүд энгийн гишүүн болно, шинээр нэмсэнд урилга очно
    const keep = idList(fd, "board_keep");
    await sql`UPDATE club_members SET role = 'member' WHERE club_id = ${id} AND role = 'board' AND NOT (user_id = ANY(${keep}))`;
    await sql`DELETE FROM club_invites WHERE club_id = ${id} AND NOT (user_id = ANY(${keep}))`;
    const [{ n }] = await sql`SELECT (SELECT COUNT(*) FROM club_members WHERE club_id = ${id} AND role = 'board') + (SELECT COUNT(*) FROM club_invites WHERE club_id = ${id}) AS n`;
    await inviteBoard(id, v.name, idList(fd, "board").filter((x) => x !== user.id && !keep.includes(x)).slice(0, Math.max(0, BOARD_MAX - Number(n))), user);
  }
  revalidatePath("/", "layout");
  redirect(`/${cur.kind === "org" ? "org" : "club"}/${id}`);
}

// Баруун цэсний товч: өөрийн хаяг, удирддаг клуб эсвэл байгууллагын хаяг руу шилжинэ
export async function switchAs(fd) {
  const user = await getUser();
  if (!user) redirect("/login");
  const to = String(fd.get("to") || "");
  const jar = await cookies();
  const ok = (to === "club" && (await leaderClub(user.id))) || (to === "org" && (await leaderOrg(user.id)));
  if (ok) jar.set(AS_COOKIE, to, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  else jar.delete(AS_COOKIE);
  revalidatePath("/", "layout");
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

// Нэгдэх боломжтой эсэх (хүсэлт илгээх, зөвшөөрөх үед хоёуланд нь шалгана)
async function eligibility(u, clubId) {
  if (u.restricted_at) return { error: "Эрх нь хязгаарлагдсан хэрэглэгч клубт нэгдэх боломжгүй." };
  const mine = await membershipOf(u.id);
  if (mine?.club_id === clubId) return { error: "Аль хэдийн энэ клубийн гишүүн байна.", member: true };
  if (mine?.role === "leader") return { error: `«${mine.name}» клубийн удирдагч өөр клубт шилжих боломжгүй.` };
  const cd = await cooldownOf(u.id);
  if (cd) return { error: `${ymd(cd.since)}-нд ${cd.from ? `«${cd.from}» клубээс ` : ""}гарсан тул ${ymd(cd.until)} хүртэл өөр клубт нэгдэх боломжгүй.`, cooldown: cd };
  return { mine };
}

// Гишүүнчлэл үүсгэнэ: өөр клубт байвал шилжүүлж, анхны урамшууллыг хасна
async function doJoin(userId, club, role) {
  const mine = await membershipOf(userId);
  if (mine) {
    await sql`DELETE FROM club_members WHERE user_id = ${userId}`;
    await sql`INSERT INTO club_moves (user_id, from_club, from_name, to_club) VALUES (${userId}, ${mine.club_id}, ${mine.name}, ${club.id})`;
    // Анхны клубийн урамшууллын үлдэгдлийг (хуучин дүрмээр 600 байж болно) бүтнээр нь хасна
    const bal = await rewardBalance(userId);
    if (bal > 0) await sql`INSERT INTO points_ledger (user_id, delta, reason) VALUES (${userId}, ${-bal}, 'club:switch')`;
  } else if (!(await hadFirstReward(userId))) {
    await sql`INSERT INTO points_ledger (user_id, delta, reason) VALUES (${userId}, ${JOIN_REWARD}, 'club:first')`;
  }
  await sql`DELETE FROM club_requests WHERE user_id = ${userId}`;
  await sql`DELETE FROM club_invites WHERE user_id = ${userId} AND club_id = ${club.id}`;
  await sql`INSERT INTO club_members (user_id, club_id, role) VALUES (${userId}, ${club.id}, ${role})
            ON CONFLICT (user_id) DO UPDATE SET club_id = EXCLUDED.club_id, role = EXCLUDED.role, joined_at = now()`;
}

// Нэгдэх хүсэлт илгээх (Figma: Клубт нэгдэх)
export async function requestJoin(prev, fd) {
  const user = await guard();
  const clubId = Number(fd.get("club_id"));
  const [c] = await sql`SELECT id, name, leader_id FROM clubs WHERE id = ${clubId} AND kind = 'club' AND status = 'active'`;
  if (!c) return { error: "Клуб олдсонгүй." };
  const el = await eligibility(user, clubId);
  if (el.error) return { error: el.error };
  if (!fd.get("agree")) return { error: "Клубийн дүрмийг уншиж, зөвшөөрнө үү." };
  const reason = String(fd.get("reason") || "").trim().slice(0, 1000);
  if (countWords(reason) > 100) return { error: "Нэгдэх шалтгаан 100 үгээс хэтрэхгүй." };
  if (reason && latinShare(reason) > LATIN_LIMIT) return { error: "«Нэгдэх шалтгаан»-аа кириллээр бичнэ үү." };
  await sql`INSERT INTO club_requests (user_id, club_id, reason) VALUES (${user.id}, ${clubId}, ${reason || null})
            ON CONFLICT (user_id) DO UPDATE SET club_id = EXCLUDED.club_id, reason = EXCLUDED.reason, created_at = now()`;
  if (c.leader_id) await notify({ userId: c.leader_id, kind: "club_request", actorId: user.id, note: c.name, clubId });
  revalidatePath("/", "layout");
  redirect(`/club/${clubId}?join=sent`);
}

export async function cancelRequest(fd) {
  const user = await guard();
  const clubId = Number(fd.get("club_id"));
  await sql`DELETE FROM club_requests WHERE user_id = ${user.id}`;
  revalidatePath("/", "layout");
  redirect(`/club/${clubId}`);
}

// Удирдагч хүсэлтийг шийднэ: ok / no / all (бүгдийг зөвшөөрөх)
export async function decideRequests(fd) {
  const user = await guard();
  const clubId = Number(fd.get("club_id"));
  const [c] = await sql`SELECT id, name, leader_id FROM clubs WHERE id = ${clubId}`;
  if (!c || c.leader_id !== user.id) redirect(`/club/${clubId}`);
  const decision = String(fd.get("decision"));
  const target = Number(fd.get("user_id"));
  const reqs = decision === "all"
    ? await sql`SELECT user_id FROM club_requests WHERE club_id = ${clubId} ORDER BY created_at`
    : await sql`SELECT user_id FROM club_requests WHERE club_id = ${clubId} AND user_id = ${target}`;
  let skipped = 0;
  for (const { user_id } of reqs) {
    if (decision === "no") {
      await sql`DELETE FROM club_requests WHERE user_id = ${user_id} AND club_id = ${clubId}`;
      await notify({ userId: user_id, kind: "club_no", actorId: user.id, note: c.name, clubId });
      continue;
    }
    const [u] = await sql`SELECT id, restricted_at FROM users WHERE id = ${user_id}`;
    const el = u ? await eligibility(u, clubId) : { error: "x" };
    if (el.error && !el.member) { skipped++; continue; }
    if (!el.member) await doJoin(user_id, c, "member");
    await sql`DELETE FROM club_requests WHERE user_id = ${user_id}`;
    await notify({ userId: user_id, kind: "club_ok", actorId: user.id, note: c.name, clubId });
  }
  revalidatePath("/", "layout");
  redirect(`/club/${clubId}?tab=requests${skipped ? `&skipped=${skipped}` : ""}`);
}

// Зөвлөлийн урилгыг хүлээн авах (хүсэлтгүйгээр шууд нэгдэнэ)
export async function acceptInvite(fd) {
  const user = await guard();
  const clubId = Number(fd.get("club_id"));
  const [inv] = await sql`SELECT role FROM club_invites WHERE club_id = ${clubId} AND user_id = ${user.id}`;
  const [c] = await sql`SELECT id, name, leader_id FROM clubs WHERE id = ${clubId} AND status = 'active'`;
  if (!inv || !c) redirect(`/club/${clubId}`);
  const el = await eligibility(user, clubId);
  if (el.member) {
    await sql`UPDATE club_members SET role = 'board' WHERE user_id = ${user.id} AND club_id = ${clubId} AND role = 'member'`;
    await sql`DELETE FROM club_invites WHERE club_id = ${clubId} AND user_id = ${user.id}`;
  } else if (el.error) {
    redirect(`/club/${clubId}?err=${encodeURIComponent(el.error)}`);
  } else {
    if (el.mine && fd.get("switch") !== "1") redirect(`/club/${clubId}?join=inviteswitch`);
    await doJoin(user.id, c, "board");
  }
  if (c.leader_id) await notify({ userId: c.leader_id, kind: "club_join", actorId: user.id, note: c.name, clubId });
  revalidatePath("/", "layout");
  redirect(`/club/${clubId}?join=ok`);
}

export async function declineInvite(fd) {
  const user = await guard();
  const club = Number(fd.get("club_id"));
  await sql`DELETE FROM club_invites WHERE club_id = ${club} AND user_id = ${user.id}`;
  revalidatePath("/", "layout");
  redirect(`/club/${club}`);
}

export async function leaveClub(fd) {
  const user = await guard();
  const club = Number(fd.get("club_id"));
  const mine = await membershipOf(user.id);
  if (!mine || mine.club_id !== club) redirect(`/club/${club}`);
  if (mine.role === "leader") redirect(`/club/${club}?join=leaderleave`);
  if (fd.get("confirm") !== "1") redirect(`/club/${club}?join=leave`);
  await sql`DELETE FROM club_members WHERE user_id = ${user.id} AND club_id = ${club}`;
  await sql`INSERT INTO club_moves (user_id, from_club, from_name) VALUES (${user.id}, ${club}, ${mine.name})`;
  const [c] = await sql`SELECT leader_id FROM clubs WHERE id = ${club}`;
  if (c?.leader_id) await notify({ userId: c.leader_id, kind: "club_left", actorId: user.id, note: mine.name, clubId: club });
  revalidatePath("/", "layout");
  redirect(`/club/${club}`);
}

// Удирдагч гишүүнийг хасах (хорио тавихгүй)
export async function removeMember(fd) {
  const user = await guard();
  const club = Number(fd.get("club_id"));
  const target = Number(fd.get("user_id"));
  const [c] = await sql`SELECT leader_id, name FROM clubs WHERE id = ${club}`;
  if (!c || c.leader_id !== user.id || target === user.id) redirect(`/club/${club}`);
  const gone = await sql`DELETE FROM club_members WHERE user_id = ${target} AND club_id = ${club} AND role <> 'leader' RETURNING 1`;
  if (gone.length) await notify({ userId: target, kind: "club_removed", actorId: user.id, note: c.name, clubId: club });
  revalidatePath("/", "layout");
  redirect(`/club/${club}?tab=members`);
}
