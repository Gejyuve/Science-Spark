import { redirect } from "next/navigation";
import TopNav from "../../components/TopNav";
import { sql, ensureSchema } from "@/lib/db";
import { getUser, needsName } from "@/lib/auth";
import EntityForm from "../../components/EntityForm";
import EntityGate, { leaderInfo } from "../../components/EntityGate";

export const dynamic = "force-dynamic";
export const metadata = { title: "Байгууллага бүртгүүлэх · Science Spark" };

// Figma 349:528 «Байгууллагаар бүртгүүлэх»
export default async function NewOrg() {
  const user = await getUser();
  if (user && needsName(user)) redirect("/profile/edit");
  if (user) await ensureSchema();
  return (
    <div className="wr-page">
      <span className="au-blob a" aria-hidden="true" />
      <span className="au-blob b" aria-hidden="true" />
      <TopNav className="wr-nav" />
      {!user ? (
        <EntityGate icon="torg" title="Хувь хүний бүртгэл шаардлагатай" text="Байгууллагыг түүнийг төлөөлөх хувь хүн бүртгүүлж, админ нь болдог. Эхлээд өөрийн бүртгэлээр нэвтэрнэ үү." />
      ) : (
        <EntityForm kind="org" leader={await leaderInfo(sql, user)} />
      )}
    </div>
  );
}
