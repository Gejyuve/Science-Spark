"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql, ensureSchema } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { audit } from "@/lib/admin";
import { merchantOpenFor, loadMerchant, logStatus, notifySupers } from "@/lib/merchant";
import {
  MERCHANT_TYPES, EDITABLE, PRODUCT_TYPES, BANKS, DOC_KINDS, INDIVIDUAL_FIELDS, BUSINESS_FIELDS, normalize, check,
} from "@/lib/merchant-shared";

const back = (key, msg) => redirect(`/merchant?${key}=${encodeURIComponent(msg)}`);
// Маркетаас ирсэн бол бүтээгдэхүүний засварын хуудас руу буцаана
const nextOf = (f) => { const n = String(f.get("next") || ""); return /^\/market\/\d+\/edit$/.test(n) ? n : null; };

async function me() {
  const user = await getUser();
  if (!user) redirect("/login");
  if (user.is_bot || !(await merchantOpenFor(user))) redirect("/");
  await ensureSchema();
  return user;
}

// «Мерчант болох»: төрлөө сонгоход ноорог үүснэ. Татгалзсан бол дахин өргөдөл гаргаж болно.
export async function startMerchant(formData) {
  const user = await me();
  const type = String(formData.get("type") || "");
  if (!MERCHANT_TYPES[type]) back("error", "Мерчантын төрлөө сонгоно уу");
  const [ex] = await sql`SELECT id, status, type FROM merchants WHERE user_id = ${user.id}`;
  if (ex && ex.status !== "rejected") back("error", "Танд мерчантын бүртгэл аль хэдийн байна");
  let id;
  if (ex) {
    await sql`UPDATE merchants SET status = 'draft', type = ${type}, review_note = NULL, updated_at = now() WHERE id = ${ex.id}`;
    await logStatus(ex.id, ex.status, "draft", "Дахин өргөдөл гаргаж эхэлсэн", user.id);
    id = ex.id;
  } else {
    const [m] = await sql`INSERT INTO merchants (user_id, type) VALUES (${user.id}, ${type}) ON CONFLICT (user_id) DO NOTHING RETURNING id`;
    if (!m) back("error", "Танд мерчантын бүртгэл аль хэдийн байна");
    id = m.id;
    await logStatus(id, null, "draft", null, user.id);
    // И-мэйлийг бүртгэлийн хаягаар урьдчилж бөглөнө
    if (type === "individual") await sql`INSERT INTO merchant_individual_profiles (merchant_id, email, first_name) VALUES (${id}, ${user.email || null}, ${user.first_name || null}) ON CONFLICT DO NOTHING`;
    else await sql`INSERT INTO merchant_business_profiles (merchant_id, rep_email) VALUES (${id}, ${user.email || null}) ON CONFLICT DO NOTHING`;
  }
  await audit({ actorId: user.id, category: "merchant", action: `Мерчантын бүртгэл эхлүүлсэн (${MERCHANT_TYPES[type]})`, targetType: "merchant", targetId: id });
  revalidatePath("/merchant");
  const next = nextOf(formData);
  redirect(next ? `${next}#agreement` : "/merchant");
}

// Маягтын утгуудыг уншиж, алдааг талбар бүрээр цуглуулна
function readForm(formData, type, strict) {
  const fields = type === "business" ? BUSINESS_FIELDS : INDIVIDUAL_FIELDS;
  const errors = {};
  const profile = {};
  for (const [key, label, required, kind] of fields) {
    const v = normalize(kind, formData.get(key));
    profile[key] = v || null;
    if (!v) {
      if (required && strict) errors[key] = `${label} бөглөнө үү`;
      continue;
    }
    const e = check(kind, v);
    if (e) errors[key] = e;
  }
  const shop = normalize("name", formData.get("shop_name")).slice(0, 60) || null;
  const types = formData.getAll("product_types").map(String).filter((t) => PRODUCT_TYPES.includes(t));
  if (strict && !types.length) errors.product_types = "Борлуулах бүтээгдэхүүний төрлөө сонгоно уу";
  const vat = formData.get("vat_payer") === "yes";
  if (strict && !["yes", "no"].includes(String(formData.get("vat_payer")))) errors.vat_payer = "НӨАТ төлөгч эсэхээ сонгоно уу";
  const tax = normalize("reg_person", formData.get("tax_id")) || null;
  if (tax && check("tax_id", tax)) errors.tax_id = check("tax_id", tax);
  if (strict && vat && !tax) errors.tax_id = "НӨАТ төлөгч бол татвар төлөгчийн дугаараа бичнэ үү";

  const bank = {
    bank_name: normalize("name", formData.get("bank_name")).slice(0, 60),
    account_no: normalize("account", formData.get("account_no")),
    holder_name: normalize("name", formData.get("holder_name")).slice(0, 120),
    proof: Number(formData.get("proof_doc_id")) || null,
    own: formData.get("own_account") === "on",
  };
  if (bank.account_no && check("account", bank.account_no)) errors.account_no = check("account", bank.account_no);
  if (strict) {
    if (!bank.bank_name) errors.bank_name = "Банкаа сонгоно уу";
    if (!bank.account_no) errors.account_no = "Дансны дугаараа бичнэ үү";
    if (!bank.holder_name) errors.holder_name = "Данс эзэмшигчийн нэрийг бичнэ үү";
    if (!bank.own) errors.own_account = type === "business" ? "Данс тухайн байгууллагын нэр дээр байх ёстой" : "Данс таны өөрийн нэр дээр байх ёстой";
  }
  if (bank.bank_name && !BANKS.includes(bank.bank_name) && bank.bank_name.length < 3) errors.bank_name = "Банкны нэр буруу байна";
  return { errors, profile, shop, types, vat, tax, bank };
}

