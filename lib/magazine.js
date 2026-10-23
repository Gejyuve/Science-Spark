import { put, del, get } from "@vercel/blob";
import { sql } from "./db";
import { isStaff, isSuperAdmin } from "./auth";
import { blobOn } from "./images";
import { MAGAZINE_PUBLIC } from "./magazine-shared";

// Сэтгүүл: PDF-ийг супер админы хөтөч дээр хуудас бүрээр нь зураг болгож оруулна (PDF файл сайт дээр хадгалагдахгүй).
// Хуудасны зургийг зөвхөн /api/magazine/page-ээр, эрхийг нь шалгаж дамжуулна. Blob-ийн жинхэнэ хаяг хэрэглэгчид очихгүй.

export const canSeeMagazine = (user) => MAGAZINE_PUBLIC || isSuperAdmin(user?.operator || user);

// Хэрэглэгчид харагдах дугаарууд: нийтлэгдсэн + удахгүй гарах. Нийтэд нээгдээгүй үед супер админ бэлтгэж буйг ч харна.
export const visibleStatuses = (user) => (isSuperAdmin(user?.operator || user) ? ["published", "soon", "draft"] : ["published", "soon"]);

export const isFreeIssue = (i) => !i.price_mnt;

// Бүтэн унших эрх: үнэгүй дугаар, редакц, эсвэл худалдаж авсан
export function hasIssueAccess(user, issue, unlocked) {
  if (isFreeIssue(issue)) return true;
  if (!user) return false;
  return isStaff(user.operator || user) || !!unlocked;
}

// Эхний хуудас (нүүр) болон preview_pages хүртэлх хуудсыг хүн бүр үнэгүй үзнэ
export const freePages = (issue) => Math.max(1, issue.preview_pages || 0);

export async function getIssue(id, user) {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) return null;
  const [i] = await sql`
    SELECT i.*, un.user_id IS NOT NULL AS unlocked, COALESCE(un.last_page, 1) AS last_page
    FROM magazine_issues i
    LEFT JOIN magazine_unlocks un ON un.issue_id = i.id AND un.user_id = ${user?.id || 0}
    WHERE i.id = ${n} AND i.status = ANY(${visibleStatuses(user)})`;
  return i || null;
}

export async function listIssues(user) {
  return sql`
    SELECT i.*, un.user_id IS NOT NULL AS unlocked
    FROM magazine_issues i
    LEFT JOIN magazine_unlocks un ON un.issue_id = i.id AND un.user_id = ${user?.id || 0}
    WHERE i.status = ANY(${visibleStatuses(user)})
    ORDER BY i.number DESC, i.id DESC`;
}

// Дараагийн (удахгүй гарах) дугаар: нийтлэл, баннерын хүсэлтэд сонгоно
export const upcomingIssues = () =>
  sql`SELECT id, number, title FROM magazine_issues WHERE status IN ('soon', 'draft') ORDER BY number, id`;

// Хэтэвчнээс төлж дугаарыг нээнэ. Нэг хүний төлбөр ээлжилнэ (давхар хасахгүй).
export async function payIssue(userId, issue, period) {
  const note = `Сэтгүүл №${issue.number}`;
  const [, rows] = await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(8202, ${userId})`,
    sql`
      WITH bal AS (SELECT COALESCE(SUM(delta), 0) AS b FROM money_ledger WHERE account = 'wallet' AND user_id = ${userId}),
      u AS (
        INSERT INTO magazine_unlocks (user_id, issue_id, paid_mnt)
        SELECT ${userId}, ${issue.id}, ${issue.price_mnt} FROM bal WHERE bal.b >= ${issue.price_mnt}
        ON CONFLICT DO NOTHING RETURNING issue_id
      ),
      w AS (INSERT INTO money_ledger (account, user_id, kind, delta, period, ref_id, note)
            SELECT 'wallet', ${userId}, 'magazine', ${-issue.price_mnt}, ${period}, issue_id, ${note} FROM u RETURNING 1),
      pl AS (INSERT INTO money_ledger (account, user_id, kind, delta, period, ref_id, note)
             SELECT 'platform', NULL, 'magazine', ${issue.price_mnt}, ${period}, issue_id, ${note} FROM u RETURNING 1)
      SELECT issue_id FROM u`,
  ]);
  return rows.length > 0;
}

// Биет хувь захиалж, хэтэвчнээс нийт дүнг (хувь × үнэ + хүргэлт) хасна. Захиалгын дугаарыг буцаана.
export async function placeOrder(userId, issue, o, period) {
  const total = o.qty * issue.print_price + issue.delivery_fee;
  const note = `Сэтгүүл №${issue.number} · ${o.qty} хувь`;
  const [, rows] = await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(8203, ${userId})`,
    sql`
      WITH bal AS (SELECT COALESCE(SUM(delta), 0) AS b FROM money_ledger WHERE account = 'wallet' AND user_id = ${userId}),
      o AS (
        INSERT INTO magazine_orders (user_id, issue_id, qty, total, name, phone, city, district, address, note)
        SELECT ${userId}, ${issue.id}, ${o.qty}, ${total}, ${o.name}, ${o.phone}, ${o.city}, ${o.district}, ${o.address}, ${o.note}
        FROM bal WHERE bal.b >= ${total}
        RETURNING id
      ),
      w AS (INSERT INTO money_ledger (account, user_id, kind, delta, period, ref_id, note)
            SELECT 'wallet', ${userId}, 'mag_print', ${-total}, ${period}, id, ${note} FROM o RETURNING 1),
      pl AS (INSERT INTO money_ledger (account, user_id, kind, delta, period, ref_id, note)
             SELECT 'platform', NULL, 'mag_print', ${total}, ${period}, id, ${note} FROM o RETURNING 1)
      SELECT id FROM o`,
  ]);
  return rows[0]?.id || null;
}

