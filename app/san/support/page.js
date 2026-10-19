import Link from "next/link";
import { redirect } from "next/navigation";
import { sql, ensureSchema } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { DONATION_MIN, DONATION_MAX, TIP_FEE, fmtMnt } from "@/lib/money";
import { createSupport } from "../actions";
import Shell from "../../components/Shell";
import { Avatar } from "../../components/Bits";

export const dynamic = "force-dynamic";
export const metadata = { title: "Бичээчийг дэмжих · Science Spark" };

const pct = (x) => `${Math.round(x * 100)}%`;
const AMOUNTS = [5000, 10000, 20000, 50000];

// Бичээчид хандив өгөх хуудас. Дэмжигч болох, сан руу хандив нь шагналын сангийн цонхоор явна.
export default async function Support({ searchParams }) {
  const sp = await searchParams;
  if (sp.kind !== "tip") redirect("/san");
  const user = await getUser();
  if (!user) redirect("/login");
  await ensureSchema();
  let writer = null, post = null;
  const to = Number(sp.to);
  if (Number.isInteger(to)) [writer] = await sql`SELECT id, initial, first_name, avatar_id AS avatar FROM users WHERE id = ${to} AND first_name <> ''`;
  if (!writer) redirect("/san?error=" + encodeURIComponent("Бичээч олдсонгүй"));
  if (writer.id === user.id) redirect("/wallet");
  const p = Number(sp.post);
  if (Number.isInteger(p)) [post] = await sql`SELECT id, title FROM posts WHERE id = ${p} AND author_id = ${writer.id}`;

  return (
    <Shell user={user} active="/san" header="nav">
      <div className="ss-card och san">
        <Link href={post ? `/post/${post.id}` : "/san"} className="san-back">← Буцах</Link>
        {sp.error && <p className="och-note bad">{sp.error}</p>}
        <h1>Бичээчийг дэмжих</h1>
        <div className="san-to">
          <Avatar user={writer} size={44} />
          <span><b>{writer.initial}.{writer.first_name}</b>{post && <small>«{post.title}»</small>}</span>
        </div>
        <p className="och-sub">Таны хандив бичээчийн хэтэвчид орж, тэр цааш бичих урам авна. Сайтыг ажиллуулахад {pct(TIP_FEE)} шимтгэл суутгана.</p>

        <form action={createSupport} className="san-form">
          <input type="hidden" name="kind" value="tip" />
          <input type="hidden" name="writer_id" value={writer.id} />
          {post && <input type="hidden" name="post_id" value={post.id} />}
          <div className="san-amounts">
            {AMOUNTS.map((a) => (
              <label key={a} className="san-amt"><input type="radio" name="amount" value={a} defaultChecked={a === 10000} /><span>{fmtMnt(a)}</span></label>
            ))}
          </div>
          <label className="san-field">Өөр дүн (₮)
            <input name="amount_custom" inputMode="numeric" placeholder={`${fmtMnt(DONATION_MIN)} – ${fmtMnt(DONATION_MAX)}`} />
          </label>
          <label className="san-field">Захидал (заавал биш)
            <textarea name="message" maxLength={300} rows={2} placeholder="Бичээчдээ урам өгөх үг…" />
          </label>
          <label className="san-check"><input type="checkbox" name="anonymous" /> Нэрээ нууцлах</label>
          <button className="ss-pill">Хандив өгөх</button>
          <p className="och-hint">Дараагийн алхамд шилжүүлгийн код, дансны мэдээлэл гарна. Шилжүүлэг ирмэгц редакц баталгаажуулна.</p>
        </form>
      </div>
    </Shell>
  );
}
