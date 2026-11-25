import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ensureSchema } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { loadSettings } from "@/lib/settings";
import { marketOpenFor } from "@/lib/merchant";
import { loadProduct } from "@/lib/market";
import { MERCHANT_TYPES } from "@/lib/merchant-shared";
import { PRODUCT_STATUS, PARCEL_SIZES, needsPost, fmtMnt } from "@/lib/market-shared";
import Shell from "../../components/Shell";
import MongolPost from "../MongolPost";
import Gallery from "../Gallery";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { id } = await params;
  try {
    const p = await loadProduct(Number(id) || 0);
    if (p?.status === "published") return { title: `${p.title} · Маркет · Science Spark` };
  } catch (e) {}
  return { title: "Маркет · Science Spark" };
}

// Бүтээгдэхүүний хуудас: зураг, үнэ, борлуулагчийн мэдээлэл, Монгол шуудангийн хүргэлт
export default async function ProductPage({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await getUser();
  if (!(await marketOpenFor(user))) redirect("/");
  await ensureSchema();
  const p = await loadProduct(Number(id) || 0);
  if (!p) notFound();
  const owner = user && p.user_id === user.id;
  const staff = user && ["admin", "superadmin"].includes(user.role);
  if (p.status !== "published" && !owner && !staff) notFound();
  const s = await loadSettings();
  const d = p.delivery || {};
  const post = needsPost(p.type);
  const size = PARCEL_SIZES.find(([k]) => k === d.size);
  const soldOut = !p.stock;

  return (
    <Shell user={user} header="nav">
      <div className="mk-page mk-view">
        {sp.ok && <p className="mc-flash ok">{sp.ok}</p>}
        {p.status !== "published" && (
          <p className="mc-flash warn">Урьдчилж харах · {PRODUCT_STATUS[p.status]?.[0]}{owner ? <> · <Link href={`/market/${p.id}/edit`}>Засах</Link></> : null}</p>
        )}
        <div className="mk-top">
          <Gallery ids={p.image_ids} title={p.title} />
          <section className="pf-card mk-buy">
            <small className="mk-type">{p.type}</small>
            <h1>{p.title}</h1>
            <b className="mk-price">{p.price ? fmtMnt(p.price) : "—"}</b>
            <p className="mk-stock">{soldOut ? "Дууссан" : `${p.stock} ширхэг үлдсэн`}</p>
            <button className="mc-btn mk-cta" disabled>Захиалга удахгүй нээгдэнэ</button>
            {post ? <MongolPost tariff={s.mongolPost || {}} weight={d.weight} compact /> : <div className="mk-digital"><b>Хүргэлт шаардлагагүй</b><span>Сайтаас болон и-мэйлээр хүлээн авна.</span></div>}
            {post && d.prep ? <p className="mc-note">Захиалгаас хойш {d.prep} өдөрт илгээнэ · {d.from}-аас</p> : null}
          </section>
        </div>

        <section className="pf-card">
          <h2>Тайлбар</h2>
          <p className="mk-desc">{p.description}</p>
          {post && (
            <dl className="mc-dl">
              {d.weight ? <div><dt>Илгээмжийн жин</dt><dd>{d.weight} кг</dd></div> : null}
              {size ? <div><dt>Хайрцаг</dt><dd>{size[1]} · {size[2]}</dd></div> : null}
            </dl>
          )}
        </section>

        <section className="pf-card mk-seller">
          <h2>Борлуулагч</h2>
          <dl className="mc-dl">
            <div><dt>Борлуулагч</dt><dd>{p.seller || "Мерчант бүртгэлгүй"}{p.shop_name ? ` · ${p.shop_name}` : ""}</dd></div>
            {p.m_type && <div><dt>Төрөл</dt><dd>{MERCHANT_TYPES[p.m_type]} · Мерчант №{p.m_id}</dd></div>}
            <div><dt>Буцаалтын нөхцөл</dt><dd>{p.return_policy || "Хэрэглэгчийн эрхийг хамгаалах тухай хуулийн дагуу"}</dd></div>
          </dl>
          <p className="mc-note">Энэ бүтээгдэхүүнийг дээрх мерчант борлуулна. Science Spark нь <Link href="/terms#market" className="mc-link">борлуулалтын зуучлагч</Link>. Чанар, хүргэлт, буцаалтыг мерчант хариуцна.</p>
        </section>
      </div>
    </Shell>
  );
}
