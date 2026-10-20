import { sql, ensureSchema } from "@/lib/db";
import { syncQpay } from "@/lib/payments";

export const dynamic = "force-dynamic";

// QPay төлбөр орсны дараа энэ хаягийг дуудна (?code=SS-XXXXXX). Callback-ийн агуулгад итгэхгүй:
// нэхэмжлэхийг QPay-ээс өөрөөс нь шалгаж, төлөгдсөн бол баталгаажуулна.
async function handle(req) {
  const code = new URL(req.url).searchParams.get("code") || "";
  if (/^SS-[A-Z0-9]{6}$/.test(code)) {
    try {
      await ensureSchema();
      const [r] = await sql`SELECT * FROM payment_requests WHERE code = ${code}`;
      if (r) await syncQpay(r);
    } catch (e) {
      console.error("QPay callback", e.message);
    }
  }
  return new Response("SUCCESS", { status: 200, headers: { "Content-Type": "text/plain" } });
}

export const GET = handle;
export const POST = handle;
