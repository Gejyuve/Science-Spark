import Link from "next/link";
import { notFound } from "next/navigation";
import { sql, ensureSchema } from "@/lib/db";
import { getUser } from "@/lib/auth";
import Shell from "../../../components/Shell";
import { Person, followingSet } from "../../../components/Bits";

export const dynamic = "force-dynamic";
export const metadata = { title: "Дагагчид · Science Spark" };

// Дагагчид, дагаж буй хүмүүсийн жагсаалт (хэн ч харна)
export default async function Followers({ params, searchParams }) {
  const { id } = await params;
  const { t } = await searchParams;
  const uid = Number(id);
  if (!Number.isInteger(uid)) notFound();
  await ensureSchema();
  const me = await getUser();
  const [u] = await sql`SELECT id, initial, first_name FROM users WHERE id = ${uid}`;
  if (!u) notFound();
  const mine = me?.id === uid;
  const tab = t === "following" ? "following" : "followers";
  const rows = tab === "followers"
    ? await sql`
        SELECT u.id, u.initial, u.first_name, u.avatar_id AS avatar,
          COALESCE((SELECT SUM(delta) FROM points_ledger WHERE user_id = u.id), 0)::int AS points,
          (SELECT COUNT(*) FROM follows x WHERE x.followee_id = u.id)::int AS followers
        FROM follows f JOIN users u ON u.id = f.follower_id
        WHERE f.followee_id = ${uid} ORDER BY f.created_at DESC`
    : await sql`
        SELECT u.id, u.initial, u.first_name, u.avatar_id AS avatar,
          COALESCE((SELECT SUM(delta) FROM points_ledger WHERE user_id = u.id), 0)::int AS points,
          (SELECT COUNT(*) FROM follows x WHERE x.followee_id = u.id)::int AS followers
        FROM follows f JOIN users u ON u.id = f.followee_id
        WHERE f.follower_id = ${uid} ORDER BY f.created_at DESC`;
  const [c] = await sql`SELECT (SELECT COUNT(*) FROM follows WHERE followee_id = ${uid})::int AS a, (SELECT COUNT(*) FROM follows WHERE follower_id = ${uid})::int AS b`;
  const following = await followingSet(me);

  return (
    <Shell user={me} header="nav">
      <div className="ss-card fl-page">
        {!mine && <Link href={`/u/${uid}`} className="infl-back">← {u.initial}.{u.first_name}</Link>}
        <h1>{tab === "followers" ? "Дагагчид" : "Дагаж буй"}</h1>
        <div className="ss-feedtabs fl-tabs">
          <Link href={`/u/${uid}/followers`} className={tab === "followers" ? "on" : ""}>Дагагчид {c.a}</Link>
          <Link href={`/u/${uid}/followers?t=following`} className={tab === "following" ? "on" : ""}>Дагаж буй {c.b}</Link>
        </div>
        {rows.length === 0 ? (
          <p className="ss-empty">{mine
            ? (tab === "followers" ? "Одоохондоо таныг дагасан хүн алга." : "Та одоохондоо хэнийг ч дагаагүй байна.")
            : (tab === "followers" ? "Одоохондоо дагагч алга." : "Одоохондоо хэнийг ч дагаагүй байна.")}</p>
        ) : (
          <div className="fl-list">
            {rows.map((p) => <Person key={p.id} {...p} viewer={me} following={following} />)}
          </div>
        )}
      </div>
    </Shell>
  );
}
