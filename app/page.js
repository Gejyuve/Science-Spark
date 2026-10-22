import Link from "next/link";
import crypto from "node:crypto";
import { getUser } from "@/lib/auth";
import { sql, ensureSchema } from "@/lib/db";
import Shell from "./components/Shell";
import PostCard from "./components/PostCard";
import { followingSet } from "./components/Bits";
import { clubFollowSet } from "@/lib/clubs";
import TimeMenu from "./components/TimeMenu";
import ScrollActive from "./components/ScrollActive";
import { fmtMnt } from "@/lib/money";
import { withTopComments } from "@/lib/top-comments";

export const dynamic = "force-dynamic";

// [утга, нэр, цаг]
const PERIODS = [["24h", "24 цаг", 24], ["7d", "7 хоног", 168], ["1m", "1 сар", 720], ["6m", "6 сар", 4320], ["1y", "1 жил", 8760], ["all", "Бүх хугацаа", null]];

export default async function Home({ searchParams }) {
  const { tab, compose, error, f, t, b } = await searchParams;
  // Цагийн шүүлтүүр: анхдагч 7 хоног
  const period = PERIODS.find((x) => x[0] === t) || PERIODS[1];
  const hours = period[2];
  const tq = period[0] === "7d" ? "" : `t=${period[0]}`;
  const qa = f === "qa"; // Асуулт ба бодрол · сүүлд орсноор
  // «Хэн юу гэв?» доторх шүүлтүүр: open = хариулт хүлээж буй шагналтай асуулт, big = бүх шагналтай асуулт дүнгээр нь
  const bq = qa && ["open", "big"].includes(b) ? b : "";
  const ann = f === "ann"; // Зарлалууд
  const art = f === "art"; // Нийтлэл
  const news = f === "news"; // Мэдээ
  const club = f === "club"; // Клуб: даалгавар, тайлан
  const top = f === "top"; // Сонгосон хугацаанд хамгийн их оч авсан
  const rand = f === "rand"; // Санамсаргүй: хэрэглэгч бүрт, дарах бүрт өөр дараалал
  const seed = crypto.randomUUID();
  const following = tab === "following";
  let user = null;
  let posts = [];
  let counts = { all: 0, following: 0, top: 0, qa: 0, ann: 0, art: 0, news: 0, club: 0 };
  let bqCounts = { open: 0, total: 0 };
  try {
    user = await getUser();
    await ensureSchema();
    posts = await sql`
      -- Хамгийн тод: тухайн хугацааны очийг нэг удаа нийлүүлнэ (нийтлэл бүрт тусад нь тоолохгүй)
      WITH win AS (
        SELECT s.post_id, COUNT(*)::int AS n FROM sparks s
        WHERE ${top}::boolean AND (${hours}::int IS NULL OR s.created_at > now() - make_interval(hours => ${hours}::int))
        GROUP BY s.post_id
      )
      SELECT p.id, p.author_id, p.kind, p.title, p.subtitle, p.body, p.meta, p.image_id, p.views, p.created_at, p.category, u.initial, u.first_name, u.avatar_id AS avatar,
        p.club_id, cl.name AS club_name, cl.logo_id AS club_logo, cl.kind AS club_kind,
        CASE WHEN p.club_id IS NOT NULL THEN (SELECT COUNT(*) FROM club_follows cf WHERE cf.club_id = p.club_id)::int END AS club_followers,
        CASE WHEN p.club_id IS NOT NULL THEN (COALESCE((SELECT SUM(l.delta) FROM points_ledger l JOIN club_members m ON m.user_id = l.user_id WHERE m.club_id = p.club_id), 0)
          + COALESCE((SELECT SUM(k.delta) FROM club_points k WHERE k.club_id = p.club_id), 0))::int END AS club_points,
        (p.club_id IS NOT NULL AND EXISTS (SELECT 1 FROM club_members cm WHERE cm.club_id = p.club_id AND cm.user_id = ${user ? user.id : 0})) AS own_club,
        (SELECT COUNT(*) FROM sparks WHERE post_id = p.id)::int AS sparks,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id)::int AS comments,
        COALESCE((SELECT SUM(delta) FROM points_ledger WHERE user_id = u.id), 0)::int AS author_points,
        (SELECT COUNT(*) FROM follows WHERE followee_id = u.id)::int AS author_followers,
        EXISTS (SELECT 1 FROM saves WHERE post_id = p.id AND user_id = ${user ? user.id : 0}) AS saved,
        EXISTS (SELECT 1 FROM sparks WHERE post_id = p.id AND user_id = ${user ? user.id : 0}) AS sparked,
        bq.amount AS bounty_amount, bq.status AS bounty_status
      FROM posts p JOIN users u ON u.id = p.author_id
      LEFT JOIN clubs cl ON cl.id = p.club_id
      LEFT JOIN bounties bq ON bq.post_id = p.id AND bq.status IN ('open', 'awarded')
      LEFT JOIN win ON win.post_id = p.id
      WHERE p.status = 'published' AND p.kind <> 'Үг'
        AND (NOT ${qa}::boolean OR p.kind IN ('Асуулт', 'Бодрол'))
        AND (NOT ${ann}::boolean OR p.kind = 'Зарлал')
        AND (NOT ${art}::boolean OR p.kind = 'Нийтлэл')
        AND (NOT ${news}::boolean OR p.kind = 'Мэдээ')
        AND (NOT ${club}::boolean OR p.kind IN ('Даалгавар', 'Тайлан'))
        AND (${bq} = '' OR bq.status = 'open' OR (${bq} = 'big' AND bq.status IS NOT NULL))
        -- Цагийн шүүлтүүр (санамсаргүй, шагналтай асуултад хамаарахгүй). Хамгийн тод: тухайн хугацаанд оч авсан
        AND (${rand}::boolean OR ${bq} <> '' OR (CASE WHEN ${top}::boolean
             THEN win.post_id IS NOT NULL
             ELSE (${hours}::int IS NULL OR p.created_at > now() - make_interval(hours => ${hours}::int)) END))
        AND (${!following || !user}::boolean OR p.author_id IN
             (SELECT followee_id FROM follows WHERE follower_id = ${user ? user.id : 0}))
      ORDER BY
        -- Санамсаргүй: үзээгүй контент нь эхэнд, дотроо холилдсон
        CASE WHEN ${rand}::boolean THEN EXISTS (SELECT 1 FROM post_views v WHERE v.post_id = p.id AND v.viewer = ${user ? "u:" + user.id : ""}) END ASC NULLS LAST,
        CASE WHEN ${rand}::boolean THEN md5(p.id::text || ${seed}) END ASC NULLS LAST,
        CASE WHEN ${top}::boolean THEN win.n END DESC NULLS LAST,
        CASE WHEN ${top}::boolean THEN (SELECT COUNT(*) FROM sparks WHERE post_id = p.id) END DESC NULLS LAST,
        CASE WHEN ${bq} = 'big' THEN bq.amount END DESC NULLS LAST,
        p.created_at DESC
      LIMIT 30`;
    await withTopComments(posts);
    // Шүүлтүүр бүрийн сонгосон хугацааны контентын тоо
    const [c] = await sql`
      SELECT
        COUNT(*) FILTER (WHERE (${hours}::int IS NULL OR p.created_at > now() - make_interval(hours => ${hours}::int)))::int AS all,
        COUNT(*) FILTER (WHERE (${hours}::int IS NULL OR p.created_at > now() - make_interval(hours => ${hours}::int))
          AND p.author_id IN (SELECT followee_id FROM follows WHERE follower_id = ${user ? user.id : 0}))::int AS following,
        -- Хугацаандаа оч авсан контент: бүх нийтлэлийг нэг бүрчлэн шалгахын оронд тухайн хугацааны очноос эхэлж тоолно
        (SELECT COUNT(DISTINCT s.post_id) FROM sparks s JOIN posts sp ON sp.id = s.post_id
         WHERE sp.status = 'published' AND sp.kind <> 'Үг'
           AND (${hours}::int IS NULL OR s.created_at > now() - make_interval(hours => ${hours}::int)))::int AS top,
        COUNT(*) FILTER (WHERE (${hours}::int IS NULL OR p.created_at > now() - make_interval(hours => ${hours}::int)) AND p.kind IN ('Асуулт', 'Бодрол'))::int AS qa,
        COUNT(*) FILTER (WHERE (${hours}::int IS NULL OR p.created_at > now() - make_interval(hours => ${hours}::int)) AND p.kind = 'Зарлал')::int AS ann,
        COUNT(*) FILTER (WHERE (${hours}::int IS NULL OR p.created_at > now() - make_interval(hours => ${hours}::int)) AND p.kind = 'Нийтлэл')::int AS art,
        COUNT(*) FILTER (WHERE (${hours}::int IS NULL OR p.created_at > now() - make_interval(hours => ${hours}::int)) AND p.kind = 'Мэдээ')::int AS news,
        COUNT(*) FILTER (WHERE (${hours}::int IS NULL OR p.created_at > now() - make_interval(hours => ${hours}::int)) AND p.kind IN ('Даалгавар', 'Тайлан'))::int AS club
      FROM posts p WHERE p.status = 'published' AND p.kind <> 'Үг'`;
    counts = c;
    if (qa) {
      const [x] = await sql`
        SELECT COUNT(*) FILTER (WHERE b.status = 'open')::int AS open, COALESCE(SUM(b.amount), 0)::bigint AS total
        FROM bounties b JOIN posts p ON p.id = b.post_id AND p.status = 'published'
        WHERE b.status IN ('open', 'awarded')`;
      bqCounts = { open: x.open, total: Number(x.total) };
    }
  } catch (e) {
    // Өгөгдлийн сан холбогдоогүй үед нүүр хуудас хэвийн нээгдэнэ
  }

  const followSet = await followingSet(user);
  const clubFollows = posts.some((p) => p.club_id) ? await clubFollowSet(user) : null;
  return (
    <Shell user={user} active={qa ? "qa" : top ? "top" : rand ? "rand" : "/"} compose={["Асуулт", "share", "Бодрол", "Эвент", "Зарлал"].includes(compose) ? compose : null} composeError={error}>
      {(
        <nav className="ss-filters" aria-label="Шүүлтүүр">
          <div className="ss-fscroll">
            {[
              ["all", "", "Бүгд", counts.all],
              ["ann", "f=ann", "Гоё юм дуулгая", counts.ann],
              ["top", "f=top", "Хамгийн тод", counts.top],
              ["qa", "f=qa", "Хэн юу гэв?", counts.qa],
              ["art", "f=art", "Чанартай юм унш", counts.art],
              ["news", "f=news", "Мэдээгүй өнгөрөв өө!", counts.news],
              ["club", "f=club", "Клуб", counts.club],
              ["following", user ? "tab=following" : null, "Дагаж буй", user ? counts.following : null],
            ].map(([k, q, label, n]) => {
              const on = k === "all" ? !qa && !top && !rand && !ann && !art && !news && !club && !following : k === "following" ? following && !!user : k === "top" ? top : k === "ann" ? ann : k === "art" ? art : k === "news" ? news : k === "club" ? club : qa;
              const qs = q === null ? null : [q, tq].filter(Boolean).join("&");
              const href = qs === null ? "/login" : qs ? `/?${qs}` : "/";
              return (
                <Link key={k} href={href} className={on ? "on" : ""}>
                  {label}{n !== null && <em>{n}</em>}
                </Link>
              );
            })}
          </div>
          <ScrollActive selector=".ss-fscroll a.on" dep={`${f}|${tab}`} />
          <Link href={`/?f=rand&r=${seed.slice(0, 8)}`} prefetch={false} className={"ss-dice" + (rand ? " on" : "")} title="Сэгсрээд өг" aria-label="Сэгсрээд өг">
            <img className={rand ? "" : "ic"} src="/icons/dice.svg" width={20} height={20} alt="" />
          </Link>
          <TimeMenu
            label={period[1]}
            options={PERIODS.map(([v, name]) => {
              const q = [following && user ? "tab=following" : top ? "f=top" : qa ? "f=qa" : ann ? "f=ann" : art ? "f=art" : news ? "f=news" : club ? "f=club" : "", v === "7d" ? "" : `t=${v}`].filter(Boolean).join("&");
              return { name, href: q ? `/?${q}` : "/", on: v === period[0] };
            })}
          />
        </nav>
      )}
      {qa && (
        <nav className="bq-filters" aria-label="Шагналтай асуулт">
          <Link href={bq === "open" ? "/?f=qa" : "/?f=qa&b=open"} className={bq === "open" ? "on" : ""} title="Хариулт хүлээж буй шагналтай асуултууд">
            🏆 Шагналтай<em>{bqCounts.open}</em>
          </Link>
          <Link href={bq === "big" ? "/?f=qa" : "/?f=qa&b=big"} className={bq === "big" ? "on" : ""} title="Бүх шагналтай асуулт, шагналын дүнгээр нь">
            Шагналын хэмжээгээр<em>{fmtMnt(bqCounts.total)}</em>
          </Link>
        </nav>
      )}
      {posts.length === 0 && (
        <div className="ss-card">
          <p className="ss-empty">
            {hours && !rand && posts.length === 0 && (qa || top || following || ann || art || news || club)
              ? `Сонгосон хугацаанд (${period[1]}) энд контент алга. Баруун талын цагийн шүүлтүүрээр хугацаагаа сунгаад үзээрэй.`
              : bq
              ? "Одоохондоо хариулт хүлээж буй шагналтай асуулт алга. Асуултаа шагналтай асууж, мэдлэгтэй хүмүүсийг урамшуулаарай 🏆"
              : qa
              ? "Одоохондоо асуулт, бодрол алга. Эхнийхийг нь та асуугаарай ✦"
              : following && user
              ? "Дагаж буй хүмүүсийн нийтлэл алга. Сонирхолтой хүмүүсийг дагаарай."
              : hours && !rand
              ? `Сүүлийн ${period[1]}т шинэ контент алга. Баруун талын цагийн шүүлтүүрээр хугацаагаа сунгаад үзээрэй.`
              : "Одоохондоо нийтлэл алга. Эхний очийг та асаагаарай ✦"}
          </p>
        </div>
      )}
      {posts.map((p) => (
        <PostCard key={p.id} p={p} viewer={user} following={followSet} clubFollows={clubFollows} />
      ))}
    </Shell>
  );
}
