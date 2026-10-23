import { sql } from "./db";
import { LEVELS, APPROVE_REWARD, ARTICLE_LEVEL, NEWS_LEVEL, WORD_LEVEL, setLevelRules } from "./levels";
import { ACT_REWARD, DAILY_POST, setActRules } from "./limits";
import { setVideoRules } from "./video-shared";
import { POOL_SHARE, TIP_FEE, QPAY_FEE, WITHDRAW_MIN, PREMIUM_PLANS, setMoneyRules } from "./money";

// Сайтын тохиргоо: супер админ /admin/settings хуудсаас өөрчилнө, settings хүснэгтэд нэг мөрөөр хадгална.
// Хадгалсан утга кодын анхны утгыг дарж, тухайн модулиудын тогтмолуудад шууд тусна.
// Анхны утгыг модулиуд ачаалагдсаны дараа, эхний дуудлагаар нэг удаа авна (импортын тойргоос сэргийлнэ).
let DEFAULTS = null;
export const defaults = () => (DEFAULTS ||= {
  levelMins: LEVELS.slice(1).map((l) => l.min),
  daily: LEVELS.map((l) => l.daily),
  articleLevel: ARTICLE_LEVEL,
  newsLevel: NEWS_LEVEL,
  wordLevel: WORD_LEVEL,
  approveArticle: APPROVE_REWARD["Нийтлэл"],
  approveNews: APPROVE_REWARD["Мэдээ"],
  actReward: { ...ACT_REWARD },
  dailyPost: Object.fromEntries(Object.entries(DAILY_POST).map(([k, v]) => [k, [...v]])),
  poolShare: Math.round(POOL_SHARE * 100),
  tipFee: Math.round(TIP_FEE * 100),
  qpayFee: Math.round(QPAY_FEE * 1000) / 10,
  withdrawMin: WITHDRAW_MIN,
  plans: PREMIUM_PLANS.map((p) => p.price),
  bankInfo: "",
  registrationOpen: true,
  maintenance: false,
  announcement: "",
  videoPublic: false,
});

const TTL = 30000;
let cache = { at: 0, data: null };

function apply(s) {
  LEVELS.forEach((l, i) => {
    if (i > 0) l.min = s.levelMins[i - 1];
    l.daily = s.daily[i];
  });
  APPROVE_REWARD["Нийтлэл"] = s.approveArticle;
  APPROVE_REWARD["Мэдээ"] = s.approveNews;
  setLevelRules(s);
  setActRules(s);
  setMoneyRules(s);
  setVideoRules(s);
}

// Хүсэлт бүрийн эхэнд (getUser) дуудна. 30 секунд серверийн санах ойд хадгална.
export async function loadSettings() {
  if (Date.now() - cache.at < TTL) return cache.data;
  let data = defaults();
  try {
    const [r] = await sql`SELECT data FROM settings WHERE id = 1`;
    // Шинэ түлхүүр нэмэгдэхэд хуучин хадгалсан тохиргоонд анхны утгаараа нөхөгдөнө
    if (r) data = { ...data, ...r.data, actReward: { ...data.actReward, ...r.data.actReward }, dailyPost: { ...data.dailyPost, ...r.data.dailyPost } };
  } catch (e) {}
  apply(data);
  cache = { at: Date.now(), data };
  return data;
}

export async function saveSettings(data) {
  await sql`INSERT INTO settings (id, data, updated_at) VALUES (1, ${JSON.stringify(data)}::jsonb, now())
            ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`;
  apply(data);
  cache = { at: Date.now(), data };
}
