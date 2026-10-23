import { sql } from "./db";
import { currentPeriod } from "./spark";

// Мөнгөний дүрэм (docs: Очны системийн шинжилгээ, 2026-10-19). Бүх дүн төгрөгөөр.
export const PREMIUM_PLANS = [
  { months: 1, price: 9900, label: "1 сар" },
  { months: 3, price: 27900, label: "3 сар" },
  { months: 12, price: 99000, label: "1 жил" },
];
// Доорх утгуудыг супер админ Тохиргоо хэсгээс өөрчилнө (lib/settings.js setMoneyRules)
export let POOL_SHARE = 0.3; // премиумын цэвэр орлогын 30% шагналын санд
export let TIP_FEE = 0.1; // бичээчид өгсөн хандиваас сайтын шимтгэл
export const PAYMENT_FEE = 0.02; // төлбөрийн системийн шимтгэл (ойролцоо, баталгаажуулахад засна)
export let QPAY_FEE = 0.01; // QPay-ийн гэрээний шимтгэл: автомат баталгаажуулалтад суутгана
export const DONATION_MIN = 1000;
export const DONATION_MAX = 5000000;
export let WITHDRAW_MIN = 50000; // хэтэвчээс татах доод дүн
export const INCOME_TAX = 0.1; // татан авалтаас суутгах хувь хүний орлогын албан татвар (нягтлантай шалгах)

// Шилэн дансны мөрийн утга
export const KIND_LABEL = {
  premium: "Дэмжигчийн хураамж",
  fee: "Төлбөрийн шимтгэл",
  pool_share: "Дэмжигчийн 30% санд",
  donation: "Сан руу хандив",
  tip: "Бичээчид урамшуулал",
  tip_fee: "Урамшууллын 10% шимтгэл",
  topup: "Хэтэвч цэнэглэсэн",
  bounty_lock: "Асуултын шагнал түгжсэн",
  bounty_refund: "Асуултын шагнал буцсан",
  bounty_paid: "Асуултын шагнал олгосон",
  bounty: "Асуултын шагнал авсан",
  bounty_fee: "Асуултын шагналын 10% шимтгэл",
  video: "Видео нээсэн",
  prize: "Сарын шагнал",
  withdrawal: "Хэтэвчээс татсан",
  payout: "Бичээчид шилжүүлсэн",
  tax_withheld: "Суутгасан татвар",
  server: "Сервер, хадгаламж",
  editorial: "Редакцын цалин",
  tax: "Сайтын татвар",
  other: "Бусад зардал",
};
export const EXPENSE_KINDS = ["server", "editorial", "tax", "fee", "other"];
export const ACCOUNT_LABEL = { platform: "Сайт", pool: "Шагналын сан", wallet: "Хэтэвч", escrow: "Түгжигдсэн шагнал", out: "Гарсан" };
export const REQUEST_KIND = { premium: "Дэмжигч", pool: "Сан руу хандив", tip: "Бичээчид урамшуулал", topup: "Хэтэвч цэнэглэх" };
export const REQUEST_STATUS = { pending: "Шилжүүлэг хүлээж байна", confirmed: "Баталгаажсан", cancelled: "Цуцалсан" };

export const fmtMnt = (n) => `${Math.round(Number(n || 0)).toLocaleString("en-US")}₮`;

