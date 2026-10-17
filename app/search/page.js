import Link from "next/link";
import { sql, ensureSchema } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { levelFor } from "@/lib/levels";
import { toggleFollow } from "../posts/actions";
import Shell from "../components/Shell";
import DictAdd from "../components/DictAdd";
import { Avatar, fmtK, followingSet } from "../components/Bits";

export const dynamic = "force-dynamic";
export const metadata = { title: "Хайлт · Science Spark" };

// Figma 620:472 · Хайлт · Үр дүн, 620:856 · Хайлт · Үр дүнгүй
const TABS = [
  ["all", "Бүгд"],
  ["article", "Нийтлэл"],
  ["news", "Мэдээ"],
  ["qa", "Асуулт"],
  ["event", "Эвент"],
  ["ann", "Зарлал"],
  ["dict", "Толь"],
  ["user", "Хэрэглэгч"],
];
const KIND_OF = { Нийтлэл: "article", Мэдээ: "news", Асуулт: "qa", Бодрол: "qa", Эвент: "event", Зарлал: "ann", Үг: "dict" };
const SECTION = { article: "Нийтлэл", news: "Мэдээ", qa: "Асуулт", event: "Эвент", ann: "Зарлал", dict: "Толь", user: "Хэрэглэгч" };
const PREVIEW = { article: 4, news: 2, qa: 3, event: 2, ann: 2, dict: 4, user: 2 };
const SYMBOLS = ["π", "∞", "Σ", "√", "Δ", "λ", "Ω", "∫"];
const TONES = ["teal", "orange", "violet", "pink"];

// Хайсан үгийг тодруулна
function Hl({ text, term }) {
  if (!term) return text;
  const t = String(text || "");
  const low = t.toLowerCase();
  const needle = term.toLowerCase();
  const out = [];
  let i = 0;
  let k = 0;
  while (needle && (k = low.indexOf(needle, i)) !== -1) {
    if (k > i) out.push(t.slice(i, k));
    out.push(<mark key={k} className="sr-hl">{t.slice(k, k + needle.length)}</mark>);
    i = k + needle.length;
  }
  out.push(t.slice(i));
  return out;
}

// Хайсан үг орсон хэсгийг тасдаж авна
function snippet(body, term, len = 130) {
  const b = String(body || "").replace(/\s+/g, " ").trim();
  const k = term ? b.toLowerCase().indexOf(term.toLowerCase()) : -1;
  if (b.length <= len) return b;
  if (k < 60) return b.slice(0, len).replace(/\s+\S*$/, "") + "…";
  const start = b.lastIndexOf(" ", k - 40) + 1;
  return "…" + b.slice(start, start + len).replace(/\s+\S*$/, "") + "…";
}

function Cover({ p, cls }) {
  const tone = TONES[p.id % TONES.length];
  return (
    <span className={`sr-cover ${cls} ${p.image_id ? "img" : tone}`}>
      {p.image_id ? <img src={`/img/${p.image_id}`} alt="" loading="lazy" /> : <><i className="sr-sym">{SYMBOLS[p.id % SYMBOLS.length]}</i><i className="sr-blob" /></>}
      <em className={`sr-chip ${tone}`}>{p.kind}</em>
    </span>
  );
}

function Byline({ p }) {
  return (
    <span className="sr-by">
      <Avatar user={{ id: p.author_id, first_name: p.first_name, avatar: p.avatar }} size={20} />
      <b>{p.initial}.{p.first_name}</b>
      <small>· {fmtDate(p.created_at)}</small>
    </span>
  );
}

function Head({ k, n, more, href }) {
  return (
    <div className="sr-head">
      <h2>{SECTION[k]}</h2>
      <em>{n}</em>
      <span className="ss-grow" />
      {more && <Link href={href}>Бүгдийг харах →</Link>}
    </div>
  );
}

