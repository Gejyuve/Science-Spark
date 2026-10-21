import { notFound } from "next/navigation";
import { sql, ensureSchema } from "@/lib/db";
import { getUser } from "@/lib/auth";
import Shell from "../../../components/Shell";
import { InfluencePage } from "../../../components/Influence";

export const dynamic = "force-dynamic";
export const metadata = { title: "Нөлөөлөл · Science Spark" };

// Энэ хүнээс Science Spark-ийн тухай сонсоод нэгдсэн хүмүүс (бүгд харна)
export default async function Influence({ params }) {
  const uid = Number((await params).id);
  if (!Number.isInteger(uid)) notFound();
  await ensureSchema();
  const me = await getUser();
  const [u] = await sql`SELECT id, initial, first_name FROM users WHERE id = ${uid}`;
  if (!u) notFound();
  return (
    <Shell user={me} header="nav">
      <InfluencePage kind="person" targetId={uid} name={`${u.initial}.${u.first_name}`} back={`/u/${uid}`} me={me} mine={me?.id === uid} />
    </Shell>
  );
}
