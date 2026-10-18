import EntityEdit from "../../../components/EntityEdit";

export const dynamic = "force-dynamic";
export const metadata = { title: "Клуб засах · Science Spark" };

export default async function EditClub({ params }) {
  const { id } = await params;
  return <EntityEdit id={Number(id) || 0} kind="club" />;
}