export default async function SearchPage({ searchParams }) {
  const user = await getUser();
  const { q = "", type = "all" } = await searchParams;
  const term = String(q).trim().slice(0, 100);
  const tab = TABS.some(([k]) => k === type) ? type : "all";
  await ensureSchema();
  let posts = [];
  let people = [];
  if (term) {
    const like = `%${term.replace(/[%_\\]/g, "\\$&")}%`;
    posts = await sql`
      SELECT p.id, p.kind, p.title, p.body, p.image_id, p.created_at, p.author_id, p.meta,
             u.initial, u.first_name, u.avatar_id AS avatar,
             (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id)::int AS answers,
             (p.title ILIKE ${like})::int AS in_title
      FROM posts p JOIN users u ON u.id = p.author_id
      WHERE p.status = 'published' AND (p.title ILIKE ${like} OR p.body ILIKE ${like}
        OR (p.kind = 'Үг' AND (p.meta->>'en' ILIKE ${like} OR p.meta->>'ru' ILIKE ${like})))
      ORDER BY in_title DESC, p.created_at DESC LIMIT 100`;
    people = await sql`
      SELECT u.id, u.initial, u.first_name, u.avatar_id AS avatar,
             COALESCE((SELECT SUM(delta) FROM points_ledger WHERE user_id = u.id), 0)::int AS points,
             (SELECT COUNT(*) FROM posts WHERE author_id = u.id AND status = 'published')::int AS posts,
             (SELECT COUNT(*) FROM follows WHERE followee_id = u.id)::int AS followers
      FROM users u
      WHERE u.first_name ILIKE ${like} OR u.surname ILIKE ${like} OR (u.initial || '.' || u.first_name) ILIKE ${like}
      ORDER BY points DESC LIMIT 20`;
  }
  const following = await followingSet(user);
  const groups = { article: [], news: [], qa: [], event: [], ann: [], dict: [], user: people };
  for (const p of posts) groups[KIND_OF[p.kind] || "article"].push(p);
  const total = posts.length + people.length;
  const count = (k) => (k === "all" ? total : groups[k].length);
  const show = (k) => (tab === "all" ? groups[k].slice(0, PREVIEW[k]) : groups[k]);
  const visible = (k) => (tab === "all" || tab === k) && groups[k].length > 0;
  const href = (k) => `/search?q=${encodeURIComponent(term)}${k === "all" ? "" : `&type=${k}`}`;
  const head = (k) => <Head k={k} n={groups[k].length} more={tab === "all" && groups[k].length > PREVIEW[k]} href={href(k)} />;

  return (
    <Shell user={user} header="nav">
      <form action="/search" method="get" className="sr-bar" role="search">
        <img className="ic" src="/icons/search.svg" width={18} height={18} alt="" />
        <input name="q" defaultValue={term} placeholder="Нийтлэл, мэдээ, асуулт, хэрэглэгч хайх…" aria-label="Хайх" autoFocus={!term} />
        {tab !== "all" && <input type="hidden" name="type" value={tab} />}
      </form>

      {term && total > 0 && (
        <>
          <nav className="sr-tabs" aria-label="Төрөл">
            {TABS.filter(([k]) => k === "all" || count(k) > 0).map(([k, name]) => (
              <Link key={k} href={href(k)} className={tab === k ? "on" : ""}>{name} {count(k)}</Link>
            ))}
          </nav>
          <p className="sr-count">{tab === "all" ? total : count(tab)} үр дүн · "{term}"</p>
        </>
      )}

      {term && total === 0 && (
        <div className="sr-empty">
          <span className="sr-empty-ic"><img className="ic" src="/icons/search.svg" width={22} height={22} alt="" /></span>
          <b>Үр дүн олдсонгүй</b>
          <p>"{term}" хайлтаар юу ч олдсонгүй. Өөр түлхүүр үгээр хайх эсвэл асуулт асууж үзээрэй.</p>
          <div>
            <Link href={user ? "/?compose=Асуулт" : "/login"} className="sr-btn">Асуулт асуух</Link>
            <DictAdd className="sr-btn ghost" label="Үг Толь-д санал болгох" loggedIn={!!user} />
          </div>
        </div>
      )}

      {!term && (
        <div className="sr-empty">
          <span className="sr-empty-ic"><img className="ic" src="/icons/search.svg" width={22} height={22} alt="" /></span>
          <b>Юу хайх вэ?</b>
          <p>Нийтлэл, мэдээ, асуулт, эвент, зарлал, Толь-ийн нэр томьёо болон хэрэглэгчдээс хайна.</p>
        </div>
      )}

      {visible("article") && (
        <section className="sr-sec">
          {head("article")}
          <div className="sr-grid4">
            {show("article").map((p) => (
              <Link key={p.id} href={`/post/${p.id}`} className="sr-card">
                <Cover p={p} cls="top" />
                <span className="sr-body">
                  <b className="sr-title"><Hl text={p.title} term={term} /></b>
                  <span className="sr-text"><Hl text={snippet(p.body, term)} term={term} /></span>
                  <Byline p={p} />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {["news", "event", "ann"].filter(visible).map((k) => (
        <section key={k} className="sr-sec">
          {head(k)}
          <div className="sr-grid2">
            {show(k).map((p) => (
              <Link key={p.id} href={`/post/${p.id}`} className="sr-card row">
                <Cover p={p} cls="side" />
                <span className="sr-body">
                  <b className="sr-title"><Hl text={p.title} term={term} /></b>
                  <span className="sr-text"><Hl text={snippet(p.body, term, 110)} term={term} /></span>
                  <Byline p={p} />
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}

      {visible("qa") && (
        <section className="sr-sec">
          {head("qa")}
          <div className="sr-list">
            {show("qa").map((p) => (
              <Link key={p.id} href={`/post/${p.id}${p.kind === "Асуулт" ? "#comments" : ""}`} className="sr-q">
                <span className="sr-qic" aria-hidden="true">{p.kind === "Асуулт" ? "?" : "!"}</span>
                <span className="sr-qtext">
                  <b><Hl text={snippet(p.body, term, 120)} term={term} /></b>
                  <small>{p.initial}.{p.first_name} · {fmtDate(p.created_at)}{p.kind === "Бодрол" ? " · Бодрол" : ""}</small>
                </span>
                <em>{p.answers} {p.kind === "Асуулт" ? "хариулт" : "сэтгэгдэл"}</em>
              </Link>
            ))}
          </div>
        </section>
      )}

      {visible("dict") && (
        <section className="sr-sec">
          {head("dict")}
          <div className="sr-grid2">
            {show("dict").map((p) => (
              <Link key={p.id} href={`/post/${p.id}`} className="sr-term">
                <span className="sr-tsq">{(p.title || "?").charAt(0).toUpperCase()}</span>
                <span className="sr-utext">
                  <span className="sr-uname"><b><Hl text={p.title} term={term} /></b>{p.meta?.en && <em className="sr-en">EN · <Hl text={p.meta.en} term={term} /></em>}</span>
                  <small className="sr-tdef"><Hl text={snippet(p.body, term, 90)} term={term} /></small>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {visible("user") && (
        <section className="sr-sec">
          {head("user")}
          <div className="sr-grid2">
            {show("user").map((u) => {
              const lv = levelFor(u.points);
              const mine = user && user.id === u.id;
              const isF = following?.has(u.id);
              return (
                <div key={u.id} className="sr-user">
                  <Link href={`/u/${u.id}`} className="sr-uav"><Avatar user={{ id: u.id, first_name: u.first_name, avatar: u.avatar }} size={44} /></Link>
                  <span className="sr-utext">
                    <span className="sr-uname">
                      <Link href={`/u/${u.id}`}><Hl text={u.first_name ? `${u.initial}.${u.first_name}` : "Шинэ хэрэглэгч"} term={term} /></Link>
                      <em className="sr-lv">Түвшин {lv.n} · {lv.name}</em>
                    </span>
                    <small>{fmtK(u.points)} оч · {u.posts} нийтлэл · {u.followers} дагагч</small>
                  </span>
                  {!mine && (user ? (
                    <form action={toggleFollow}>
                      <input type="hidden" name="user_id" value={u.id} />
                      <button type="submit" className={"sr-btn" + (isF ? " ghost" : "")}>{isF ? "Дагаж байна" : "Дагах"}</button>
                    </form>
                  ) : (
                    <Link href="/login" className="sr-btn">Дагах</Link>
                  ))}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </Shell>
  );
}
