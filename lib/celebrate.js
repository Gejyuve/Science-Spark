import { cookies } from "next/headers";
import { sql } from "./db";
import { levelFor, nextLevel } from "./levels";

// Контент илгээсний дараах баярын цонх (app/components/Celebrate.js).
// Сервер үйлдэл богино настай күүки тавина, хөтөч уншаад цонхоо гаргаж, күүкийг устгана.
export const CELEBRATE_COOKIE = "ss_yay";
export const FIRST_REWARD = 50; // анхны хариулт, үг, нийтлэл тус бүрт нэг удаа
// Анхны удаагийн урамшуулалтай үйлдлүүд (points_ledger.reason = "first:<key>")
export const FIRST_KEYS = { answer: "Анхны хариулт", word: "Анхны үг", article: "Анхны нийтлэл" };

// Анхны удаагийн урамшуулал: нэг хүнд түлхүүр бүрт нэг л удаа. Олгосон бол дүнг буцаана.
export async function firstReward(userId, key) {
  const r = await sql`INSERT INTO points_ledger (user_id, delta, reason)
                      SELECT ${userId}, ${FIRST_REWARD}, ${"first:" + key}
                      WHERE NOT EXISTS (SELECT 1 FROM points_ledger WHERE user_id = ${userId} AND reason = ${"first:" + key})
                      RETURNING delta`;
  return r.length ? FIRST_REWARD : 0;
}

// Энэ урамшууллыг аль хэдийн авсан эсэх (редакц батлахад олгогдох урамшууллыг урьдчилан харуулахад)
export async function hadFirst(userId, key) {
  return (await sql`SELECT 1 FROM points_ledger WHERE user_id = ${userId} AND reason = ${"first:" + key} LIMIT 1`).length > 0;
}

// kind: контентын төрөл; status: published | pending | discussion
// earned: одоо олгосон оч [[шошго, оч]], later: батлагдвал олгогдох оч [[шошго, оч]]
// ask: шагналгүй асуулт { id, w: хэтэвчийн үлдэгдэл } бол цонхонд шагнал нэмэх санал гарна
export async function celebrate(user, { kind, status, title = "", href = null, earned = [], later = [], ask = null }) {
  const gain = earned.reduce((s, [, v]) => s + v, 0);
  const before = user.points || 0;
  const after = before + gain;
  const lv = levelFor(after);
  const nx = nextLevel(after);
  const data = {
    k: kind, s: status, t: String(title).slice(0, 80), h: href, e: earned, l: later, a: ask,
    p: after, g: gain, lv: { n: lv.n, name: lv.name, c: lv.color, min: lv.min, perk: lv.perkLocked ? null : lv.perk }, nx: nx ? { n: nx.n, name: nx.name, min: nx.min } : null,
    up: levelFor(before).n < lv.n,
  };
  (await cookies()).set(CELEBRATE_COOKIE, Buffer.from(JSON.stringify(data)).toString("base64url"), { path: "/", maxAge: 120, sameSite: "lax" });
}
