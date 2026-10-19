// И-мейл илгээх: Resend (https://resend.com) — Vercel-д RESEND_API_KEY, MAIL_FROM тохируулна.
// MAIL_FROM нь Resend дээр баталгаажуулсан домэйнээс байна (жишээ: "Science Spark <no-reply@sciencespark.mn>").
export const mailReady = () => !!process.env.RESEND_API_KEY;

export async function sendMail({ to, subject, html, text }) {
  if (!mailReady()) throw new Error("RESEND_API_KEY тохируулаагүй");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.MAIL_FROM || "Science Spark <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
      text,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

// Холбоосонд ашиглах сайтын хаяг: хүсэлтийн Host толгойд найдахгүй (хуурамч домэйн руу линк явуулахаас сэргийлнэ).
export function siteUrl() {
  const u = process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) || "http://localhost:3000";
  return u.replace(/\/+$/, "");
}
