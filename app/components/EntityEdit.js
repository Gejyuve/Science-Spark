import { notFound, redirect } from "next/navigation";
import TopNav from "./TopNav";
import { sql, ensureSchema } from "@/lib/db";
import { getUser, displayName } from "@/lib/auth";
import EntityForm from "./EntityForm";
import { leaderInfo } from "./EntityGate";

// Клуб, байгууллагын мэдээлэл засах (зөвхөн удирдагч/админ)
export default async function EntityEdit({ id, kind }) {
  const user = await getUser();
  if (!user) redirect("/login");
  await ensureSchema();
  const [c] = await sql`SELECT * FROM clubs WHERE id = ${id} AND kind = ${kind} AND status = 'active'`;
  if (!c) notFound();
  if (c.leader_id !== user.id) redirect(`/${kind}/${id}`);
  let board = [];
  if (kind === "club") {
    const rows = await sql`
      SELECT u.id, u.initial, u.first_name, u.avatar_id AS avatar, p.job, false AS invited FROM club_members m JOIN users u ON u.id = m.user_id
        LEFT JOIN profiles p ON p.user_id = u.id WHERE m.club_id = ${id} AND m.role = 'board'
      UNION ALL
      SELECT u.id, u.initial, u.first_name, u.avatar_id AS avatar, p.job, true AS invited FROM club_invites i JOIN users u ON u.id = i.user_id
        LEFT JOIN profiles p ON p.user_id = u.id WHERE i.club_id = ${id}`;
    board = rows.map((r) => ({ id: r.id, name: displayName(r), avatar: r.avatar, job: r.job || "", keep: true, invited: r.invited }));
  }
  const entity = { ...c, founded: c.founded ? new Date(c.founded).toISOString() : null, created_at: undefined, updated_at: undefined };
  return (
    <div className="wr-page">
      <span className="au-blob a" aria-hidden="true" />
      <span className="au-blob b" aria-hidden="true" />
      <TopNav className="wr-nav" active={kind === "club" ? "/clubs" : undefined} />
      <EntityForm kind={kind} entity={entity} board={board} leader={await leaderInfo(sql, user)} />
    </div>
  );
}
