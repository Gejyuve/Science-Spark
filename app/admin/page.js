import Link from "next/link";
import { sql } from "@/lib/db";
import { requireSection } from "@/lib/admin";
import { fmtDate } from "@/lib/format";
import { LEVELS } from "@/lib/levels";
import Head, { Stat, Tabs, Chip } from "./_c/Head";
import { GrowthChart, PctList } from "./_c/Charts";

// Хугацааны шүүлтүүр: багана бүр нэг цаг, өдөр эсвэл сар (Улаанбаатарын цагаар)
const PERIODS = {
  day: { label: "24 цаг", step: "hour", n: 24, fmt: "HH24", prev: "өмнөх 24 цагаас" },
  week: { label: "7 хоног", step: "day", n: 7, fmt: "MM.DD", prev: "өмнөх 7 хоногоос" },
  month: { label: "30 хоног", step: "day", n: 30, fmt: "MM.DD", prev: "өмнөх 30 хоногоос" },
  year: { label: "12 сар", step: "month", n: 12, fmt: "YYYY.MM", prev: "өмнөх 12 сараас" },
};
const COUNTRY = { MN: "Монгол", US: "АНУ", CN: "Хятад", RU: "Орос", KR: "Солонгос", JP: "Япон", DE: "Герман", GB: "Их Британи", AU: "Австрали", CA: "Канад", FR: "Франц", TR: "Турк", KZ: "Казахстан", CZ: "Чех", PL: "Польш", SE: "Швед", NL: "Нидерланд", SG: "Сингапур", TW: "Тайвань", HK: "Хонконг" };
const KIND_COLOR = { Нийтлэл: "#37c3b3", Мэдээ: "#0a84ff", Асуулт: "#ff9500", Бодрол: "#9b3df0", Эвент: "#e5243b", Зарлал: "#f5a700", Үг: "#16c25a", Даалгавар: "#4f6676", Тайлан: "#879dab" };

