"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql, ensureSchema } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { ownImage, cleanPos } from "@/lib/images";
import { checkName, nameCase, POINTS, OPTIONS, COUNTRIES, SOCIALS, countWords } from "@/lib/profile";
import { celebrate } from "@/lib/celebrate";
import { saveReferral } from "@/lib/referral";

const back = (msg) => redirect(`/profile/edit?error=${encodeURIComponent(msg)}`);
const text = (fd, k, max = 120) => String(fd.get(k) || "").trim().slice(0, max) || null;
const pick = (fd, k, list) => (list.includes(fd.get(k)) ? fd.get(k) : null);

export async function saveProfile(formData) {
  const user = await getUser();
  if (!user) redirect("/login");
  await ensureSchema();
  const type = user.account_type || "person";

  // Овог, нэр: заавал. Хувь хүнд зөвхөн кирилл. Нийтэд «О.Нэр» болж харагдана.
  const surname = String(formData.get("surname") || "").trim();
  const first = String(formData.get("first_name") || "").trim();
  const e1 = checkName(surname, type);
  if (e1) back(`Овог: ${e1}`);
  const e2 = checkName(first, type);
  if (e2) back(`Нэр: ${e2}`);

  const prof = (await sql`SELECT agreed_at FROM profiles WHERE user_id = ${user.id}`)[0];
  const agreed = formData.get("agree") === "on";
  if (!prof?.agreed_at && !agreed) back("Хэрэглэгчийн гэрээг зөвшөөрнө үү");

  const about = text(formData, "about", 2000);
  if (countWords(about) > 100) back("Миний тухай: 100 үгээс хэтэрсэн байна");

  let birth = null;
  const y = Number(formData.get("by")), m = Number(formData.get("bm")), d = Number(formData.get("bd"));
  if (y && m && d) {
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCMonth() !== m - 1 || y < 1900 || dt > new Date()) back("Төрсөн огноо буруу байна");
    birth = dt.toISOString().slice(0, 10);
  }

  const orcid = text(formData, "orcid", 19);
  if (orcid && !/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(orcid)) back("ORCID iD 0000-0000-0000-0000 хэлбэртэй байна");

  const socials = {};
  for (const s of SOCIALS) {
    const v = text(formData, `s_${s.key}`, 300);
    if (v) {
      if (!/^https?:\/\/\S+$/i.test(v)) back("Сошиал холбоос https:// -ээр эхэлнэ");
      socials[s.key] = v;
    }
  }

  const p = {
    gender: pick(formData, "gender", OPTIONS.gender),
    birth_date: birth,
    about,
    birth_country: pick(formData, "birth_country", COUNTRIES) || text(formData, "birth_country"),
    birth_city: text(formData, "birth_city"),
    live_country: pick(formData, "live_country", COUNTRIES) || text(formData, "live_country"),
    live_city: text(formData, "live_city"),
    education: pick(formData, "education", OPTIONS.education),
    school: text(formData, "school", 160),
    orcid,
    profession: text(formData, "profession"),
    job: text(formData, "job", 160),
    origin_view: pick(formData, "origin_view", OPTIONS.origin_view),
    religion: pick(formData, "religion", OPTIONS.religion),
    belief: pick(formData, "belief", OPTIONS.belief),
    politics: pick(formData, "politics", OPTIONS.politics),
  };
  const emailPublic = formData.get("email_public") === "on";

  const avatarId = await ownImage(user.id, formData.get("avatar"));
  const coverId = await ownImage(user.id, formData.get("cover"));
  const avatarSrc = avatarId ? await ownImage(user.id, formData.get("avatar_src")) : null;
  const coverSrc = coverId ? await ownImage(user.id, formData.get("cover_src")) : null;
  const avatarPos = avatarSrc ? cleanPos(formData.get("avatar_pos")) : null;
  const coverPos = coverSrc ? cleanPos(formData.get("cover_pos")) : null;
  await sql`UPDATE users SET surname = ${nameCase(surname, type)}, initial = ${surname[0].toUpperCase()},
            first_name = ${nameCase(first, type)}, avatar_id = ${avatarId},
            avatar_src = ${avatarSrc}, avatar_pos = ${avatarPos} WHERE id = ${user.id}`;
  await sql`
    INSERT INTO profiles (user_id, email_public, gender, birth_date, about, birth_country, birth_city,
      live_country, live_city, education, school, orcid, profession, job, socials,
      origin_view, religion, belief, politics, agreed_at, updated_at)
    VALUES (${user.id}, ${emailPublic}, ${p.gender}, ${p.birth_date}, ${p.about}, ${p.birth_country}, ${p.birth_city},
      ${p.live_country}, ${p.live_city}, ${p.education}, ${p.school}, ${p.orcid}, ${p.profession}, ${p.job},
      ${JSON.stringify(socials)}::jsonb, ${p.origin_view}, ${p.religion}, ${p.belief}, ${p.politics},
      ${agreed ? new Date().toISOString() : null}, now())
    ON CONFLICT (user_id) DO UPDATE SET
      email_public = EXCLUDED.email_public, gender = EXCLUDED.gender, birth_date = EXCLUDED.birth_date,
      about = EXCLUDED.about, birth_country = EXCLUDED.birth_country, birth_city = EXCLUDED.birth_city,
      live_country = EXCLUDED.live_country, live_city = EXCLUDED.live_city, education = EXCLUDED.education,
      school = EXCLUDED.school, orcid = EXCLUDED.orcid, profession = EXCLUDED.profession, job = EXCLUDED.job,
      socials = EXCLUDED.socials, origin_view = EXCLUDED.origin_view, religion = EXCLUDED.religion,
      belief = EXCLUDED.belief, politics = EXCLUDED.politics,
      agreed_at = COALESCE(profiles.agreed_at, EXCLUDED.agreed_at), updated_at = now()`;
  await sql`UPDATE profiles SET cover_id = ${coverId}, cover_src = ${coverSrc}, cover_pos = ${coverPos} WHERE user_id = ${user.id}`;

  // Шинээр бөглөсөн талбар бүрд нэг удаа оч (очны дансанд бичигдэнэ)
  const filled = Object.keys(p).filter((k) => p[k]);
  if (Object.keys(socials).length) filled.push("socials");
  if (avatarId) filled.push("photo");
  if (coverId) filled.push("cover");
  const given = (await sql`SELECT reason FROM points_ledger WHERE user_id = ${user.id} AND reason LIKE 'profile:%'`)
    .map((r) => r.reason.slice(8));
  let gained = 0;
  for (const k of filled) {
    if (POINTS[k] && !given.includes(k)) {
      const r = await sql`INSERT INTO points_ledger (user_id, delta, reason) VALUES (${user.id}, ${POINTS[k]}, ${"profile:" + k})
                ON CONFLICT (user_id, reason) WHERE reason LIKE 'profile:%' DO NOTHING RETURNING delta`;
      if (r.length) gained += POINTS[k];
    }
  }

  // Шинэ профайл анх удаа үүсэхэд баярын цонх гарч, «Хаанаас сонссон бэ?» гэж асууна
  if (!prof?.agreed_at) {
    await celebrate(user, { kind: "Профайл", status: "published", href: `/u/${user.id}`, earned: gained ? [["Профайлаа бөглөсөн", gained]] : [] });
  }

  revalidatePath("/");
  redirect(`/u/${user.id}`);
}

