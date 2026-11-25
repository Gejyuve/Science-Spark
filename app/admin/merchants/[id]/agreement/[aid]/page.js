import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireSection } from "@/lib/admin";
import { sql } from "@/lib/db";
import { loadSettings } from "@/lib/settings";
import { companyMissing } from "@/lib/company";
import { getAgreement, hashContent, AGREEMENT_STATUS } from "@/lib/merchant-agreement";
import Head, { Chip, Flash } from "../../../../_c/Head";
import AgreementDoc from "@/app/merchant/agreement/AgreementDoc";
import PrintButton from "@/app/merchant/agreement/PrintButton";
import { signPlatform } from "../../../actions";

const when = (d) => (d ? new Date(d).toLocaleString("sv-SE", { timeZone: "Asia/Ulaanbaatar" }).slice(0, 19).replaceAll("-", ".") : "—");

// Админ > Мерчант > гэрээ: эх, баталгаажуулалтын бүртгэл, платформын нэрийн өмнөөс баталгаажуулах
export default async function AdminAgreement({ params, searchParams }) {
  const user = await requireSection("merchants");
  if (user.role !== "superadmin") redirect("/admin");
  const { id, aid } = await params;
  const { ok, error } = await searchParams;
  const a = await getAgreement(Number(aid) || 0);
  if (!a || a.merchant_id !== Number(id)) notFound();
  const acc = await sql`SELECT c.*, u.initial, u.first_name FROM agreement_acceptances c LEFT JOIN users u ON u.id = c.user_id
                        WHERE c.agreement_id = ${a.id} ORDER BY c.id`;
  const missing = companyMissing((await loadSettings()).company);
  const intact = hashContent(a.content) === a.content_hash;
  const [label, tone] = AGREEMENT_STATUS[a.status] || [a.status, "gray"];

  return (
    <>
      <Head user={user} title={`Гэрээ ${a.number}`} sub={`${a.content.merchant?.name} · хувилбар ${a.version}${a.is_draft ? " · DRAFT" : ""}`}
        tools={<><Link href={`/admin/merchants/${id}`} className="adm-btn">← Мерчант</Link><PrintButton className="adm-btn" /></>} />
      <Flash ok={ok} error={error} />

      <section className="adm-card mca-top ag-noprint">
        <Chip tone={tone}>{label}</Chip>
        <small>Hash: {intact ? "таарч байна" : "ТААРАХГҮЙ"} · Үүсгэсэн {when(a.created_at)}{a.ended_at ? ` · Дууссан ${when(a.ended_at)}` : ""}</small>
        {acc.length > 0 && (
          <ul className="mca-log">
            {acc.map((c) => (
              <li key={c.id}>
                <b>{c.party === "merchant" ? "Мерчант" : "Платформ"} · {c.first_name ? `${c.initial}.${c.first_name}` : `#${c.user_id}`}</b>
                <small>{when(c.created_at)} · {c.method}{c.ip ? ` · IP ${c.ip}` : ""}</small>
              </li>
            ))}
          </ul>
        )}
        {a.status === "pending_platform" && (
          missing.length ? (
            <p className="adm-muted">Платформын нэрийн өмнөөс баталгаажуулахын өмнө <Link href="/admin/settings#company">Тохиргоо › Компанийн мэдээлэл</Link>-ийг бөглөнө үү: {missing.join(", ")}.</p>
          ) : (
            <form action={signPlatform} className="mca-acts">
              <input type="hidden" name="mid" value={a.merchant_id} />
              <input type="hidden" name="aid" value={a.id} />
              <label className="ag-check"><input type="checkbox" name="confirm" /> <span>Гэрээг уншиж танилцсан. Платформын эрх бүхий төлөөлөгчийн хувиар баталгаажуулж байна.</span></label>
              <div><button className="adm-btn teal">Платформын нэрийн өмнөөс баталгаажуулах</button></div>
            </form>
          )
        )}
      </section>

      <AgreementDoc a={a} />
    </>
  );
}
