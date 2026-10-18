import EntityEdit from "../../../components/EntityEdit";

export const dynamic = "force-dynamic";
export const metadata = { title: "Байгууллага засах · Science Spark" };

export default async function EditOrg({ params }) {
  const { id } = await params;
  return <EntityEdit id={Number(id) || 0} kind="org" />;
}
