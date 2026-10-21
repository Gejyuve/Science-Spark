import { notFound, redirect } from "next/navigation";
import { sql, ensureSchema } from "@/lib/db";
import { getUser } from "@/lib/auth";
import Shell from "../../../components/Shell";
import { InfluencePage } from "../../../components/Influence";

export const dynamic = "force-dynamic";
export const metadata = { title: "Нөлөөлөл · Science Spark" };

// Энэ клубээс Science Spark-ийн тухай сонсоод нэгдсэн хүмүүс (бүгд харна)
export default async function Influence({ params }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  await ensureSchema();
  const me = await getUser();
  const [c] = await sql`SELECT id, name, kind FROM clubs WHERE id = ${id} AND status = 'active'`;
  if (!c) notFound();
  // Мэдэгдлээс ирэхэд клуб, байгууллага ялгагдахгүй тул байгууллагыг өөрийнх нь хуудас руу шилжүүлнэ
  if (c.kind === "org") redirect(`/org/${id}/influence`);
  return (
    <Shell user={me} active="/clubs" header="nav">
      <InfluencePage kind="club" targetId={id} name={c.name} back={`/club/${id}`} me={me} mine={false} />
    </Shell>
  );
}