// Баярын цонхноос: Science Spark-ийн тухай хэнээс сонссон (заавал биш). Эх сурвалж нь оч авна.
export async function answerReferral(kind, targetId) {
  const user = await getUser();
  if (!user) return { error: "Нэвтэрнэ үү" };
  await ensureSchema();
  return saveReferral(user, kind, targetId);
}

const replied = (uid, key, msg) => redirect(`/u/${uid}?tab=replied&${key}=${encodeURIComponent(msg)}`);

// Бичээч редакцын засвар, нэгтгэл эсвэл нуусан контентод гомдол гаргана. Логик алдааны хэсэгт «Гомдол» болж очно.
export async function fileComplaint(formData) {
  const user = await getUser();
  if (!user) redirect("/login");
  await ensureSchema();
  const postId = Number(formData.get("post_id"));
  const revId = Number(formData.get("revision_id")) || null;
  const body = String(formData.get("body") || "").trim().slice(0, 1000);
  if (!Number.isInteger(postId)) replied(user.id, "error", "Буруу хүсэлт");
  if (body.length < 10) replied(user.id, "error", "Гомдлоо дэлгэрэнгүй бичнэ үү");
  // Зөвхөн өөрийн (нэгтгэлээр нэмэгдсэн бичээчийг оруулаад) контентод
  const [p] = await sql`SELECT id FROM posts p WHERE id = ${postId}
    AND (author_id = ${user.id} OR EXISTS (SELECT 1 FROM post_credits c WHERE c.post_id = p.id AND c.user_id = ${user.id} AND c.role = 'author'))`;
  if (!p) replied(user.id, "error", "Энэ контентод гомдол гаргах боломжгүй");
  if (revId) {
    const [r] = await sql`SELECT 1 FROM post_revisions WHERE id = ${revId} AND post_id = ${postId} AND role IN ('editor', 'merge')`;
    if (!r) replied(user.id, "error", "Засвар олдсонгүй");
  }
  const ins = await sql`INSERT INTO logic_reports (post_id, user_id, body, type, revision_id)
                        VALUES (${postId}, ${user.id}, ${body}, 'complaint', ${revId})
                        ON CONFLICT DO NOTHING RETURNING id`;
  if (!ins.length) replied(user.id, "error", "Энэ контентод таны илгээсэн гомдол, мэдэгдэл хянагдаж байна");
  revalidatePath("/admin", "layout");
  replied(user.id, "ok", "Гомдлыг редакц руу илгээлээ. Шийдвэрлэмэгц мэдэгдэл очно");
}

// Хэрэглэгч авсан сануулгадаа хариу бичиж өөрийгөө хамгаална. Логик алдааны хэсэгт очно.
export async function answerWarning(formData) {
  const user = await getUser();
  if (!user) redirect("/login");
  await ensureSchema();
  const wid = Number(formData.get("warning_id"));
  const body = String(formData.get("body") || "").trim().slice(0, 1000);
  if (!Number.isInteger(wid)) replied(user.id, "error", "Буруу хүсэлт");
  if (body.length < 10) replied(user.id, "error", "Хариугаа дэлгэрэнгүй бичнэ үү");
  const [w] = await sql`SELECT id FROM user_warnings WHERE id = ${wid} AND user_id = ${user.id}`;
  if (!w) replied(user.id, "error", "Сануулга олдсонгүй");
  const ins = await sql`INSERT INTO logic_reports (user_id, body, type, warning_id)
                        VALUES (${user.id}, ${body}, 'defense', ${wid})
                        ON CONFLICT DO NOTHING RETURNING id`;
  if (!ins.length) replied(user.id, "error", "Энэ сануулгад бичсэн хариу тань хянагдаж байна");
  revalidatePath("/admin", "layout");
  replied(user.id, "ok", "Хариуг редакц руу илгээлээ. Шийдвэрлэмэгц мэдэгдэл очно");
}
