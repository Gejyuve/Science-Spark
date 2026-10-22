import Link from "next/link";
import { defaultCover } from "@/lib/covers";
import { notFound, redirect } from "next/navigation";
import { sql, ensureSchema } from "@/lib/db";
import { getUser, needsName } from "@/lib/auth";
import { membershipOf, cooldownOf, rewardBalance, hadFirstReward, JOIN_REWARD, ymd } from "@/lib/clubs";
import { fmtK } from "../../../components/Bits";
import { ClubAv } from "../../../components/ClubBits";
import { cancelRequest } from "../../../clubs/actions";
import EntityGate from "../../../components/EntityGate";
import JoinForm from "./JoinForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Клубт нэгдэх · Science Spark" };

const SOC = { facebook: "s_fb", instagram: "s_ig", x: "s_x", linkedin: "s_li", youtube: "s_yt" };

// Figma 404:242 / 416:254 / 422:260 «Клубт нэгдэх» (анх, хориотой, шилжих)
export default async function Join({ params }) {
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isInteger(id)) notFound();
  const user = await getUser();
  if (user && needsName(user)) redirect("/profile/edit");
  await ensureSchema();
  const [c] = await sql`
    SELECT c.*, (COALESCE((SELECT SUM(l.delta) FROM points_ledger l JOIN club_members m ON m.user_id = l.user_id WHERE m.club_id = c.id), 0)
      + COALESCE((SELECT SUM(k.delta) FROM club_points k WHERE k.club_id = c.id), 0))::int AS points,
      (SELECT COUNT(*) FROM club_members m WHERE m.club_id = c.id)::int AS members
    FROM clubs c WHERE c.id = ${id} AND c.kind = 'club' AND c.status = 'active'`;
  if (!c) notFound();

  let mine = null, cd = null, pending = null, lose = false, first = true, blockMsg = null;
  if (user) {
    mine = await membershipOf(user.id);
    if (mine?.club_id === id) redirect(`/club/${id}`);
    cd = await cooldownOf(user.id);
    pending = (await sql`SELECT r.club_id, c.name FROM club_requests r JOIN clubs c ON c.id = r.club_id WHERE r.user_id = ${user.id}`)[0] || null;
    lose = mine ? Math.max(0, await rewardBalance(user.id)) : 0; // хасагдах оч
    first = !(await hadFirstReward(user.id));
    if (user.restricted_at) blockMsg = "Таны эрх хязгаарлагдсан тул клубт нэгдэх боломжгүй.";
    else if (mine?.role === "leader") blockMsg = `Та «${mine.name}» клубийн удирдагч тул өөр клубт шилжих боломжгүй.`;
    else if (cd) blockMsg = `Та ${ymd(cd.since)}-нд ${cd.from ? `«${cd.from}» клубээс ` : ""}гарсан тул ${ymd(cd.until)} хүртэл өөр клубт нэгдэх боломжгүй.`;
  }
  const socials = Object.entries(c.socials || {}).filter(([k, v]) => SOC[k] && v);

  return (
    <div className="wr-page jn-page">
      <span className="au-blob a" aria-hidden="true" />
      <span className="au-blob b" aria-hidden="true" />
      <div className="jn-top"><Link href="/" className="jn-home"><img src="/icons/logo.svg" width={32} height={32} alt="Нүүр" /></Link></div>
      <section className="jn-card">
        <Link href={`/club/${id}`} className="jn-x" aria-label="Хаах">×</Link>
        <p className="jn-quote"><b><img src="/icons/flame.svg" width={16} height={16} alt="" /> Ганц мод гал болохгүй</b><small>- Ардын зүйр үг</small></p>
        <div className="jn-club">
          <div className="jn-cover"><img src={c.cover_id ? `/img/${c.cover_id}` : defaultCover(c.id)} alt="" /></div>
          <span className="jn-logo"><ClubAv c={{ id: c.id, name: c.name, logo: c.logo_id }} size={44} /></span>
          <div className="jn-body">
            <b>{c.name}</b>
            <span className="jn-stat"><span><img src="/icons/spark.svg" width={14} height={14} alt="" />{fmtK(c.points)} оч</span><span><img className="ic" src="/icons/followers.svg" width={12} height={12} alt="" />{c.members} гишүүн</span></span>
            {c.category && <span className="jn-row"><img className="ic" src="/icons/f_tag.svg" width={16} height={16} alt="" />{c.category}</span>}
            <span className="jn-row"><img className="ic" src="/icons/f_pin.svg" width={16} height={16} alt="" />{[c.city, c.country].filter(Boolean).join(", ")}</span>
            <p>{c.about}</p>
            {socials.length > 0 && <span className="jn-socs">{socials.map(([k, v]) => <a key={k} href={v} target="_blank" rel="noopener nofollow"><img src={`/icons/${SOC[k]}.svg`} width={14} height={14} alt={k} /></a>)}</span>}
          </div>
        </div>

        {!user ? (
          <EntityGate title="Хувь хүний бүртгэл шаардлагатай" text="Клубт нэгдэхийн тулд эхлээд өөрийн бүртгэлээр нэвтэрнэ үү." />
        ) : pending ? (
          <>
            <p className="jn-box ok"><img src="/icons/sparkle.svg" width={16} height={16} alt="" /><span>{pending.club_id === id ? "Таны нэгдэх хүсэлт илгээгдсэн. Клубийн удирдагч шийдвэрлэхийг хүлээнэ үү." : `Та «${pending.name}» клубт нэгдэх хүсэлт илгээсэн байна. Нэг удаад нэг л хүсэлт илгээх боломжтой. Энэ клубт хүсэлт илгээвэл өмнөх хүсэлт тань цуцлагдана.`}</span></p>
            {pending.club_id === id ? (
              <form action={cancelRequest} className="jn-form"><input type="hidden" name="club_id" value={id} /><button type="submit" className="jn-back">Хүсэлтээ цуцлах</button></form>
            ) : <JoinForm clubId={id} blocked={!!blockMsg} rules={c.rules} />}
          </>
        ) : (
          <>
            {blockMsg && <p className="jn-box bad"><span className="jn-ic">⛔</span><span>{blockMsg}</span></p>}
            {!blockMsg && mine && (
              <p className="jn-box warn"><span className="jn-ic">⚠</span><span>Та одоо «{mine.name}» клубийн гишүүн байна. «{c.name}»-д нэгдсэнээр «{mine.name}»-аас гишүүнчлэл хасагдана{lose ? `, ${lose} оч хасагдана` : ""}. Шинэ клубт оч олгогдохгүй. Дараа нь 1 сарын дотор дахин шилжих боломжгүй.</span></p>
            )}
            {mine || !first ? (
              <div className={"jn-reward minus" + (blockMsg ? " dim" : "")}>
                <img src="/icons/sparkle.svg" width={18} height={18} alt="" />
                <span><b>{mine && lose ? `Анхны клубээсээ л оч авдаг. Шилжих тул ${lose} оч хасагдана` : `Анхны клубээсээ л ${JOIN_REWARD} оч авдаг`}</b><small>Клуб өөрийн оч байхгүй, гишүүдийн очийн нийлбэр харагдана. Таны оч шилжсэн клубт нэмэгдэж харагдана.</small></span>
                <em>{mine && lose ? `−${lose}` : "0"}</em>
              </div>
            ) : (
              <div className="jn-reward">
                <img src="/icons/sparkle.svg" width={18} height={18} alt="" />
                <span><b>Клубт нэгдсэнээр та {JOIN_REWARD} оч авна</b><small>Клуб өөрийн оч байхгүй, гишүүдийн очийн нийлбэр харагдана. Таны оч клубт нэмэгдэж харагдана.</small></span>
                <em>+{JOIN_REWARD}</em>
              </div>
            )}
            <JoinForm clubId={id} blocked={!!blockMsg} rules={c.rules} />
          </>
        )}
      </section>
    </div>
  );
}