async function saveProfile(m, type, profile) {
  const p = profile;
  if (type === "business") {
    await sql`INSERT INTO merchant_business_profiles (merchant_id, legal_name, state_reg_no, register_no, address, phone, email, rep_name, rep_position, rep_basis, rep_phone, rep_email, acc_name, acc_phone, acc_email)
      VALUES (${m.id}, ${p.legal_name}, ${p.state_reg_no}, ${p.register_no}, ${p.address}, ${p.phone}, ${p.email}, ${p.rep_name}, ${p.rep_position}, ${p.rep_basis}, ${p.rep_phone}, ${p.rep_email}, ${p.acc_name}, ${p.acc_phone}, ${p.acc_email})
      ON CONFLICT (merchant_id) DO UPDATE SET legal_name = EXCLUDED.legal_name, state_reg_no = EXCLUDED.state_reg_no, register_no = EXCLUDED.register_no,
        address = EXCLUDED.address, phone = EXCLUDED.phone, email = EXCLUDED.email, rep_name = EXCLUDED.rep_name, rep_position = EXCLUDED.rep_position,
        rep_basis = EXCLUDED.rep_basis, rep_phone = EXCLUDED.rep_phone, rep_email = EXCLUDED.rep_email, acc_name = EXCLUDED.acc_name,
        acc_phone = EXCLUDED.acc_phone, acc_email = EXCLUDED.acc_email, updated_at = now()`;
  } else {
    await sql`INSERT INTO merchant_individual_profiles (merchant_id, parent_name, first_name, register_no, phone, email, address)
      VALUES (${m.id}, ${p.parent_name}, ${p.first_name}, ${p.register_no}, ${p.phone}, ${p.email}, ${p.address})
      ON CONFLICT (merchant_id) DO UPDATE SET parent_name = EXCLUDED.parent_name, first_name = EXCLUDED.first_name, register_no = EXCLUDED.register_no,
        phone = EXCLUDED.phone, email = EXCLUDED.email, address = EXCLUDED.address, updated_at = now()`;
  }
}

// Данс эзэмшлийн баримт нь тухайн мерчантын идэвхтэй баримт байх ёстой
async function ownProof(merchantId, docId) {
  if (!docId) return null;
  const [d] = await sql`SELECT id FROM merchant_documents WHERE id = ${docId} AND merchant_id = ${merchantId} AND removed_at IS NULL`;
  return d ? d.id : null;
}

// Баталгаажаагүй (pending) дансыг шинэчилнэ, байхгүй бол шинээр үүсгэнэ. Баталгаажсан данс хөндөгдөхгүй.
async function upsertPendingBank(m, bank, userId) {
  if (!bank.bank_name && !bank.account_no && !bank.holder_name) return;
  const proof = await ownProof(m.id, bank.proof);
  const [p] = await sql`UPDATE merchant_bank_accounts SET bank_name = ${bank.bank_name}, account_no = ${bank.account_no}, holder_name = ${bank.holder_name},
                          proof_doc_id = ${proof}, created_by = ${userId}, created_at = now()
                        WHERE merchant_id = ${m.id} AND status = 'pending' RETURNING id`;
  if (!p) {
    await sql`INSERT INTO merchant_bank_accounts (merchant_id, bank_name, account_no, holder_name, proof_doc_id, created_by)
              VALUES (${m.id}, ${bank.bank_name}, ${bank.account_no}, ${bank.holder_name}, ${proof}, ${userId})
              ON CONFLICT DO NOTHING`;
  }
}

