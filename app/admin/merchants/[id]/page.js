import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireSection } from "@/lib/admin";
import { loadMerchant } from "@/lib/merchant";
import { MERCHANT_TYPES, MERCHANT_STATUS, BANK_STATUS, DOC_KINDS, DOC_MIME, INDIVIDUAL_FIELDS, BUSINESS_FIELDS, merchantName } from "@/lib/merchant-shared";
import Head, { Chip, Flash } from "../../_c/Head";
import { decideMerchant, decideBank } from "../actions";

const when = (d) => (d ? new Date(d).toLocaleString("sv-SE", { timeZone: "Asia/Ulaanbaatar" }).slice(0, 16).replaceAll("-", ".") : "—");
const kb = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1000))}KB`);

// Шийдвэр: [үйлдэл, товчны нэр, өнгө, ямар төлөвт харагдах]
const ACTS = [
  ["approve", "Батлах", "teal", ["pending_review"]],
  ["revise", "Засвар хүсэх", "", ["pending_review"]],
  ["reject", "Татгалзах", "danger", ["pending_review", "revision_required"]],
  ["reinstate", "Эрхийг сэргээх", "teal", ["suspended"]],
  ["suspend", "Түр түдгэлзүүлэх", "danger", ["approved"]],
  ["terminate", "Гэрээ дуусгавар болгох", "danger", ["approved", "suspended"]],
];

// Админ > Мерчант > нэг мерчант: бүх мэдээлэл, баримт, данс, түүх, шийдвэр
export default async function AdminMerchant({ params, searchParams }) {
  const user = await requireSection("merchants");
  if (user.role !== "superadmin") redirect("/admin");
  const { id } = await params;
  const { ok, error } = await searchParams;
  const m = await loadMerchant({ id: Number(id) || 0 });
  if (!m) notFound();
  const fields = m.type === "business" ? BUSINESS_FIELDS : INDIVIDUAL_FIELDS;
  const p = m.type === "business" ? m.business : m.individual;
  const acts = ACTS.filter(([, , , st]) => st.includes(m.status));
  const docOf = (k) => m.docs.filter((d) => d.kind === k);

  return (
    <>
      <Head user={user} title={merchantName(m)} sub={`Мерчант №${m.id} · ${MERCHANT_TYPES[m.type]}${m.shop_name ? ` · ${m.shop_name}` : ""}`}
        tools={<Link href="/admin/merchants" className="adm-btn">← Жагсаалт</Link>} />
      <Flash ok={ok} error={error} />

      <section className="adm-card mca-top">
        <Chip tone={MERCHANT_STATUS[m.status]?.[1]}>{MERCHANT_STATUS[m.status]?.[0]}</Chip>
        <small>Илгээсэн: {when(m.submitted_at)} · Шийдвэрлэсэн: {when(m.reviewed_at)}{m.user_id ? <> · Хэрэглэгч: <Link href={`/u/${m.user_id}`}>профайл</Link></> : null}</small>
        {m.review_note && <p className="adm-muted">Сүүлийн тайлбар: {m.review_note}</p>}
        {acts.length > 0 && (
          <form action={decideMerchant} className="mca-acts">
            <input type="hidden" name="mid" value={m.id} />
            <textarea name="note" maxLength={1000} rows={2} placeholder="Мерчантад харагдах тайлбар (засвар хүсэх, татгалзах, түдгэлзүүлэхэд заавал)" />
            <div>{acts.map(([a, l, tone]) => <button key={a} className={"adm-btn " + tone} name="act" value={a}>{l}</button>)}</div>
            {m.status === "pending_review" && <p className="adm-muted small">Батлахад илгээсэн банкны данс мөн баталгаажна. Регистр, баримт, дансны нэрийг шалгаад батлаарай.</p>}
          </form>
        )}
      </section>

      <div className="adm-grid2">
        <section className="adm-card">
          <div className="adm-card-head"><b>{m.type === "business" ? "Байгууллагын мэдээлэл" : "Хувийн мэдээлэл"}</b></div>
          <dl className="mca-dl">
            {fields.map(([k, label]) => <div key={k}><dt>{label}</dt><dd>{p[k] || "—"}</dd></div>)}
            <div><dt>Дэлгүүрийн нэр</dt><dd>{m.shop_name || "—"}</dd></div>
            <div><dt>Бүтээгдэхүүний төрөл</dt><dd>{m.product_types.join(", ") || "—"}</dd></div>
            <div><dt>НӨАТ төлөгч</dt><dd>{m.vat_payer ? "Тийм" : "Үгүй"}</dd></div>
            <div><dt>Татвар төлөгчийн дугаар</dt><dd>{m.tax_id || "—"}</dd></div>
          </dl>
        </section>

        <section className="adm-card">
          <div className="adm-card-head"><b>Банкны данс</b></div>
          {m.banks.length === 0 && <p className="adm-empty">Данс бүртгээгүй.</p>}
          <ul className="mca-banks">
            {m.banks.map((b) => (
              <li key={b.id} className={b.status}>
                <span><b>{b.bank_name} · {b.account_no}</b><small>{b.holder_name} · {b.currency} · {when(b.created_at)}{b.proof_doc_id ? <> · <a href={`/api/merchant/doc/${b.proof_doc_id}`} target="_blank" rel="noopener">баримт</a></> : ""}{b.note ? ` · ${b.note}` : ""}</small></span>
                <Chip tone={BANK_STATUS[b.status]?.[1]}>{BANK_STATUS[b.status]?.[0]}</Chip>
              </li>
            ))}
          </ul>
          {m.pendingBank && ["approved", "suspended"].includes(m.status) && (
            <form action={decideBank} className="mca-acts">
              <input type="hidden" name="mid" value={m.id} />
              <input name="note" maxLength={500} placeholder="Татгалзах шалтгаан (мерчантад харагдана)" />
              <div><button className="adm-btn teal" name="act" value="verify">Шинэ дансыг баталгаажуулах</button><button className="adm-btn danger" name="act" value="reject">Татгалзах</button></div>
              <p className="adm-muted small">Данс эзэмшигчийн нэр {m.type === "business" ? "байгууллагын албан ёсны нэр" : "мерчантын овог, нэр"}тэй таарч байгааг шалгана уу. Гуравдагч этгээдийн данс зөвшөөрөхгүй.</p>
            </form>
          )}
        </section>

        <section className="adm-card">
          <div className="adm-card-head"><b>Баримт бичиг</b></div>
          {Object.entries(DOC_KINDS).filter(([, d]) => d.types.includes(m.type)).map(([k, d]) => (
            <div key={k} className="mca-doc">
              <small>{d.label}{d.need?.includes(m.type) ? " · заавал" : ""}</small>
              {docOf(k).length ? docOf(k).map((x) => (
                <a key={x.id} href={`/api/merchant/doc/${x.id}`} target="_blank" rel="noopener">{DOC_MIME[x.mime]} · {x.file_name} · {kb(x.size)}</a>
              )) : <span className="adm-muted">—</span>}
            </div>
          ))}
          <p className="adm-muted small">Баримт нээх бүр аудит логт бичигдэнэ.</p>
        </section>

        <section className="adm-card">
          <div className="adm-card-head"><b>Төлөвийн түүх</b></div>
          <ul className="mca-log">
            {m.log.map((l) => (
              <li key={l.id}>
                <b>{l.from_status ? `${MERCHANT_STATUS[l.from_status]?.[0] || l.from_status} → ` : ""}{MERCHANT_STATUS[l.to_status]?.[0] || l.to_status}</b>
                <small>{when(l.created_at)}{l.first_name ? ` · ${l.initial}.${l.first_name}` : ""}{l.note ? ` · ${l.note}` : ""}</small>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
