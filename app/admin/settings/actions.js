"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSection, audit } from "@/lib/admin";
import { loadSettings, saveSettings } from "@/lib/settings";
import { LEVELS } from "@/lib/levels";
import { ACT_REWARD, LIMIT_KEYS } from "@/lib/limits";

const back = (msg, ok) => redirect(`/admin/settings?${ok ? "ok" : "error"}=${encodeURIComponent(msg)}`);
const int = (f, k) => {
  const v = String(f.get(k) ?? "").replace(/[\s,]/g, "");
  return /^-?\d+$/.test(v) ? Number(v) : NaN;
};
const inRange = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

// Супер админ: сайтын тохиргоог хадгална. Бүх утгыг шалгаад нэг дор бичнэ.
export async function updateSettings(f) {
  const me = await requireSection("settings");
  if (me.role !== "superadmin") back("Тохиргоог зөвхөн супер админ өөрчилнө");
  const prev = await loadSettings();
  const levelMins = LEVELS.slice(1).map((_, i) => int(f, `min${i + 1}`));
  const daily = LEVELS.map((_, i) => int(f, `daily${i}`));
  const s = {
    levelMins,
    daily,
    articleLevel: int(f, "articleLevel"),
    newsLevel: int(f, "newsLevel"),
    wordLevel: int(f, "wordLevel"),
    approveArticle: int(f, "approveArticle"),
    approveNews: int(f, "approveNews"),
    actReward: Object.fromEntries(Object.keys(ACT_REWARD).map((k) => [k, int(f, `rw_${k}`)])),
    dailyPost: Object.fromEntries(LIMIT_KEYS.map((k) => [k, [int(f, `lim_${k}0`), int(f, `lim_${k}1`)]])),
    poolShare: int(f, "poolShare"),
    tipFee: int(f, "tipFee"),
    qpayFee: Number(String(f.get("qpayFee") ?? "").replace(",", ".")),
    withdrawMin: int(f, "withdrawMin"),
    plans: [0, 1, 2].map((i) => int(f, `plan${i}`)),
    bankInfo: String(f.get("bankInfo") || "").trim().slice(0, 500),
    registrationOpen: f.get("registrationOpen") === "on",
    maintenance: f.get("maintenance") === "on",
    announcement: String(f.get("announcement") || "").trim().slice(0, 300),
  };
  if (!levelMins.every((v, i) => inRange(v, 1, 100000000) && (i === 0 || v > levelMins[i - 1]))) back("Түвшний босго 1-ээс их, дараалан өсөх ёстой");
  if (!daily.every((v) => inRange(v, 0, 100))) back("Өдрийн оч 0–100 хооронд байна");
  if (![s.articleLevel, s.newsLevel, s.wordLevel].every((v) => inRange(v, 0, LEVELS.length - 1))) back(`Эрхийн түвшин 0–${LEVELS.length - 1} хооронд байна`);
  if (!inRange(s.approveArticle, 0, 1000) || !inRange(s.approveNews, 0, 1000)) back("Батлагдсаны урамшуулал 0–1000 оч");
  if (!Object.values(s.actReward).every((v) => inRange(v, 0, 5000))) back("Хуваалцах үйлдлийн оч 0–5000 хооронд байна");
  if (!Object.values(s.dailyPost).every(([a, b]) => inRange(a, 1, 1000) && inRange(b, a, 1000))) back("Өдрийн хязгаар 1–1000, дэмжигчийнх энгийнээс багагүй байна");
  if (!inRange(s.poolShare, 0, 100) || !inRange(s.tipFee, 0, 50)) back("Сангийн хувь 0–100%, шимтгэл 0–50% байна");
  if (!(Number.isFinite(s.qpayFee) && s.qpayFee >= 0 && s.qpayFee <= 10)) back("QPay-ийн шимтгэл 0–10% байна");
  s.qpayFee = Math.round(s.qpayFee * 10) / 10;
  if (!inRange(s.withdrawMin, 1000, 10000000)) back("Татах доод дүн 1,000–10,000,000₮");
  if (!s.plans.every((v) => inRange(v, 100, 10000000))) back("Дэмжигчийн үнэ 100₮-аас дээш байна");

  await saveSettings(s);
  const changed = Object.keys(s).filter((k) => JSON.stringify(s[k]) !== JSON.stringify(prev[k]));
  if (changed.length) await audit({ actorId: me.id, category: "settings", action: `Тохиргоо өөрчилсөн: ${changed.join(", ")}` });
  revalidatePath("/", "layout");
  back(changed.length ? "Тохиргоо хадгалагдлаа" : "Өөрчлөлт алга", true);
}
