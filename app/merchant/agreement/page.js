import Link from "next/link";
import { redirect } from "next/navigation";
import { ensureSchema } from "@/lib/db";
import { getUser, needsName } from "@/lib/auth";
import { loadSettings } from "@/lib/settings";
import { companyReady } from "@/lib/company";
import { merchantOpenFor, loadMerchant } from "@/lib/merchant";
import { ensureAgreement, getAgreement, listAgreements, AGREEMENT_STATUS } from "@/lib/merchant-agreement";
import Shell from "../../components/Shell";
import AgreementDoc from "./AgreementDoc";
import SignPanel from "./SignPanel";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Мерчантын гэрээ · Science Spark" };

const when = (d) => (d ? new Date(d).toLocaleString("sv-SE", { timeZone: "Asia/Ulaanbaatar" }).slice(0, 10).replaceAll("-", ".") : "—");

// Мерчантын гэрээ: унших, хэвлэх, и-мэйл кодоор баталгаажуулах, өмнөх гэрээнүүд
export default async function MerchantAgreementPage({ searchParams }) {
  const sp = await searchParams;
  const user = await getUser();
  if (!user) redirect("/login?next=/merchant/agreement");
  if (needsName(user)) redirect("/profile/edit");
  if (user.is_bot || !(await merchantOpenFor(user))) redirect("/");
  await ensureSchema();
  const m = await loadMerchant({ userId: user.id });
  if (!m) redirect("/merchant");

  const s = await loadSettings();
  // Платформын мэдээлэл бүрэн үед л шинэ гэрээ бэлдэнэ (хоосон талтай гэрээ үүсгэхгүй)
  if (companyReady(s.company)) await ensureAgreement(m, s.company);
  const list = await listAgreements(m.id);
  const pick = Number(sp.id) || 0;
  const row = pick ? list.find((r) => r.id === pick) : list.find((r) => r.status !== "superseded" && r.status !== "terminated") || list[0];
  const a = row ? await getAgreement(row.id) : null;
  const [label, tone] = a ? AGREEMENT_STATUS[a.status] || [a.status, "gray"] : [];

  return (
    <Shell user={user} header="nav">
      <div className="mc-page ag-page">
        {sp.error && <p className="mc-flash bad">{sp.error}</p>}
        {sp.ok && <p className="mc-flash ok">{sp.ok}</p>}
        <section className="pf-card mc-status ag-head">
          <div className="mc-status-top">
            <div>
              <small><Link href="/merchant">Мерчант</Link>{a ? ` · ${a.number}` : ""}</small>
              <h1>Мерчантын гэрээ</h1>
            </div>
            {a && <span className={"mc-pill " + tone}>{label}</span>}
          </div>
          {!a && <p className="mc-note">{m.status !== "approved" ? "Бүртгэл баталгаажсаны дараа гэрээ байгуулна." : !m.bank ? "Баталгаажсан банкны данс шаардлагатай." : "Гэрээ бэлтгэгдэж байна. Бэлэн болмогц мэдэгдэнэ."}</p>}
          {a?.status === "pending_platform" && <p className="mc-note">Платформын төлөөлөгч баталгаажуулмагц гэрээ хүчин төгөлдөр болно.</p>}
          {a && <div className="ag-tools"><PrintButton /></div>}
        </section>

        {a && <AgreementDoc a={a} />}
        {a?.status === "pending_merchant" && m.status === "approved" && <SignPanel aid={a.id} hash={a.content_hash} />}

        {list.length > 1 && (
          <section className="pf-card">
            <h2>Гэрээнүүд</h2>
            <ul className="mc-hist">
              {list.map((r) => (
                <li key={r.id}>
                  <b>{r.id === a?.id ? r.number : <Link href={`/merchant/agreement?id=${r.id}`}>{r.number}</Link>} · хувилбар {r.version}</b>
                  <small>{AGREEMENT_STATUS[r.status]?.[0]} · {when(r.platform_signed_at || r.merchant_signed_at || r.created_at)}</small>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Shell>
  );
}
