import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ensureSchema } from "@/lib/db";
import { getUser, needsName } from "@/lib/auth";
import { loadSettings } from "@/lib/settings";
import { merchantOpenFor, loadMerchant } from "@/lib/merchant";
import { loadProduct, merchantStage } from "@/lib/market";
import { PRODUCT_STATUS, PRODUCT_EDITABLE } from "@/lib/market-shared";
import Shell from "../../../components/Shell";
import ProductForm from "../../ProductForm";
import AgreementStep from "../../AgreementStep";
import { ownerProduct } from "../../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Бүтээгдэхүүн засах · Science Spark" };

export default async function EditProduct({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await getUser();
  if (!user) redirect(`/login?next=/market/${id}/edit`);
  if (needsName(user)) redirect("/profile/edit");
  if (user.is_bot || !(await merchantOpenFor(user))) redirect("/");
  await ensureSchema();
  const p = await loadProduct(Number(id) || 0);
  if (!p || p.user_id !== user.id) notFound();
  const [s, m] = await Promise.all([loadSettings(), loadMerchant({ userId: user.id })]);
  const stage = merchantStage(m);
  const [label, tone] = PRODUCT_STATUS[p.status] || [p.status, "gray"];
  const editable = PRODUCT_EDITABLE.includes(p.status);
  // Гэрээний алхам: «Редакц руу илгээх» дарсны дараа эсвэл мерчантын бүртгэл эхэлсэн бол
  const showStep = editable && (sp.step === "agreement" || ["form", "sign"].includes(stage) || (stage === "ready" && sp.ok));
  const next = `/market/${p.id}/edit`;

  return (
    <Shell user={user} header="nav">
      <div className="mc-page mk-page">
        {sp.error && <p className="mc-flash bad">{sp.error}</p>}
        {sp.ok && <p className="mc-flash ok">{sp.ok}</p>}
        <section className="pf-card mc-status mk-title">
          <div className="mc-status-top">
            <div><small><Link href="/market?tab=mine">Миний бүтээгдэхүүн</Link></small><h1>{p.title || "Нэргүй бүтээгдэхүүн"}</h1></div>
            <span className={"mc-pill " + tone}>{label}</span>
          </div>
          {p.review_note && ["revision_required", "rejected", "hidden"].includes(p.status) && <p className="mc-review">{p.review_note}</p>}
          {p.status === "published" && <p className="mc-note">Засварлавал редакц дахин шалгаж нийтэлнэ. Тэр хооронд маркетад харагдахгүй.</p>}
          <div className="mk-owner">
            <Link href={`/market/${p.id}`} className="mc-btn ghost">Урьдчилж харах</Link>
            {p.status === "published" && <form action={ownerProduct}><input type="hidden" name="pid" value={p.id} /><button className="mc-btn ghost" name="act" value="hide">Маркетаас авах</button></form>}
            {["draft", "rejected", "hidden", "revision_required"].includes(p.status) && <form action={ownerProduct}><input type="hidden" name="pid" value={p.id} /><button className="mc-btn ghost danger" name="act" value="delete">Устгах</button></form>}
          </div>
        </section>
        {editable ? (
          <ProductForm p={p} tariff={s.mongolPost || {}} stage={stage} canDraft={p.status !== "published"} />
        ) : (
          <section className="pf-card"><p className="mc-note">Редакц шалгаж байна. Шийдвэр гармагц мэдэгдэл очно.</p></section>
        )}
        {showStep && <AgreementStep m={m} stage={stage} next={next} />}
      </div>
    </Shell>
  );
}
