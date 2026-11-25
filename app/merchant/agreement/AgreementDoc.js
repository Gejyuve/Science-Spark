import { MERCHANT_TYPES } from "@/lib/merchant-shared";

const LETTERS = "абвгдеёжзиклмнопрстуфхцчшщэюя";
const when = (d) => (d ? new Date(d).toLocaleString("sv-SE", { timeZone: "Asia/Ulaanbaatar" }).slice(0, 16).replaceAll("-", ".") : null);

// Заалтыг дугаарлана: 1.1, 1.2..., «• »-ээр эхэлсэн дэд заалт а), б)...
function clauses(n, items) {
  const out = [];
  let k = 0, sub = 0;
  for (const t of items) {
    if (t.startsWith("• ")) out.push({ sub: true, no: `${LETTERS[sub++]})`, text: t.slice(2) });
    else { sub = 0; out.push({ sub: false, no: `${n}.${++k}.`, text: t }); }
  }
  return out;
}

function Row({ k, v }) {
  return v ? <tr><th>{k}</th><td>{v}</td></tr> : null;
}

// Мерчантын гэрээний эх (хадгалсан хуулбараас). Мерчант болон админ хоёул ашиглана. Хэвлэхэд A4.
export default function AgreementDoc({ a }) {
  const c = a.content;
  const pl = c.platform || {};
  const me = c.merchant || {};
  const biz = me.type === "business";
  return (
    <article className="tm-doc ag-doc ag-print">
      {c.draft && <p className="ag-draft">DRAFT · Хуульч, нягтлан бодогч батлах хүртэл төсөл</p>}
      <h1>{c.title}</h1>
      <p className="tm-meta">Гэрээний дугаар {c.number} · Хувилбар {c.version}</p>

      <h2>Гэрээний талууд</h2>
      <p>Нэг талаас <b>{pl.name}</b> (цаашид «Платформ» гэх), нөгөө талаас <b>{me.name}</b> (цаашид «Мерчант» гэх) нар Монгол Улсын Иргэний хууль болон холбогдох хууль тогтоомжийг үндэслэн энэхүү гэрээг байгуулав.</p>
      <div className="ag-parties">
        <table>
          <caption>Платформ</caption>
          <tbody>
            <Row k="Нэр" v={pl.name} />
            <Row k="Регистр" v={pl.register_no} />
            <Row k="Улсын бүртгэл" v={pl.state_reg_no} />
            <Row k="Хаяг" v={pl.address} />
            <Row k="Утас" v={pl.phone} />
            <Row k="И-мэйл" v={pl.email} />
            <Row k="Төлөөлөгч" v={pl.rep_name && `${pl.rep_name}${pl.rep_position ? `, ${pl.rep_position}` : ""}`} />
          </tbody>
        </table>
        <table>
          <caption>Мерчант · {MERCHANT_TYPES[me.type]}</caption>
          <tbody>
            <Row k={biz ? "Нэр" : "Овог, нэр"} v={me.name} />
            <Row k="Регистр" v={me.register_no} />
            <Row k="Улсын бүртгэл" v={me.state_reg_no} />
            <Row k="Хаяг" v={me.address} />
            <Row k="Утас" v={me.phone} />
            <Row k="И-мэйл" v={me.email} />
            {biz && <Row k="Төлөөлөгч" v={me.rep_name && `${me.rep_name}${me.rep_position ? `, ${me.rep_position}` : ""}${me.rep_basis ? ` (${me.rep_basis})` : ""}`} />}
            <Row k="ТТД" v={me.tax_id} />
            <Row k="НӨАТ төлөгч" v={me.vat_payer ? "Тийм" : "Үгүй"} />
            <Row k="Банкны данс" v={c.bank && `${c.bank.bank_name} ${c.bank.account_no}, ${c.bank.holder_name}`} />
          </tbody>
        </table>
      </div>

      {c.sections.map(([title, items], i) => (
        <section key={title}>
          <h2>{i + 1}. {title}</h2>
          {clauses(i + 1, items).map((x) => <p key={x.no + x.text} className={x.sub ? "tm-sub" : ""}><span>{x.no}</span>{x.text}</p>)}
        </section>
      ))}

      <h2>Баталгаажуулалт</h2>
      <div className="ag-parties ag-signs">
        <table>
          <caption>Платформын нэрийн өмнөөс</caption>
          <tbody>
            <Row k="Төлөөлөгч" v={pl.rep_name || "—"} />
            <tr><th>Огноо</th><td>{when(a.platform_signed_at) || "Баталгаажаагүй"}</td></tr>
          </tbody>
        </table>
        <table>
          <caption>Мерчант</caption>
          <tbody>
            <Row k={biz ? "Төлөөлөгч" : "Овог, нэр"} v={(biz ? me.rep_name : me.name) || "—"} />
            <tr><th>Огноо</th><td>{when(a.merchant_signed_at) || "Баталгаажаагүй"}</td></tr>
          </tbody>
        </table>
      </div>
      <p className="ag-hash">Баримтын hash (SHA-256): {a.content_hash}</p>
    </article>
  );
}
