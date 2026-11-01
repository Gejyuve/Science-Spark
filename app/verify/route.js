import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { checkVerifyToken, createUser, createSession } from "@/lib/auth";
import { loadSettings } from "@/lib/settings";
import { notify } from "@/lib/notify";
import { siteUrl } from "@/lib/mail";

export const dynamic = "force-dynamic";

// И-мэйл дэх баталгаажуулах холбоос: хүлээгдэж буй бүртгэлийг жинхэнэ хэрэглэгч болгож, нэвтрүүлээд
// профайл үүсгэх хуудас руу оруулна. Бусад тохиолдолд нэвтрэх цонх руу шалтгаантай нь буцаана.
export async function GET(req) {
  const go = (path) => NextResponse.redirect(`${siteUrl()}${path}`, 303);
  const res = await checkVerifyToken(new URL(req.url).searchParams.get("t"));
  if (!res) return go("/login?verify=bad");
  const { email, pending } = res;
  if (!pending) {
    // Холбоосыг аль хэдийн ашигласан (жишээ нь и-мэйлийн програм урьдчилж нээсэн) бол нэвтрэхийг санал болгоно.
    const [u] = await sql`SELECT 1 FROM users WHERE email = ${email}`;
    return go(u ? "/login?verify=done" : "/login?verify=bad");
  }
  const banned = await sql`SELECT 1 FROM banned_emails WHERE email = ${email}`;
  if (banned.length || !(await loadSettings()).registrationOpen) {
    await sql`DELETE FROM pending_signups WHERE email = ${email}`;
    return go("/login?verify=closed");
  }
  const id = await createUser(email, pending.password_hash);
  await sql`DELETE FROM pending_signups WHERE email = ${email}`;
  if (!id) return go("/login?verify=done");
  await notify({ userId: id, kind: "email_ok" });
  await createSession(id);
  return go("/profile/edit");
}