// Төлбөрийн хүсэлтийн код: шилжүүлгийн утганд бичнэ
export function payCode() {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "SS-";
  for (let i = 0; i < 6; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}

// Шилжүүлгийн мэдээлэл (Vercel: PAY_BANK_INFO, жишээ нь "Хаан банк 5000123456 · Science Spark ХХК")
let BANK_INFO = "";
export const bankInfo = () => (BANK_INFO || process.env.PAY_BANK_INFO || "").trim();
export function setMoneyRules(r) {
  POOL_SHARE = r.poolShare / 100;
  TIP_FEE = r.tipFee / 100;
  WITHDRAW_MIN = r.withdrawMin;
  PREMIUM_PLANS.forEach((p, i) => { p.price = r.plans[i]; });
  BANK_INFO = r.bankInfo || "";
  if (r.qpayFee != null) QPAY_FEE = r.qpayFee / 100;
}

export async function poolBalance() {
  const [r] = await sql`SELECT COALESCE(SUM(delta), 0)::bigint AS n FROM money_ledger WHERE account = 'pool'`;
  return Number(r.n);
}
export async function walletBalance(userId) {
  const [r] = await sql`SELECT COALESCE(SUM(delta), 0)::bigint AS n FROM money_ledger WHERE account = 'wallet' AND user_id = ${userId}`;
  return Number(r.n);
}

// Шилжүүлэг ирснийг редакц баталгаажуулахад мөнгийг дансуудад хуваарилна.
// Буцаах утга: хуваарилсан мөрүүд (тайланд харуулахад).
export function paymentRows(req, fee, adminId) {
  const period = currentPeriod();
  const net = req.amount - fee;
  const base = { period, ref_id: req.id, created_by: adminId };
  const rows = [];
  if (fee > 0) rows.push({ ...base, account: "out", kind: "fee", delta: fee, user_id: null, note: req.code });
  if (req.kind === "premium") {
    const share = Math.floor(net * POOL_SHARE);
    rows.push({ ...base, account: "platform", kind: "premium", delta: net - share, user_id: null, anonymous: true });
    rows.push({ ...base, account: "pool", kind: "pool_share", delta: share, user_id: null, anonymous: true });
  } else if (req.kind === "pool") {
    rows.push({ ...base, account: "pool", kind: "donation", delta: net, user_id: req.user_id, anonymous: req.anonymous, note: req.message });
  } else if (req.kind === "tip") {
    const cut = Math.round(net * TIP_FEE);
    rows.push({ ...base, account: "wallet", kind: "tip", delta: net - cut, user_id: req.writer_id, anonymous: req.anonymous, note: req.message });
    rows.push({ ...base, account: "platform", kind: "tip_fee", delta: cut, user_id: null });
  } else if (req.kind === "topup") {
    // Өөрийн хэтэвчийг цэнэглэнэ: асуултын шагнал тавих, бичээчийг урамшуулахад зарцуулна.
    // Хэтэвчинд бүтэн дүн орж, төлбөрийн шимтгэлийг сайт хариуцна.
    rows.push({ ...base, account: "wallet", kind: "topup", delta: req.amount, user_id: req.user_id });
    if (fee > 0) rows.push({ ...base, account: "platform", kind: "fee", delta: -fee, user_id: null, note: req.code });
  }
  return rows;
}

export const insertRow = (r) => sql`
  INSERT INTO money_ledger (account, user_id, kind, delta, period, ref_id, note, anonymous, created_by)
  VALUES (${r.account}, ${r.user_id ?? null}, ${r.kind}, ${r.delta}, ${r.period}, ${r.ref_id ?? null}, ${r.note ?? null}, ${!!r.anonymous}, ${r.created_by ?? null})`;

// Сарын тайлан: шилэн дансны хүснэгт
export async function periodSummary(limit = 12) {
  return sql`
    SELECT period,
      COALESCE(SUM(delta) FILTER (WHERE account = 'platform' AND kind = 'premium'), 0)::bigint
        + COALESCE(SUM(delta) FILTER (WHERE account = 'pool' AND kind = 'pool_share'), 0)::bigint AS premium_net,
      COALESCE(SUM(delta) FILTER (WHERE account = 'out' AND kind = 'fee'), 0)::bigint AS fees,
      COALESCE(SUM(delta) FILTER (WHERE account = 'pool' AND kind = 'pool_share'), 0)::bigint AS pool_share,
      COALESCE(SUM(delta) FILTER (WHERE account = 'pool' AND kind = 'donation'), 0)::bigint AS donations,
      COALESCE(-SUM(delta) FILTER (WHERE account = 'pool' AND kind = 'prize'), 0)::bigint AS prizes,
      COALESCE(SUM(delta) FILTER (WHERE account = 'wallet' AND kind IN ('tip', 'bounty')), 0)::bigint AS tips,
      COALESCE(SUM(delta) FILTER (WHERE account = 'platform' AND kind IN ('tip_fee', 'bounty_fee')), 0)::bigint AS tip_fees,
      COALESCE(SUM(delta) FILTER (WHERE account = 'out' AND kind = 'server'), 0)::bigint AS server,
      COALESCE(SUM(delta) FILTER (WHERE account = 'out' AND kind = 'editorial'), 0)::bigint AS editorial,
      COALESCE(SUM(delta) FILTER (WHERE account = 'out' AND kind IN ('tax', 'tax_withheld')), 0)::bigint AS tax,
      COALESCE(SUM(delta) FILTER (WHERE account = 'out' AND kind = 'other'), 0)::bigint AS other,
      COALESCE(SUM(delta) FILTER (WHERE account = 'out' AND kind = 'payout'), 0)::bigint AS payouts,
      COALESCE(SUM(delta) FILTER (WHERE account = 'platform'), 0)::bigint AS platform_net
    FROM money_ledger GROUP BY period ORDER BY period DESC LIMIT ${limit}`;
}
