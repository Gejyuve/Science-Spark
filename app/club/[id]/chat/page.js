import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { sql, ensureSchema } from "@/lib/db";
import { membershipOf } from "@/lib/clubs";
import { chatMessages, markChatRead } from "@/lib/chat";
import Shell from "../../../components/Shell";
import { ClubAv } from "../../../components/ClubBits";
import ClubChat from "../../../components/ClubChat";

export const dynamic = "force-dynamic";
export const metadata = { title: "Клубын чат · Science Spark" };

// Клубын чат — тусдаа хуудас (зөвхөн гишүүд)
export default async function ClubChatPage({ params }) {
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isInteger(id)) notFound();
  const user = await getUser();
  if (!user) redirect("/login");
  await ensureSchema();
  const [c] = await sql`
    SELECT c.id, c.name, c.logo_id, (SELECT COUNT(*) FROM club_members m WHERE m.club_id = c.id)::int AS members
    FROM clubs c WHERE c.id = ${id} AND c.kind = 'club' AND c.status = 'active'`;
  if (!c) notFound();
  const mine = await membershipOf(user.id);
  const isMember = mine?.club_id === id;
  const myReq = isMember ? null : (await sql`SELECT club_id FROM club_requests WHERE user_id = ${user.id}`)[0];
  const chat = isMember ? await chatMessages(id) : null;
  if (chat?.messages.length) await markChatRead(user.id, id, chat.messages.at(-1).id);

  return (
    <Shell user={user} active="/clubs" header={false}>
      <div className="cp-page ch-page">
        <Link href={`/club/${id}`} className="ch-back">← {c.name}</Link>
        <section className="cp-card ch-card">
          <div className="ch-head">
            <Link href={`/club/${id}`} className="ch-headlink"><ClubAv c={{ id: c.id, name: c.name, logo: c.logo_id }} size={40} /></Link>
            <span><b>{c.name} · Чат</b><small>{c.members} гишүүн · Зөвхөн гишүүд харна</small></span>
          </div>
          {chat ? (
            <ClubChat key={id} clubId={id} me={{ id: user.id, initial: user.initial, first_name: user.first_name, avatar: user.avatar }} isLeader={mine.role === "leader"} initial={chat.messages} more={chat.more} />
          ) : (
            <div className="ch-locked">
              <img className="ic" src="/icons/f_shield.svg" width={36} height={36} alt="" />
              <b>Чат зөвхөн клубын гишүүдэд нээлттэй</b>
              <span>Клубт нэгдсэнээр гишүүдтэйгээ шууд ярилцах боломжтой болно.</span>
              {myReq?.club_id === id ? <Link href={`/club/${id}/join`} className="cp-btn soft">⏳ Хүсэлт илгээсэн</Link>
                : <Link href={`/club/${id}/join`} className="cp-btn">+ Нэгдэх</Link>}
            </div>
          )}
        </section>
      </div>
    </Shell>
  );
}
