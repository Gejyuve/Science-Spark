import Link from "next/link";
import { redirect } from "next/navigation";
import { ensureSchema } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { marketOpenFor } from "@/lib/merchant";
import { listPublished, listMine } from "@/lib/market";
import { PRODUCT_TYPES, PRODUCT_STATUS, fmtMnt } from "@/lib/market-shared";
import Shell from "../components/Shell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Маркет · Science Spark" };

// Маркет: нийтлэгдсэн бүтээгдэхүүн, «Миний бүтээгдэхүүн»
export default async function MarketPage({ searchParams }) {
  const sp = await searchParams;
  const user = await getUser();
  if (!(await marketOpenFor(user))) redirect("/");
  await ensureSchema();
  const mine = sp.tab === "mine" && user;
  const type = PRODUCT_TYPES.includes(sp.t) ? sp.t : null;
  const rows = mine ? await listMine(user.id) : await listPublished({ type });
  const add = user ? "/market/new" : "/login?next=/market/new";

  return (
    <Shell user={user} header="nav">
      <div className="mk-page">
        {sp.ok && <p className="mc-flash ok">{sp.ok}</p>}
        <section className="pf-card mk-head">
          <div>
            <h1>Маркет</h1>
            <p className="mc-note">Шинжлэх ухааны ном, хэрэгсэл, тасалбар. Монгол шуудангаар хүргэнэ.</p>
          </div>
          <Link href={add} className="mc-btn">Бүтээгдэхүүн байршуулах</Link>
        </section>
        <nav className="mk-tabs" aria-label="Ангилал">
          <Link href="/market" className={!mine && !type ? "on" : ""}>Бүгд</Link>
          {PRODUCT_TYPES.map((t) => <Link key={t} href={`/market?t=${encodeURIComponent(t)}`} className={type === t ? "on" : ""}>{t}</Link>)}
          {user && <Link href="/market?tab=mine" className={"mk-mine" + (mine ? " on" : "")}>Миний бүтээгдэхүүн</Link>}
        </nav>
        {rows.length === 0 ? (
          <section className="pf-card"><p className="mc-note">{mine ? "Та одоогоор бүтээгдэхүүн байршуулаагүй байна." : "Одоохондоо бүтээгдэхүүн алга."} <Link href={add} className="mc-link">Бүтээгдэхүүн байршуулах</Link></p></section>
        ) : (
          <div className="mk-grid">
            {rows.map((p) => (
              <Link key={p.id} href={mine ? `/market/${p.id}/edit` : `/market/${p.id}`} className="mk-card">
                <span className="mk-card-img">{p.image_ids?.[0] ? <img src={`/img/${p.image_ids[0]}`} alt="" loading="lazy" /> : null}</span>
                <span className="mk-card-body">
                  <b>{p.title || "Нэргүй"}</b>
                  <strong>{p.price ? fmtMnt(p.price) : "—"}</strong>
                  {mine ? <em className={"mc-pill " + (PRODUCT_STATUS[p.status]?.[1] || "gray")}>{PRODUCT_STATUS[p.status]?.[0]}</em> : <small>{p.shop_name || p.seller}</small>}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}
