import { redirect } from "next/navigation";
import { ensureSchema } from "@/lib/db";
import { getUser, needsName } from "@/lib/auth";
import { loadSettings } from "@/lib/settings";
import { merchantOpenFor, loadMerchant } from "@/lib/merchant";
import { merchantStage } from "@/lib/market";
import Shell from "../../components/Shell";
import ProductForm from "../ProductForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Бүтээгдэхүүн байршуулах · Science Spark" };

export default async function NewProduct() {
  const user = await getUser();
  if (!user) redirect("/login?next=/market/new");
  if (needsName(user)) redirect("/profile/edit");
  if (user.is_bot || !(await merchantOpenFor(user))) redirect("/");
  await ensureSchema();
  const [s, m] = await Promise.all([loadSettings(), loadMerchant({ userId: user.id })]);
  return (
    <Shell user={user} header="nav">
      <div className="mc-page mk-page">
        <section className="pf-card mk-title"><small>Маркет</small><h1>Бүтээгдэхүүн байршуулах</h1></section>
        <ProductForm p={null} tariff={s.mongolPost || {}} stage={merchantStage(m)} />
      </div>
    </Shell>
  );
}