// Мэдээлэл хадгалах (ноорог) эсвэл шалгуулахаар илгээх. useActionState-ээр дуудна.
export async function saveMerchant(prev, formData) {
  const user = await me();
  const m = await loadMerchant({ userId: user.id });
  if (!m) return { error: "Мерчантын бүртгэл олдсонгүй" };
  if (!EDITABLE.includes(m.status)) return { error: "Одоогийн төлөвт мэдээллээ засах боломжгүй" };
  const submit = formData.get("intent") === "submit";
  const f = readForm(formData, m.type, submit);
  // Ноорог хадгалахад буруу форматтай талбарыг хоосон хадгална, илгээхэд бүгд зөв байх ёстой
  if (!submit) for (const k of Object.keys(f.errors)) if (k in f.profile) f.profile[k] = null;
  if (submit) {
    const kinds = new Set(m.docs.map((d) => d.kind));
    for (const [k, d] of Object.entries(DOC_KINDS)) if (d.need?.includes(m.type) && !kinds.has(k)) f.errors[`doc_${k}`] = `${d.label} хавсаргана уу`;
  }
  await saveProfile(m, m.type, f.profile);
  await sql`UPDATE merchants SET shop_name = ${f.shop}, product_types = ${f.types}, vat_payer = ${f.vat}, tax_id = ${f.errors.tax_id ? null : f.tax}, updated_at = now()
            WHERE id = ${m.id}`;
  if (!f.errors.account_no) await upsertPendingBank(m, f.bank, user.id);
  revalidatePath("/merchant");
  if (Object.keys(f.errors).length && submit) return { error: "Зарим талбарыг засна уу", errors: f.errors };
  if (!submit) return { ok: `Ноорог хадгалагдлаа${Object.keys(f.errors).length ? ". Улаанаар тэмдэглэсэн талбарыг засна уу" : ""}`, errors: f.errors };

  const [done] = await sql`UPDATE merchants SET status = 'pending_review', submitted_at = now(), updated_at = now()
                           WHERE id = ${m.id} AND status = ANY(${EDITABLE}) RETURNING id`;
  if (!done) return { error: "Одоогийн төлөвт илгээх боломжгүй" };
  await logStatus(m.id, m.status, "pending_review", null, user.id);
  await notifySupers("merchant_new", m.id, user.id, f.shop || f.profile.legal_name || [f.profile.parent_name, f.profile.first_name].filter(Boolean).join(" "));
  await audit({ actorId: user.id, category: "merchant", action: "Мерчантын бүртгэлээ шалгуулахаар илгээсэн", targetType: "merchant", targetId: m.id });
  revalidatePath("/admin/merchants");
  const next = nextOf(formData);
  if (next) { revalidatePath(next); redirect(`${next}?ok=${encodeURIComponent("Мерчантын мэдээллээ илгээлээ. Одоо гэрээгээ баталгаажуулна уу")}#agreement`); }
  redirect("/merchant?ok=" + encodeURIComponent("Шалгуулахаар илгээлээ. Шийдвэр гармагц мэдэгдэл очно"));
}

// Баталгаажсан мерчант шинэ данс бүртгүүлнэ. Шинэ данс батлагдах хүртэл хуучин баталгаажсан данс хүчинтэй.
export async function changeBank(formData) {
  const user = await me();
  const m = await loadMerchant({ userId: user.id });
  if (!m || !["approved", "suspended"].includes(m.status)) back("error", "Данс солих боломжгүй төлөв байна");
  const f = readForm(formData, m.type, false);
  const b = f.bank;
  if (!b.bank_name || !b.account_no || !b.holder_name) back("error", "Банк, дансны дугаар, эзэмшигчийн нэрийг бүгдийг бөглөнө үү");
  if (f.errors.account_no) back("error", f.errors.account_no);
  if (!b.own) back("error", m.type === "business" ? "Данс тухайн байгууллагын нэр дээр байх ёстой" : "Данс таны өөрийн нэр дээр байх ёстой");
  if (m.bank && m.bank.account_no === b.account_no && m.bank.bank_name === b.bank_name) back("error", "Энэ данс аль хэдийн баталгаажсан байна");
  await upsertPendingBank(m, b, user.id);
  await notifySupers("merchant_bank", m.id, user.id, `${b.bank_name} · ${m.shop_name || ""}`.replace(/ · $/, ""));
  await audit({ actorId: user.id, category: "merchant", action: "Шинэ банкны данс баталгаажуулахаар илгээсэн", targetType: "merchant", targetId: m.id });
  revalidatePath("/merchant");
  revalidatePath("/admin/merchants");
  back("ok", "Шинэ дансыг шалгуулахаар илгээлээ. Баталгаажих хүртэл хуучин данс тань хүчинтэй");
}

// Илгээсэн өргөдлөө буцааж авч засах (шалгаж эхлээгүй үед)
export async function withdrawMerchant() {
  const user = await me();
  const [m] = await sql`UPDATE merchants SET status = 'draft', updated_at = now() WHERE user_id = ${user.id} AND status = 'pending_review' RETURNING id`;
  if (!m) back("error", "Буцааж авах боломжгүй");
  await logStatus(m.id, "pending_review", "draft", "Мерчант өөрөө буцааж авсан", user.id);
  revalidatePath("/merchant");
  revalidatePath("/admin/merchants");
  back("ok", "Өргөдлөө буцааж авлаа. Засаад дахин илгээнэ үү");
}
