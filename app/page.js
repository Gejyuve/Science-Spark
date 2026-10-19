import Link from "next/link";
import crypto from "node:crypto";
import { getUser } from "@/lib/auth";
import { sql, ensureSchema } from "@/lib/db";
import Shell from "./components/Shell";
import PostCard from "./components/PostCard";
import { followingSet } from "./components/Bits";
import TimeMenu from "./components/TimeMenu";
import ScrollActive from "./components/ScrollActive";
import BountyBoard from "./components/BountyBoard";
import { bountyBoard } from "@/lib/bounty";

export const dynamic = "force-dynamic";

// [утга, нэр, цаг]
const PERIODS = [["24h", "24 цаг", 24], ["7d", "7 хоног", 168], ["1m", "1 сар", 720], ["6m", "6 сар", 4320], ["1y", "1 жил", 8760], ["all", "Бүх хугацаа", null]];

export default async function Home({ searchParams }) {
  const { tab, compose, error, f, t } = await searchParams;
  // Цагийн шүүлтүүр: анхдагч 24 цаг
  const period = PERIODS.find((x) => x[0] === t) || PERIODS[0];
  const hours = period[2];
  const tq = period[0] === "24h" ? "" : `t=${period[0]}`;
  const qa = f === "qa"; // Асуулт ба бодрол · сүүлд орсноор
  const ann = f === "ann"; // Зарлалууд
  const art = f === "art"; // Нийтлэл
  const news = f === "news"; // Мэдээ
  const top = f === "top"; // Сүүлийн 24 цагт хамгийн их оч авсан
  const rand = f === "rand"; // Санамсаргүй: хэрэглэгч бүрт, дарах бүрт өөр дараалал
  const seed = crypto.randomUUID();
  const following = tab === "following";
  let user = null;
  let posts = [];
  let counts = { all: 0, following: 0, top: 0, qa: 0, ann: 0, art: 0, news: 0 };
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
      SELECT p.id, p.author_id, p.kind, p.title, p.body, p.meta, p.image_id, p.views, p.created_at, p.category, u.initial, u.first_name, u.avatar_id AS avatar,
        (SELECT COUNT(*) FROM sparks WHERE post_id = p.id)::int AS sparks,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id)::int AS comments,
        COALESCE((SELECT SUM(delta) FROM points_ledger WHERE user_id = u.id), 0)::int AS author_points,
        (SELECT COUNT(*) FROM follows WHERE followee_id = u.id)::int AS author_followers,
        ta.id AS ta_id, ta.body AS ta_body, ta.author_id AS ta_author, ta.initial AS ta_initial, ta.first_name AS ta_first,
        ta.points AS ta_points, ta.followers AS ta_followers, ta.avatar AS ta_avatar,
        EXISTS (SELECT 1 FROM saves WHERE post_id = p.id AND user_id = ${user ? user.id : 0}) AS saved,
        EXISTS (SELECT 1 FROM sparks WHERE post_id = p.id AND user_id = ${user ? user.id : 0}) AS sparked,
        bq.amount AS bounty_amount, bq.status AS bounty_status
      FROM posts p JOIN users u ON u.id = p.author_id
      LEFT JOIN bounties bq ON bq.post_id = p.id AND bq.status IN ('open', 'awarded')
      -- Асуултын шилдэг хариулт: хамгийн их лайктай, тэнцвэл хамгийн сүүлд бичигдсэн
      LEFT JOIN LATERAL (
        SELECT c.id, c.body, c.author_id, cu.initial, cu.first_name, cu.avatar_id AS avatar,
          COALESCE((SELECT SUM(delta) FROM points_ledger WHERE user_id = cu.id), 0)::int AS points,
          (SELECT COUNT(*) FROM follows WHERE followee_id = cu.id)::int AS followers
        FROM comments c JOIN users cu ON cu.id = c.author_id
        WHERE c.post_id = p.id AND p.kind = 'Асуулт' AND c.parent_id IS NULL
        ORDER BY (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id) DESC, c.created_at DESC, c.id DESC
        LIMIT 1
      ) ta ON true
      LEFT JOIN win ON win.post_id = p.id
      WHERE p.status = 'published' AND p.kind <> 'Үг'
        AND (NOT ${qa}::boolean OR p.kind IN ('Асуулт', 'Бодрол'))
        AND (NOT ${ann}::boolean OR p.kind = 'Зарлал')
        AND (NOT ${art}::boolean OR p.kind = 'Нийтлэл')
        AND (NOT ${news}::boolean OR p.kind = 'Мэдээ')
        -- Цагийн шүүлтүүр (санамсаргүйд хамаарахгүй). Хамгийн тод: тухайн хугацаанд оч авсан
        AND (${rand}::boolean OR (CASE WHEN ${top}::boolean
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
        p.created_at DESC
      LIMIT 30`;
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
        COUNT(*) FILTER (WHERE (${hours}::int IS NULL OR p.created_at > now() - make_interval(hours => ${hours}::int)) AND p.kind = 'Мэдээ')::int AS news
      FROM posts p WHERE p.status = 'published' AND p.kind <> 'Үг'`;
    counts = c;
  } catch (e) {
    // Өгөгдлийн сан холбогдоогүй үед нүүр хуудас хэвийн нээгдэнэ
  }

  const followSet = await followingSet(user);
  // «Хэн юу гэв?»: шагналтай асуултууд хамгийн дээр
  const board = qa ? await bountyBoard().catch(() => null) : null;
  return (
    <Shell user={user} active={qa ? "qa" : top ? "top" : rand ? "rand" : "/"} compose={["Асуулт", "share", "Бодрол", "Эвент", "Зарлал"].includes(compose) ? compose : null} composeError={error}>
      {(
        <nav className="ss-filters" aria-label="Шүүлтүүр">
          <div className="ss-fscroll">
            {[
              ["all", "", "Бүгд", counts.all],
              ["following", user ? "tab=following" : null, "Дагаж буй", user ? counts.following : null],
              ["top", "f=top", "Хамгийн тод", counts.top],
              ["qa", "f=qa", "Хэн юу гэв?", counts.qa],
              ["art", "f=art", "Чанартай юм унш", counts.art],
              ["news", "f=news", "Мэдээгүй өнгөрөв өө!", counts.news],
              ["ann", "f=ann", "Гоё юм дуулгая", counts.ann],
            ].map(([k, q, label, n]) => {
              const on = k === "all" ? !qa && !top && !rand && !ann && !art && !news && !following : k === "following" ? following && !!user : k === "top" ? top : k === "ann" ? ann : k === "art" ? art : k === "news" ? news : qa;
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
              const q = [following && user ? "tab=following" : top ? "f=top" : qa ? "f=qa" : ann ? "f=ann" : art ? "f=art" : news ? "f=news" : "", v === "24h" ? "" : `t=${v}`].filter(Boolean).join("&");
              return { name, href: q ? `/?${q}` : "/", on: v === period[0] };
            })}
          />
        </nav>
      )}
      {board && (board.open.length > 0 || board.top.length > 0) && <BountyBoard {...board} />}
      {posts.length === 0 && (
        <div className="ss-card">
          <p className="ss-empty">
            {hours && !rand && posts.length === 0 && (qa || top || following || ann || art || news)
              ? `Сонгосон хугацаанд (${period[1]}) энд контент алга. Баруун талын цагийн шүүлтүүрээр хугацаагаа сунгаад үзээрэй.`
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
        <PostCard key={p.id} p={p} viewer={user} following={followSet} />
      ))}
    </Shell>
  );
}