const n = (v) => Number(v || 0).toLocaleString("en-US");
const trend = (now, prev, label) => {
  if (!prev) return now ? `${label} 0 байсан` : "өөрчлөлтгүй";
  const d = Math.round(((now - prev) / prev) * 100);
  return `${d >= 0 ? "▲" : "▼"} ${Math.abs(d)}% ${label}`;
};
const dur = (s) => {
  s = Math.round(Number(s) || 0);
  if (s < 60) return `${s} сек`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}:${String(s % 60).padStart(2, "0")} мин` : `${Math.floor(m / 60)} цаг ${m % 60} мин`;
};
const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));

// Тойм: хэрэглэгч, контент, оч, идэвх, экосистемийн эрүүл байдал
export default async function Overview({ searchParams }) {
  const user = await requireSection("overview");
  const sp = await searchParams;
  const key = PERIODS[sp.p] ? sp.p : "week";
  const P = PERIODS[key];
  const back = `${P.n - 1} ${P.step}s`, len = `${P.n} ${P.step}s`, unit = `1 ${P.step}`;

  const [[s], series, hours, gender, age, places, kinds, viewKinds, topViewed, levelRows, [spam]] = await Promise.all([
    sql`WITH r AS (SELECT date_trunc(${P.step}, now() AT TIME ZONE 'Asia/Ulaanbaatar') - ${back}::interval AS s, ${len}::interval AS len),
      act AS (SELECT author_id AS u, created_at AS t FROM posts UNION ALL SELECT author_id, created_at FROM comments
              UNION ALL SELECT user_id, created_at FROM sparks UNION ALL SELECT user_id, last_at FROM site_visits WHERE user_id IS NOT NULL)
    SELECT
      (SELECT COUNT(*) FROM users)::int AS users,
      (SELECT COUNT(*) FROM users, r WHERE created_at AT TIME ZONE 'Asia/Ulaanbaatar' < r.s)::int AS users_before,
      (SELECT COUNT(*) FROM users, r WHERE created_at AT TIME ZONE 'Asia/Ulaanbaatar' >= r.s)::int AS new_c,
      (SELECT COUNT(*) FROM users, r WHERE created_at AT TIME ZONE 'Asia/Ulaanbaatar' >= r.s - r.len AND created_at AT TIME ZONE 'Asia/Ulaanbaatar' < r.s)::int AS new_p,
      (SELECT COUNT(DISTINCT u) FROM act, r WHERE t AT TIME ZONE 'Asia/Ulaanbaatar' >= r.s)::int AS active_c,
      (SELECT COUNT(DISTINCT u) FROM act, r WHERE t AT TIME ZONE 'Asia/Ulaanbaatar' >= r.s - r.len AND t AT TIME ZONE 'Asia/Ulaanbaatar' < r.s)::int AS active_p,
      (SELECT COUNT(*) FROM users WHERE premium_until > now())::int AS supporters,
      (SELECT COUNT(*) FROM posts, r WHERE status = 'published' AND created_at AT TIME ZONE 'Asia/Ulaanbaatar' >= r.s)::int AS pub_c,
      (SELECT COUNT(*) FROM posts, r WHERE status = 'published' AND created_at AT TIME ZONE 'Asia/Ulaanbaatar' >= r.s - r.len AND created_at AT TIME ZONE 'Asia/Ulaanbaatar' < r.s)::int AS pub_p,
      (SELECT COUNT(*) FROM posts WHERE status = 'published')::int AS pub_all,
      (SELECT COUNT(*) FROM post_views, r WHERE created_at AT TIME ZONE 'Asia/Ulaanbaatar' >= r.s)::int AS views_c,
      (SELECT COUNT(*) FROM post_views, r WHERE created_at AT TIME ZONE 'Asia/Ulaanbaatar' >= r.s - r.len AND created_at AT TIME ZONE 'Asia/Ulaanbaatar' < r.s)::int AS views_p,
      (SELECT COUNT(*) FROM comments, r WHERE created_at AT TIME ZONE 'Asia/Ulaanbaatar' >= r.s)::int AS com_c,
      (SELECT COUNT(*) FROM comments, r WHERE created_at AT TIME ZONE 'Asia/Ulaanbaatar' >= r.s - r.len AND created_at AT TIME ZONE 'Asia/Ulaanbaatar' < r.s)::int AS com_p,
      (SELECT COUNT(*) FROM sparks, r WHERE created_at AT TIME ZONE 'Asia/Ulaanbaatar' >= r.s)::int AS sparks_c,
      (SELECT COUNT(*) FROM sparks, r WHERE created_at AT TIME ZONE 'Asia/Ulaanbaatar' >= r.s - r.len AND created_at AT TIME ZONE 'Asia/Ulaanbaatar' < r.s)::int AS sparks_p,
      (SELECT COUNT(DISTINCT user_id) FROM sparks, r WHERE created_at AT TIME ZONE 'Asia/Ulaanbaatar' >= r.s)::int AS givers_c,
      (SELECT COALESCE(SUM(delta) FILTER (WHERE delta > 0), 0) FROM points_ledger, r WHERE created_at AT TIME ZONE 'Asia/Ulaanbaatar' >= r.s)::int AS pts_c,
      (SELECT COALESCE(-SUM(delta) FILTER (WHERE delta < 0), 0) FROM points_ledger, r WHERE created_at AT TIME ZONE 'Asia/Ulaanbaatar' >= r.s)::int AS fines_c,
      (SELECT COUNT(*) FROM site_visits, r WHERE started_at AT TIME ZONE 'Asia/Ulaanbaatar' >= r.s)::int AS visits_c,
      (SELECT COUNT(DISTINCT visitor) FROM site_visits, r WHERE started_at AT TIME ZONE 'Asia/Ulaanbaatar' >= r.s)::int AS visitors_c,
      (SELECT COALESCE(AVG(EXTRACT(EPOCH FROM last_at - started_at)), 0) FROM site_visits, r WHERE started_at AT TIME ZONE 'Asia/Ulaanbaatar' >= r.s)::float AS avg_c,
      (SELECT COALESCE(AVG(EXTRACT(EPOCH FROM last_at - started_at)), 0) FROM site_visits, r WHERE started_at AT TIME ZONE 'Asia/Ulaanbaatar' >= r.s - r.len AND started_at AT TIME ZONE 'Asia/Ulaanbaatar' < r.s)::float AS avg_p,
      (SELECT MIN(started_at) FROM site_visits) AS track_from,
      (SELECT COUNT(*) FROM posts, r WHERE reviewed_at AT TIME ZONE 'Asia/Ulaanbaatar' >= r.s AND status IN ('published', 'rejected'))::int AS reviewed_c,
      (SELECT COUNT(*) FROM posts, r WHERE reviewed_at AT TIME ZONE 'Asia/Ulaanbaatar' >= r.s AND status = 'rejected')::int AS rejected_c,
      (SELECT COUNT(*) FROM posts WHERE status = 'pending')::int AS pending,
      (SELECT COUNT(*) FROM posts WHERE status = 'pending' AND created_at < now() - interval '3 days')::int AS stale`,
    sql`WITH r AS (SELECT date_trunc(${P.step}, now() AT TIME ZONE 'Asia/Ulaanbaatar') - ${back}::interval AS s, ${len}::interval AS len),
      b AS (SELECT generate_series(r.s, r.s + r.len - ${unit}::interval, ${unit}::interval) AS t FROM r)
    SELECT to_char(b.t, ${P.fmt}) AS label, COALESCE(u.n, 0)::int AS new, COALESCE(p.n, 0)::int AS pub, COALESCE(v.n, 0)::int AS views, COALESCE(s.n, 0)::int AS visitors
    FROM b
    LEFT JOIN (SELECT date_trunc(${P.step}, created_at AT TIME ZONE 'Asia/Ulaanbaatar') AS t, COUNT(*) AS n FROM users, r WHERE created_at AT TIME ZONE 'Asia/Ulaanbaatar' >= r.s GROUP BY 1) u USING (t)
    LEFT JOIN (SELECT date_trunc(${P.step}, created_at AT TIME ZONE 'Asia/Ulaanbaatar') AS t, COUNT(*) AS n FROM posts, r WHERE status = 'published' AND created_at AT TIME ZONE 'Asia/Ulaanbaatar' >= r.s GROUP BY 1) p USING (t)
    LEFT JOIN (SELECT date_trunc(${P.step}, created_at AT TIME ZONE 'Asia/Ulaanbaatar') AS t, COUNT(*) AS n FROM post_views, r WHERE created_at AT TIME ZONE 'Asia/Ulaanbaatar' >= r.s GROUP BY 1) v USING (t)
    LEFT JOIN (SELECT date_trunc(${P.step}, started_at AT TIME ZONE 'Asia/Ulaanbaatar') AS t, COUNT(DISTINCT visitor) AS n FROM site_visits, r WHERE started_at AT TIME ZONE 'Asia/Ulaanbaatar' >= r.s GROUP BY 1) s USING (t)
    ORDER BY b.t`,
    // Идэвхтэй цаг: айлчлал, нийтлэл, сэтгэгдэл, оч, үзэлт өдрийн аль цагт их байна
    sql`WITH r AS (SELECT date_trunc(${P.step}, now() AT TIME ZONE 'Asia/Ulaanbaatar') - ${back}::interval AS s)
    SELECT EXTRACT(HOUR FROM t AT TIME ZONE 'Asia/Ulaanbaatar')::int AS h, COUNT(*)::int AS n
    FROM (SELECT started_at AS t FROM site_visits UNION ALL SELECT created_at FROM posts UNION ALL SELECT created_at FROM comments
          UNION ALL SELECT created_at FROM sparks UNION ALL SELECT created_at FROM post_views) a, r
    WHERE t AT TIME ZONE 'Asia/Ulaanbaatar' >= r.s GROUP BY 1`,
    sql`SELECT COALESCE(p.gender, 'Бөглөөгүй') AS label, COUNT(*)::int AS n FROM users u LEFT JOIN profiles p ON p.user_id = u.id GROUP BY 1 ORDER BY 2 DESC`,
    sql`SELECT label, COUNT(*)::int AS n, MIN(o) AS o FROM (
          SELECT CASE WHEN p.birth_date IS NULL THEN 'Бөглөөгүй'
            WHEN age(p.birth_date) < interval '18 years' THEN '18-аас доош'
            WHEN age(p.birth_date) < interval '25 years' THEN '18–24'
            WHEN age(p.birth_date) < interval '35 years' THEN '25–34'
            WHEN age(p.birth_date) < interval '45 years' THEN '35–44'
            ELSE '45+' END AS label,
            CASE WHEN p.birth_date IS NULL THEN 999 ELSE EXTRACT(YEAR FROM age(p.birth_date))::int END AS o
          FROM users u LEFT JOIN profiles p ON p.user_id = u.id) x GROUP BY label ORDER BY o`,
    sql`WITH r AS (SELECT date_trunc(${P.step}, now() AT TIME ZONE 'Asia/Ulaanbaatar') - ${back}::interval AS s)
    SELECT country, city, COUNT(DISTINCT visitor)::int AS n FROM site_visits, r
    WHERE started_at AT TIME ZONE 'Asia/Ulaanbaatar' >= r.s GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 50`,
    sql`WITH r AS (SELECT date_trunc(${P.step}, now() AT TIME ZONE 'Asia/Ulaanbaatar') - ${back}::interval AS s)
    SELECT kind AS label, COUNT(*)::int AS n FROM posts, r
    WHERE status = 'published' AND created_at AT TIME ZONE 'Asia/Ulaanbaatar' >= r.s GROUP BY 1 ORDER BY 2 DESC`,
    sql`WITH r AS (SELECT date_trunc(${P.step}, now() AT TIME ZONE 'Asia/Ulaanbaatar') - ${back}::interval AS s)
    SELECT p.kind AS label, COUNT(*)::int AS n FROM post_views v JOIN posts p ON p.id = v.post_id, r
    WHERE v.created_at AT TIME ZONE 'Asia/Ulaanbaatar' >= r.s GROUP BY 1 ORDER BY 2 DESC`,
    sql`WITH r AS (SELECT date_trunc(${P.step}, now() AT TIME ZONE 'Asia/Ulaanbaatar') - ${back}::interval AS s)
    SELECT p.id, p.kind, p.title, COUNT(*)::int AS n FROM post_views v JOIN posts p ON p.id = v.post_id, r
    WHERE v.created_at AT TIME ZONE 'Asia/Ulaanbaatar' >= r.s AND p.status = 'published'
    GROUP BY p.id ORDER BY n DESC LIMIT 8`,
    sql`SELECT COALESCE(SUM(l.delta), 0)::int AS p FROM users u LEFT JOIN points_ledger l ON l.user_id = u.id GROUP BY u.id`,
    // Спам байж болзошгүй үйлдлүүд
    sql`WITH r AS (SELECT date_trunc(${P.step}, now() AT TIME ZONE 'Asia/Ulaanbaatar') - ${back}::interval AS s)
    SELECT
      (SELECT COALESCE(SUM(c - 1), 0) FROM (SELECT COUNT(*) AS c FROM comments, r WHERE created_at AT TIME ZONE 'Asia/Ulaanbaatar' >= r.s
         GROUP BY author_id, lower(trim(body)) HAVING COUNT(*) > 1) x)::int AS dup,
      (SELECT COUNT(*) FROM (SELECT 1 FROM comments, r WHERE created_at AT TIME ZONE 'Asia/Ulaanbaatar' >= r.s
         GROUP BY author_id, date_trunc('minute', created_at) HAVING COUNT(*) >= 5) x)::int AS burst,
      (SELECT COUNT(*) FROM (SELECT 1 FROM sparks, r WHERE created_at AT TIME ZONE 'Asia/Ulaanbaatar' >= r.s
         GROUP BY user_id, date_trunc('minute', created_at) HAVING COUNT(*) >= 10) x)::int AS spark_burst,
      (SELECT COUNT(*) FROM (SELECT c.author_id FROM comments c JOIN users u ON u.id = c.author_id, r
         WHERE c.created_at AT TIME ZONE 'Asia/Ulaanbaatar' >= r.s AND c.created_at < u.created_at + interval '1 day'
         GROUP BY c.author_id HAVING COUNT(*) >= 10) x)::int AS fresh,
      (SELECT COUNT(*) FROM posts, r WHERE status = 'removed' AND reviewed_at AT TIME ZONE 'Asia/Ulaanbaatar' >= r.s)::int AS removed,
      (SELECT COUNT(*) FROM user_warnings, r WHERE created_at AT TIME ZONE 'Asia/Ulaanbaatar' >= r.s)::int AS warnings,
      (SELECT COUNT(*) FROM logic_reports, r WHERE created_at AT TIME ZONE 'Asia/Ulaanbaatar' >= r.s)::int AS reports`,
  ]);

  // Өсөлт: шинэ хэрэглэгч ба нийт (хуримтлагдсан)
  let run = s.users_before;
  const growth = series.map((d) => ({ ...d, total: (run += d.new) }));
  const hourRows = Array.from({ length: 24 }, (_, h) => ({ label: String(h).padStart(2, "0"), n: hours.find((x) => x.h === h)?.n || 0 }));
  const peak = hourRows.reduce((a, b) => (b.n > a.n ? b : a), hourRows[0]);

  const placeRows = (() => {
    const rows = places.map((p) => ({ label: p.city ? `${p.city}, ${COUNTRY[p.country] || p.country || "?"}` : COUNTRY[p.country] || p.country || "Тодорхойгүй", n: p.n }));
    const top = rows.slice(0, 7);
    const rest = rows.slice(7).reduce((a, r) => a + r.n, 0);
    return rest ? [...top, { label: "Бусад", n: rest }] : top;
  })();
  const countryRows = Object.values(places.reduce((m, p) => {
    const k = COUNTRY[p.country] || p.country || "Тодорхойгүй";
    m[k] = { label: k, n: (m[k]?.n || 0) + p.n };
    return m;
  }, {})).sort((a, b) => b.n - a.n);

  const levels = LEVELS.map((l, i) => ({ label: `${l.n} · ${l.name}`, color: l.color, n: levelRows.filter((r) => r.p >= l.min && (!LEVELS[i + 1] || r.p < LEVELS[i + 1].min)).length }));
  const leveled = levels.slice(1).reduce((a, l) => a + l.n, 0);

  // Экосистемийн эрүүл байдал: дэд үзүүлэлт бүр 0–100, дундаж нь нийт оноо
  const actions = s.com_c + s.sparks_c + s.pub_c;
  const suspect = spam.dup + spam.burst + spam.spark_burst + spam.fresh + spam.removed + spam.warnings;
  const per1000 = actions ? (suspect / actions) * 1000 : 0;
  const health = [
    ["Идэвх", clamp(s.users ? (s.active_c / s.users) * 100 / 0.3 : 0), `${s.users ? Math.round((s.active_c / s.users) * 100) : 0}% нь идэвхтэй (30% = бүрэн)`],
    ["Оролцоо", clamp(s.pub_c ? ((s.com_c + s.sparks_c) / s.pub_c) * 20 : s.com_c + s.sparks_c ? 100 : 0), `нэг контентод ${s.pub_c ? ((s.com_c + s.sparks_c) / s.pub_c).toFixed(1) : 0} сэтгэгдэл, оч (5 = бүрэн)`],
    ["Чанар", clamp(s.reviewed_c ? 100 - (s.rejected_c / s.reviewed_c) * 100 : 100), `хянасан ${n(s.reviewed_c)}-с ${n(s.rejected_c)} буцаасан`],
    // Цөөн үйлдэлтэй үед ганц сэжигтэй үйлдэл оноог унагахгүйн тулд хамгийн багадаа 100 үйлдлээр тооцно
    ["Цэвэр байдал", clamp(100 - (suspect / Math.max(actions, 100)) * 2000), `1000 үйлдэлд ${per1000.toFixed(1)} сэжигтэй`],
    ["Редакцын хурд", clamp(s.pending ? 100 - (s.stale / s.pending) * 100 : 100), s.stale ? `${s.stale} контент 3+ хоног хүлээгдэж байна` : "хүлээлгүй хянагдаж байна"],
  ];
  const score = Math.round(health.reduce((a, h) => a + h[1], 0) / health.length);
  const tone = (v) => (v >= 75 ? "ok" : v >= 50 ? "warn" : "bad");

  const tracked = s.track_from ? `${fmtDate(s.track_from)}-аас хэмжиж байна` : "хэмжилт дөнгөж эхэлсэн";

  return (
    <>
      <Head user={user} title="Тойм" sub={`Сүүлийн ${P.label} · өмнөх ижил хугацаатай харьцуулсан`} />
      <Tabs cur={key} href={(k) => `/admin${k === "week" ? "" : `?p=${k}`}`} tabs={Object.entries(PERIODS).map(([k, v]) => [k, v.label])} />

      <section className="adm-card ov-health">
        <div className={"ov-score " + tone(score)}>
          <b>{score}%</b>
          <span>Экосистемийн эрүүл байдал</span>
        </div>
        <ul className="ov-hlist">
          {health.map(([label, v, note]) => (
            <li key={label}>
              <span>{label}</span>
              <i><em className={tone(v)} style={{ width: `${v}%` }} /></i>
              <b>{v}%</b>
              <small>{note}</small>
            </li>
          ))}
        </ul>
      </section>

      <h2 className="adm-sec">Хэрэглэгчид</h2>
      <div className="adm-stats">
        <Stat label="Нийт хэрэглэгч" value={n(s.users)} note={`${n(s.supporters)} дэмжигч`} />
        <Stat label="Шинэ хэрэглэгч" value={`+${n(s.new_c)}`} note={trend(s.new_c, s.new_p, P.prev)} />
        <Stat label="Идэвхтэй хэрэглэгч" value={n(s.active_c)} note={`${s.users ? Math.round((s.active_c / s.users) * 100) : 0}% · ${trend(s.active_c, s.active_p, P.prev)}`} />
        <Stat label="Сайтад өнгөрөөх дундаж хугацаа" value={dur(s.avg_c)} note={s.avg_p ? trend(s.avg_c, s.avg_p, P.prev) : tracked} />
        <Stat label="Зочилсон" value={n(s.visitors_c)} note={`${n(s.visits_c)} айлчлал`} />
      </div>
      <div className="adm-grid2">
        <section className="adm-card">
          <div className="adm-card-head"><b>Хэрэглэгчийн өсөлт</b></div>
          <GrowthChart data={growth} bar="new" line="total" barLabel="шинэ хэрэглэгч" lineLabel="нийт хэрэглэгч" />
        </section>
        <section className="adm-card">
          <div className="adm-card-head"><b>Идэвхтэй цаг</b><span className="ss-grow" /><small className="adm-muted">{peak.n ? `Хамгийн идэвхтэй: ${peak.label}:00–${String((Number(peak.label) + 1) % 24).padStart(2, "0")}:00` : ""}</small></div>
          <GrowthChart data={hourRows} bar="n" barLabel="үйлдэл (цагаар, УБ)" barColor="#9b3df0" />
        </section>
      </div>
      <div className="ov-grid3">
        <section className="adm-card">
          <div className="adm-card-head"><b>Хүйс</b></div>
          <PctList rows={gender} color="#0a84ff" />
        </section>
        <section className="adm-card">
          <div className="adm-card-head"><b>Нас</b></div>
          <PctList rows={age} color="#ff9500" />
        </section>
        <section className="adm-card">
          <div className="adm-card-head"><b>Хаанаас холбогдож буй</b><span className="ss-grow" /><small className="adm-muted">{countryRows.length > 1 ? `${countryRows.length} улс` : ""}</small></div>
          <PctList rows={placeRows} color="#16c25a" empty={`Мэдээлэл алга (${tracked})`} />
        </section>
      </div>

      <h2 className="adm-sec">Контент</h2>
      <div className="adm-stats">
        <Stat label="Нийтлэгдсэн" value={`+${n(s.pub_c)}`} note={`нийт ${n(s.pub_all)} · ${trend(s.pub_c, s.pub_p, P.prev)}`} />
        <Stat label="Үзэлт" value={n(s.views_c)} note={trend(s.views_c, s.views_p, P.prev)} />
        <Stat label="Сэтгэгдэл" value={n(s.com_c)} note={trend(s.com_c, s.com_p, P.prev)} />
      </div>
      <div className="adm-grid2">
        <section className="adm-card">
          <div className="adm-card-head"><b>Нийтлэгдсэн контент</b></div>
          <GrowthChart data={series} bar="pub" line="views" barLabel="нийтлэгдсэн" lineLabel="үзэлт" barColor="#0a84ff" lineColor="#ff9500" />
        </section>
        <section className="adm-card">
          <div className="adm-card-head"><b>Төрлөөр</b></div>
          <PctList rows={kinds.map((k) => ({ ...k, color: KIND_COLOR[k.label] }))} empty="Энэ хугацаанд нийтлэгдсэн контент алга" />
        </section>
      </div>
      <div className="adm-grid2">
        <section className="adm-card">
          <div className="adm-card-head"><b>Хамгийн их үзсэн контент</b></div>
          {topViewed.length === 0 ? <p className="adm-empty">Энэ хугацаанд үзэлт алга.</p> : (
            <ol className="ov-top">
              {topViewed.map((p) => (
                <li key={p.id}>
                  <Link href={`/post/${p.id}`}>{p.title}</Link>
                  <Chip>{p.kind}</Chip>
                  <b>{n(p.n)}</b>
                </li>
              ))}
            </ol>
          )}
        </section>
        <section className="adm-card">
          <div className="adm-card-head"><b>Ямар төрлийн контентыг их үзэж буй</b></div>
          <PctList rows={viewKinds.map((k) => ({ ...k, color: KIND_COLOR[k.label] }))} empty="Энэ хугацаанд үзэлт алга" />
        </section>
      </div>

      <h2 className="adm-sec">Оч</h2>
      <div className="adm-stats">
        <Stat label="Өгсөн оч" value={n(s.sparks_c)} note={trend(s.sparks_c, s.sparks_p, P.prev)} />
        <Stat label="Оч өгсөн хүн" value={n(s.givers_c)} note={s.givers_c ? `нэг хүн дунджаар ${(s.sparks_c / s.givers_c).toFixed(1)} оч` : "оч өгөөгүй"} />
        <Stat label="Хуримтлагдсан оч" value={`+${n(s.pts_c)}`} note={s.fines_c ? `−${n(s.fines_c)} хасагдсан` : "хасалт алга"} />
        <Stat label="Түвшинтэй хэрэглэгч" value={`${s.users ? Math.round((leveled / s.users) * 100) : 0}%`} note={`${n(leveled)} хүн 1-р түвшнээс дээш`} />
      </div>
      <section className="adm-card">
        <div className="adm-card-head"><b>Түвшний тархалт</b></div>
        <PctList rows={levels} />
      </section>

      <h2 className="adm-sec">Спам байж болзошгүй үйлдэл</h2>
      <section className="adm-card">
        <div className="adm-card-head">
          <b>{n(suspect)} сэжигтэй үйлдэл</b>
          <span className="ss-grow" />
          <small className="adm-muted">1000 үйлдэлд {per1000.toFixed(1)} · нийт {n(actions)} үйлдэл</small>
        </div>
        <ul className="ov-spam">
          <li><span>Ижил сэтгэгдлийг давтан бичсэн</span><b>{n(spam.dup)}</b></li>
          <li><span>Нэг минутад 5+ сэтгэгдэл бичсэн</span><b>{n(spam.burst)}</b></li>
          <li><span>Нэг минутад 10+ оч өгсөн</span><b>{n(spam.spark_burst)}</b></li>
          <li><span>Бүртгүүлсэн өдөртөө 10+ сэтгэгдэл бичсэн шинэ хэрэглэгч</span><b>{n(spam.fresh)}</b></li>
          <li><span>Редакц нуусан контент</span><b>{n(spam.removed)}</b></li>
          <li><span>Хэрэглэгчид өгсөн сануулга</span><b>{n(spam.warnings)}</b></li>
          <li><span>Ирсэн гомдол, мэдэгдэл</span><b>{n(spam.reports)}</b>{spam.reports > 0 && <Link href="/admin/logic" className="adm-link">Гомдол →</Link>}</li>
        </ul>
      </section>
    </>
  );
}
