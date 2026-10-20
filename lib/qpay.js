// QPay v2 (merchant.qpay.mn): нэхэмжлэх үүсгэж QR, банкны апп-ын холбоос авна, төлөгдсөн эсэхийг шалгана.
// Нууц мэдээллийг зөвхөн Vercel-ийн орчны хувьсагчид хадгална:
//   QPAY_USERNAME, QPAY_PASSWORD, QPAY_INVOICE_CODE (гэрээгээр өгсөн), QPAY_BASE_URL (заавал биш, туршилтын орчинд
//   https://merchant-sandbox.qpay.mn)
import { siteUrl } from "./mail";

const base = () => (process.env.QPAY_BASE_URL || "https://merchant.qpay.mn").replace(/\/+$/, "");
export const qpayOn = () => !!(process.env.QPAY_USERNAME && process.env.QPAY_PASSWORD && process.env.QPAY_INVOICE_CODE);

// Токеныг серверийн санах ойд хадгалж, хугацаа дуусахаас өмнө шинээр авна
let token = { value: "", until: 0 };

async function call(path, { method = "GET", body, auth } = {}) {
  const res = await fetch(base() + path, {
    method,
    headers: { "Content-Type": "application/json", Authorization: auth || `Bearer ${await accessToken()}` },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 401) token = { value: "", until: 0 };
    throw new Error(`QPay ${method} ${path} ${res.status}: ${text.slice(0, 200)}`);
  }
  return text ? JSON.parse(text) : {};
}

async function accessToken() {
  if (token.value && Date.now() < token.until) return token.value;
  const basic = Buffer.from(`${process.env.QPAY_USERNAME}:${process.env.QPAY_PASSWORD}`).toString("base64");
  const r = await call("/v2/auth/token", { method: "POST", auth: `Basic ${basic}` });
  // expires_in нь зарим үед unix хугацаа (секунд), зарим үед үргэлжлэх секунд байдаг
  const exp = Number(r.expires_in) || 0;
  const until = exp > 1e9 ? exp * 1000 : Date.now() + (exp || 3600) * 1000;
  token = { value: r.access_token, until: until - 60000 };
  return token.value;
}

// Нэхэмжлэх: sender_invoice_no = манай код (SS-XXXXXX). Хариу: QR зураг, банкны апп-ын холбоосууд.
export async function createInvoice({ code, userId, amount, description }) {
  const r = await call("/v2/invoice", {
    method: "POST",
    body: {
      invoice_code: process.env.QPAY_INVOICE_CODE,
      sender_invoice_no: code,
      invoice_receiver_code: String(userId),
      invoice_description: description.slice(0, 255),
      amount,
      callback_url: `${siteUrl()}/api/qpay/callback?code=${encodeURIComponent(code)}`,
    },
  });
  return {
    invoice_id: r.invoice_id,
    qr_image: r.qr_image || "",
    short_url: r.qPay_shortUrl || r.qpay_short_url || "",
    // Банкны апп-ын холбоос (khanbank://…, https://…); javascript: зэргийг хаяна
    urls: (r.urls || []).filter((u) => u && /^[a-z][\w+.-]*:/i.test(u.link || "") && !/^(javascript|data|vbscript|file):/i.test(u.link)).map((u) => ({ name: u.name, description: u.description, logo: /^https:\/\//i.test(u.logo || "") ? u.logo : "", link: u.link })),
  };
}

// Нэхэмжлэхийн төлөгдсөн төлбөрүүд. Callback-д итгэхгүй, үргэлж QPay-ээс өөрөөс нь шалгана.
export async function checkInvoice(invoiceId) {
  const r = await call("/v2/payment/check", {
    method: "POST",
    body: { object_type: "INVOICE", object_id: invoiceId, offset: { page_number: 1, page_limit: 100 } },
  });
  const paid = (r.rows || []).filter((p) => p.payment_status === "PAID");
  const amount = paid.reduce((s, p) => s + Number(p.payment_amount || 0), 0);
  return { amount, paymentId: paid[0]?.payment_id ? String(paid[0].payment_id) : null };
}

export async function cancelInvoice(invoiceId) {
  try {
    await call(`/v2/invoice/${encodeURIComponent(invoiceId)}`, { method: "DELETE" });
  } catch (e) {
    // Цуцалж чадаагүй ч манай талд хүсэлт цуцлагдсан хэвээр. Төлөгдвөл payments.js дахин баталгаажуулна.
  }
}
