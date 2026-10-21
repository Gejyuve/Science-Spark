import { notFound } from "next/navigation";
import { sql, ensureSchema } from "@/lib/db";
import { getUser } from "@/lib/auth";
import Shell from "../../../components/Shell";
import { InfluencePage } from "../../../components/Influence";

export const dynamic = "force-dynamic";
export const metadata = { title: "Нөлөөлөл · Science Spark" };

// Энэ байгууллагаас Science Spark-ийн тухай сонсоод нэгдсэн хүмүүс (бүгд харна)
export default async function Influence({ params }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  await ensureSchema();
  const me = await getUser();
  const [c] = await sql`SELECT id, name FROM clubs WHERE id = ${id} AND kind = 'org' AND status = 'active'`;
  if (!c) notFound();
  return (
    <Shell user={me} header="nav">
      <InfluencePage kind="org" targetId={id} name={c.name} back={`/org/${id}`} me={me} mine={false} />
    </Shell>
  );
}
