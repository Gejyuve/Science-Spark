import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSection } from "@/lib/admin";
import { loadSettings } from "@/lib/settings";
import { loadMerchant, canSell } from "@/lib/merchant";
import { loadProduct } from "@/lib/market";
import { MERCHANT_STATUS } from "@/lib/merchant-shared";
import { PRODUCT_STATUS, PARCEL_SIZES, needsPost, fmtMnt, feeOf } from "@/lib/market-shared";
import Head, { Chip, Flash } from "../../_c/Head";
import MongolPost from "@/app/market/MongolPost";
import { decideProduct } from "../actions";

const ACTS = [
  ["approve", "Нийтлэх", "teal", ["pending_review", "hidden"]],
  ["revise", "Засвар хүсэх", "", ["pending_review"]],
  ["reject", "Татгалзах", "danger", ["pending_review"]],
  ["hide", "Маркетаас нуух", "danger", ["published"]],
];

export default async function AdminProduct({ params, searchParams }) {
  const user = await requireSection("products");
  const { id } = await params;
  const { ok, error } = await searchParams;
  const p = await loadProduct(Number(id) || 0);
  if (!p) notFound();
  const [m, s] = await Promise.all([p.merchant_id ? loadMerchant({ id: p.merchant_id }) : null, loadSettings()]);
  const sellable = canSell(m);
  const acts = ACTS.filter(([, , , st]) => st.includes(p.status));
  const d = p.delivery || {};
  const sup = user.role === "superadmin";

  return (
    <>
      <Head user={user} title={p.title || "Нэргүй"} sub={`${p.type || "—"} · ${p.seller || "мерчант бүртгэлгүй"}`}
        tools={<><Link href="/admin/products" className="adm-btn">← Жагсаалт</Link><Link href={`/market/${p.id}`} className="adm-btn">Хуудсыг харах</Link></>} />
      <Flash ok={ok} error={error} />

      <section className="adm-card mca-top">
        <Chip tone={PRODUCT_STATUS[p.status]?.[1]}>{PRODUCT_STATUS[p.status]?.[0]}</Chip>
        <small>Мерчант: {m ? <>{MERCHANT_STATUS[m.status]?.[0]} · гэрээ {m.agreement ? "хүчинтэй" : m.agreementOpen ? "платформ баталгаажуулаагүй" : "алга"}{sup ? <> · <Link href={`/admin/merchants/${m.id}`}>мерчант №{m.id}</Link></> : null}</> : "бүртгэлгүй"}</small>
        {!sellable && p.status === "pending_review" && <p className="adm-muted">Нийтлэхийн өмнө супер админ мерчантыг баталж, гэрээг платформын нэрийн өмнөөс баталгаажуулна.</p>}
        {acts.length > 0 && (
          <form action={decideProduct} className="mca-acts">
            <input type="hidden" name="pid" value={p.id} />
            <textarea name="note" maxLength={1000} rows={2} placeholder="Борлуулагчид харагдах тайлбар (засвар, татгалзах, нуухад заавал)" />
            <div>{acts.map(([a, l, tone]) => <button key={a} className={"adm-btn " + tone} name="act" value={a}>{l}</button>)}</div>
          </form>
        )}
      </section>

      <div className="adm-grid2">
        <section className="adm-card">
          <div className="adm-card-head"><b>Мэдээлэл</b></div>
          <div className="mka-imgs">{p.image_ids.map((i) => <a key={i} href={`/img/${i}`} target="_blank" rel="noopener"><img src={`/img/${i}`} alt="" /></a>)}</div>
          <dl className="mca-dl">
            <div><dt>Үнэ</dt><dd>{p.price ? `${fmtMnt(p.price)} (шимтгэл ${fmtMnt(feeOf(p.price))})` : "—"}</dd></div>
            <div><dt>Тоо ширхэг</dt><dd>{p.stock ?? "—"}</dd></div>
            <div><dt>Буцаалт</dt><dd>{p.return_policy || "—"}</dd></div>
          </dl>
          <p className="mka-desc">{p.description}</p>
        </section>
        <section className="adm-card">
          <div className="adm-card-head"><b>Хүргэлт</b></div>
          {needsPost(p.type) ? (
            <>
              <MongolPost tariff={s.mongolPost || {}} weight={d.weight} />
              <dl className="mca-dl">
                <div><dt>Жин</dt><dd>{d.weight ? `${d.weight} кг` : "—"}</dd></div>
                <div><dt>Хайрцаг</dt><dd>{PARCEL_SIZES.find(([k]) => k === d.size)?.slice(1).join(" · ") || "—"}</dd></div>
                <div><dt>Илгээх газар</dt><dd>{d.from || "—"}</dd></div>
                <div><dt>Бэлтгэх</dt><dd>{d.prep ? `${d.prep} өдөр` : "—"}</dd></div>
              </dl>
            </>
          ) : <p className="adm-muted">Цахим бүтээгдэхүүн, хүргэлтгүй.</p>}
        </section>
      </div>
    </>
  );
}
