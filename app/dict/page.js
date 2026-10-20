import Link from "next/link";
import { sql, ensureSchema } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { TERM_KIND, ALPHABET, canApproveWords } from "@/lib/terms";
import Shell from "../components/Shell";
import DictAdd from "../components/DictAdd";
import { TermCard } from "../components/Terms";
import { followingSet } from "../components/Bits";

export const dynamic = "force-dynamic";
export const metadata = { title: "Толь · Science Spark" };

const PAGE = 10;

export default async function DictPage({ searchParams }) {
  const user = await getUser();
  const { tab, l, q = "", n } = await searchParams;
  await ensureSchema();
  const disc = tab === "discuss";
  const letter = ALPHABET.includes(l) ? l : null;
  const term = String(q).trim().slice(0, 80);
  const limit = Math.min(100, Math.max(PAGE, Number(n) || PAGE));
  const uid = user ? user.id : 0;

  const [stats] = await sql`
    SELECT COUNT(*) FILTER (WHERE status = 'published')::int AS total,
           COUNT(*) FILTER (WHERE status = 'published' AND COALESCE((meta->>'approved_at')::timestamptz, reviewed_at) > date_trunc('month', now()))::int AS month,
           COUNT(*) FILTER (WHERE status = 'discussion')::int AS discussing
    FROM posts WHERE kind = ${TERM_KIND}`;

  let rows = [];
  let list = null; // үсэг, хайлтын жагсаалт
  if (letter || term) {
    const like = `%${term.replace(/[%_\\]/g, "\\$&")}%`;
    list = await sql`
      SELECT p.id, p.title, p.body, p.meta, p.created_at, p.reviewed_at,
             (SELECT COUNT(*) FROM comments WHERE post_id = p.id)::int AS comments
      FROM posts p
      WHERE p.kind = ${TERM_KIND} AND p.status = 'published'
        AND (${!letter}::boolean OR upper(left(translate(p.title, 'өүёӨҮЁ', 'оуеОУЕ'), 1)) = ${letter})
        AND (${!term}::boolean OR p.title ILIKE ${like} OR p.body ILIKE ${like} OR p.meta->>'en' ILIKE ${like} OR p.meta->>'ru' ILIKE ${like})
      ORDER BY lower(p.title) LIMIT 200`;
  } else {
    rows = await sql`
      SELECT p.id, p.author_id, p.title, p.body, p.meta, p.status, p.created_at, p.reviewed_at,
             u.initial, u.first_name, u.avatar_id AS avatar,
             COALESCE((SELECT SUM(delta) FROM points_ledger WHERE user_id = u.id), 0)::int AS author_points,
             (SELECT COUNT(*) FROM follows WHERE followee_id = u.id)::int AS author_followers,
             (SELECT COUNT(*) FROM sparks WHERE post_id = p.id)::int AS sparks,
             (SELECT COUNT(*) FROM comments WHERE post_id = p.id)::int AS comments,
             (SELECT COUNT(*) FROM term_votes WHERE post_id = p.id AND vote = 1)::int AS up,
             (SELECT COUNT(*) FROM term_votes WHERE post_id = p.id AND vote = -1)::int AS down,
             (SELECT vote FROM term_votes WHERE post_id = p.id AND user_id = ${uid}) AS my_vote,
             EXISTS (SELECT 1 FROM saves WHERE post_id = p.id AND user_id = ${uid}) AS saved,
             tc.id AS tc_id, tc.body AS tc_body, tc.author_id AS tc_author, tc.initial AS tc_initial, tc.first_name AS tc_first, tc.avatar AS tc_avatar
      FROM posts p JOIN users u ON u.id = p.author_id
      LEFT JOIN LATERAL (
        SELECT c.id, c.body, c.author_id, cu.initial, cu.first_name, cu.avatar_id AS avatar
        FROM comments c JOIN users cu ON cu.id = c.author_id
        WHERE c.post_id = p.id AND c.parent_id IS NULL
        ORDER BY (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id) DESC, c.created_at DESC LIMIT 1
      ) tc ON true
      WHERE p.kind = ${TERM_KIND} AND p.status = ${disc ? "discussion" : "published"}
      ORDER BY CASE WHEN ${disc}::boolean THEN p.created_at END DESC NULLS LAST,
               COALESCE((p.meta->>'approved_at')::timestamptz, p.reviewed_at, p.created_at) DESC
      LIMIT ${limit + 1}`;
  }
  const more = rows.length > limit;
  rows = rows.slice(0, limit);
  const following = await followingSet(user);
  const dates = rows.map((r) => r.meta?.approved_at || r.reviewed_at || r.created_at);
  const base = (extra) => `/dict${extra ? `?${extra}` : ""}`;
  const back = base([disc && "tab=discuss", n && `n=${n}`].filter(Boolean).join("&"));
  const nextLetter = letter ? ALPHABET[ALPHABET.indexOf(letter) + 1] : null;

  return (
    <Shell user={user} active="/dict" header="nav">
      <section className="tl-hero">
        <div className="tl-hero-main">
          <h1>Шинжлэх ухааны нэр томьёоны толь</h1>
          <p>Бүгдээрээ хэлэлцвэл буруугүй, бүлээн усаар угаавал хиргүй</p>
          <div className="tl-hero-acts">
            <DictAdd className="tl-add" loggedIn={!!user} />
            {/* 5-р түвшнээс дээш хэрэглэгч шинэ үг зөвшөөрнө (нийтлэл хянах эрх биш) */}
            {canApproveWords(user) && <Link href="/review?t=words" className="tl-add ghost">Шинэ үг зөвшөөрөх</Link>}
          </div>
        </div>
        <div className="tl-stat">
          <small>Толь дахь нэр томьёо</small>
          <span className="tl-stat-n"><img src="/icons/dict.svg" width={26} height={26} alt="" />{stats.total.toLocaleString("en-US")}</span>
          <small className="tl-stat-g">Энэ сард +{stats.month} · Хэлэлцэж буй {stats.discussing}</small>
        </div>
        <i className="tl-star a" aria-hidden="true" /><i className="tl-star b" aria-hidden="true" /><i className="tl-star c" aria-hidden="true" /><i className="tl-star d" aria-hidden="true" />
      </section>

      <div className="tl-bar1">
        <Link href="/dict" className={!disc && !letter && !term ? "on" : ""}>Сүүлд батлагдсан</Link>
        <Link href="/dict?tab=discuss" className={disc ? "on" : ""}>Хэлэлцэж буй үгс <em>{stats.discussing}</em></Link>
        <span className="ss-grow" />
        <form action="/dict" method="get" className="tl-search" role="search">
          <img className="ic" src="/icons/search.svg" width={15} height={15} alt="" />
          <input name="q" defaultValue={term} placeholder="Нэр томьёо хайх…" aria-label="Нэр томьёо хайх" />
        </form>
      </div>
      <nav className="tl-abc" aria-label="Үсгээр">
        {ALPHABET.map((a) => <Link key={a} href={`/dict?l=${encodeURIComponent(a)}`} className={letter === a ? "on" : ""}>{a}</Link>)}
      </nav>

      {list ? (
        <div className="tl-list">
          <div className="tl-list-head">
            <span className="tl-sq">{letter || <img src="/icons/search.svg" width={16} height={16} alt="" />}</span>
            <span>
              <b>{letter ? `«${letter}» үсгээр эхэлсэн нэр томьёо` : `"${term}" хайлтын үр дүн`}</b>
              <small>{list.length} нэр томьёо · үсгийн дарааллаар</small>
            </span>
          </div>
          {list.length === 0 && (
            <p className="tl-empty">{letter ? "Энэ үсгээр эхэлсэн нэр томьёо одоохондоо алга." : "Олдсонгүй."} Та анхных нь болж <b>Үг нэмэх</b> товчоор санал болгоорой.</p>
          )}
          {list.map((t) => (
            <Link key={t.id} href={`/post/${t.id}`} className="tl-row">
              <span className="tl-row-t"><b>{t.title}</b><small>{t.meta?.en}</small></span>
              <span className="tl-row-d">{t.body.length > 90 ? t.body.slice(0, 90).replace(/\s+\S*$/, "") + "…" : t.body}</span>
              <span className="tl-row-m">{fmtDate(t.meta?.approved_at || t.reviewed_at || t.created_at)}</span>
              <span className="tl-row-c"><img className="ic" src="/icons/comment18.svg" width={15} height={15} alt="" />{t.comments}</span>
              <img className="ic tl-row-ch" src="/icons/arrow.svg" width={14} height={14} alt="" />
            </Link>
          ))}
          {nextLetter && <Link href={`/dict?l=${encodeURIComponent(nextLetter)}`} className="tl-next">Дараагийн үсэг: {nextLetter} →</Link>}
        </div>
      ) : (
        <>
          <div className="tl-sechead">
            {disc ? (
              <>
                <b className="tl-orange"><img src="/icons/f_clock.svg" width={15} height={15} alt="" />Хэлэлцэж буй үгс · саналаа өгч, сэтгэгдлээ үлдээнэ үү</b>
                <small>{rows.length} үг</small>
              </>
            ) : (
              <>
                <b><span className="tl-check">✓</span>Сүүлд батлагдаж нэмэгдсэн үгс</b>
                {dates.length > 0 && <small>{fmtDate(dates[0])}{dates.length > 1 ? ` – ${fmtDate(dates[dates.length - 1])}` : ""}</small>}
              </>
            )}
          </div>
          {rows.length === 0 && (
            <div className="ss-card"><p className="ss-empty">
              {disc ? "Одоохондоо хэлэлцэж буй үг алга. Шинэ нэр томьёо санал болгоод хэлэлцүүлэг эхлүүлээрэй ✦" : "Одоохондоо батлагдсан нэр томьёо алга. Хэлэлцэж буй үгсэд саналаа өгч, Толь-ийг хамтдаа бүтээцгээе ✦"}
            </p></div>
          )}
          {rows.map((t) => <TermCard key={t.id} t={t} user={user} following={following} back={back} />)}
          {more && <Link href={base([disc && "tab=discuss", `n=${limit + PAGE}`].filter(Boolean).join("&"))} className="tl-more" scroll={false}>{disc ? "Бусад үгсийг харах" : "Өмнөх үгсийг харах"}</Link>}
        </>
      )}
    </Shell>
  );
}