// Захиалгыг цуцалж, төлсөн мөнгийг хэтэвчинд нь буцаана (хүргэгдсэн, цуцалсан захиалгыг дахин цуцлахгүй)
export async function refundOrder(orderId, period) {
  const [, rows] = await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(8204, ${orderId})`,
    sql`
      WITH o AS (
        UPDATE magazine_orders SET status = 'cancelled', updated_at = now()
        WHERE id = ${orderId} AND status IN ('paid', 'sent')
        RETURNING id, user_id, total
      ),
      w AS (INSERT INTO money_ledger (account, user_id, kind, delta, period, ref_id, note)
            SELECT 'wallet', user_id, 'mag_refund', total, ${period}, id, 'Сэтгүүлийн захиалга цуцалсан' FROM o WHERE user_id IS NOT NULL RETURNING 1),
      pl AS (INSERT INTO money_ledger (account, user_id, kind, delta, period, ref_id, note)
             SELECT 'platform', NULL, 'mag_refund', -total, ${period}, id, 'Сэтгүүлийн захиалга цуцалсан' FROM o WHERE user_id IS NOT NULL RETURNING 1)
      SELECT id, user_id FROM o`,
  ]);
  return rows[0] || null;
}

// Хүргэлтийн систем рүү захиалгыг шууд илгээнэ.
// Монголын хүргэлтийн компаниуд нийтэд нээлттэй API гаргаагүй тул ерөнхий webhook ашиглана:
// Vercel дээр DELIVERY_WEBHOOK_URL (заавал), DELIVERY_WEBHOOK_TOKEN (заавал биш) тохируулбал захиалга бүр
// тэр хаяг руу JSON-оор очно. Тохируулаагүй бол зөвхөн Админ > Сэтгүүл > Захиалга жагсаалтад үлдэнэ.
export const courierOn = () => !!process.env.DELIVERY_WEBHOOK_URL;

export async function sendToCourier(orderId) {
  if (!courierOn()) return null;
  const [o] = await sql`
    SELECT o.*, i.number, i.title FROM magazine_orders o JOIN magazine_issues i ON i.id = o.issue_id WHERE o.id = ${orderId}`;
  if (!o || o.status === "cancelled") return null;
  const payload = {
    order_id: `SS-MAG-${o.id}`,
    created_at: o.created_at,
    item: { name: `Science Spark сэтгүүл №${o.number}: ${o.title}`, qty: o.qty },
    paid: true,
    amount: o.total,
    recipient: { name: o.name, phone: o.phone },
    address: { city: o.city, district: o.district || "", detail: o.address },
    note: o.note || "",
  };
  let status, ref = null;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    const token = process.env.DELIVERY_WEBHOOK_TOKEN;
    const r = await fetch(process.env.DELIVERY_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(payload),
      signal: ctl.signal,
      cache: "no-store",
    }).finally(() => clearTimeout(timer));
    const j = await r.json().catch(() => ({}));
    ref = String(j.tracking || j.tracking_number || j.id || j.order_id || "").slice(0, 80) || null;
    status = r.ok ? "sent" : `failed: ${r.status}`;
  } catch (e) {
    status = `failed: ${e.name === "AbortError" ? "timeout" : "network"}`;
  }
  await sql`UPDATE magazine_orders SET courier_status = ${status}, courier_ref = COALESCE(${ref}, courier_ref),
              status = CASE WHEN ${status} = 'sent' AND status = 'paid' THEN 'sent' ELSE status END, updated_at = now()
            WHERE id = ${orderId}`;
  return status;
}

// Сэтгүүлийн хэсгийг удирддаг супер админуудад мэдэгдэнэ
export async function notifySupers({ kind, actorId = null, note = null, magId = null }) {
  try {
    await sql`INSERT INTO notifications (user_id, kind, actor_id, note, mag_id)
              SELECT u.id, ${kind}, ${actorId}, ${note}, ${magId} FROM users u
              WHERE u.role = 'superadmin' AND NOT u.is_bot AND u.id IS DISTINCT FROM ${actorId}::int`;
  } catch (e) {}
}

// Шинэ дугаар нийтлэгдэхэд (хэсэг нийтэд нээлттэй бол) бүх хэрэглэгчид нэг удаа мэдэгдэнэ
export async function notifyNewIssue(issue) {
  if (!MAGAZINE_PUBLIC) return;
  try {
    await sql`INSERT INTO notifications (user_id, kind, note, mag_id)
              SELECT u.id, 'mag_new', ${`№${issue.number}: ${issue.title}`}, ${issue.id} FROM users u
              WHERE NOT u.is_bot AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.user_id = u.id AND n.kind = 'mag_new' AND n.mag_id = ${issue.id})`;
  } catch (e) {}
}

// --- Хуудасны зураг ---

export const PAGE_MAX_BYTES = 4_000_000;

// Сан Public эсвэл Private байж болно. Public бол хаяг нь санамсаргүй урт нэртэй, хэрэглэгчид хэзээ ч харагдахгүй.
let access = null;
async function putPage(path, buf, mime) {
  const opts = (a) => ({ access: a, contentType: mime, addRandomSuffix: true });
  if (access) return (await put(path, buf, opts(access))).url;
  try {
    const b = await put(path, buf, opts("private"));
    access = "private";
    return b.url;
  } catch (e) {
    const b = await put(path, buf, opts("public"));
    access = "public";
    return b.url;
  }
}

export async function storePage(issueId, page, buf, mime, w, h) {
  let url = null;
  if (blobOn()) {
    try {
      url = await putPage(`mag/${issueId}/p${String(page).padStart(3, "0")}.webp`, buf, mime);
    } catch (e) {
      console.error("magazine blob upload failed", e?.message || e);
    }
  }
  const [old] = await sql`SELECT url FROM magazine_pages WHERE issue_id = ${issueId} AND page = ${page}`;
  if (url) {
    await sql`INSERT INTO magazine_pages (issue_id, page, mime, url, data, width, height, bytes)
              VALUES (${issueId}, ${page}, ${mime}, ${url}, NULL, ${w}, ${h}, ${buf.length})
              ON CONFLICT (issue_id, page) DO UPDATE SET mime = EXCLUDED.mime, url = EXCLUDED.url, data = NULL,
                width = EXCLUDED.width, height = EXCLUDED.height, bytes = EXCLUDED.bytes`;
  } else {
    await sql`INSERT INTO magazine_pages (issue_id, page, mime, url, data, width, height, bytes)
              VALUES (${issueId}, ${page}, ${mime}, NULL, decode(${buf.toString("base64")}, 'base64'), ${w}, ${h}, ${buf.length})
              ON CONFLICT (issue_id, page) DO UPDATE SET mime = EXCLUDED.mime, url = NULL, data = EXCLUDED.data,
                width = EXCLUDED.width, height = EXCLUDED.height, bytes = EXCLUDED.bytes`;
  }
  if (old?.url && old.url !== url) await del(old.url).catch(() => {});
}

export async function readPage(issueId, page) {
  const [r] = await sql`SELECT mime, url, CASE WHEN url IS NULL THEN encode(data, 'base64') END AS b64
                        FROM magazine_pages WHERE issue_id = ${issueId} AND page = ${page}`;
  if (!r) return null;
  if (!r.url) return { mime: r.mime, body: Buffer.from(r.b64 || "", "base64") };
  if (!/\.private\.blob\./.test(r.url)) {
    const res = await fetch(r.url, { cache: "no-store" });
    if (res.ok) return { mime: r.mime, body: res.body };
  }
  const g = await get(r.url, { access: "private" });
  return g ? { mime: r.mime, body: g.stream } : null;
}

// Тухайн хуудаснаас хойшхи (эсвэл бүх) хуудсыг устгана: шинэ PDF богино бол илүү хуудас үлдэхгүй
export async function deletePages(issueId, fromPage = 1) {
  const rows = await sql`DELETE FROM magazine_pages WHERE issue_id = ${issueId} AND page >= ${fromPage} RETURNING url`;
  const urls = rows.map((r) => r.url).filter(Boolean);
  for (let i = 0; i < urls.length; i += 100) await del(urls.slice(i, i + 100)).catch(() => {});
}
