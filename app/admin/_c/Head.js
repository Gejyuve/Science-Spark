import { displayName } from "@/lib/auth";
import { Avatar } from "../../components/Bits";

// Хуудасны толгой: гарчиг, тайлбар, хайлт, хэрэглэгчийн chip
export default function Head({ user, title, sub, search, q, hidden = {}, tag = "Редакц", tools }) {
  return (
    <header className="adm-head">
      <div className="adm-title">
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {tools && <div className="adm-tools">{tools}</div>}
      <span className="ss-grow" />
      {search && (
        <form action={search} method="get" className="adm-search">
          {Object.entries(hidden).map(([k, v]) => v ? <input key={k} type="hidden" name={k} value={v} /> : null)}
          <img className="ic" src="/icons/search.svg" width={16} height={16} alt="" />
          <input className="adm-q" name="q" defaultValue={q || ""} placeholder="Хайх…" aria-label="Хайх" />
        </form>
      )}
      <span className="adm-me">
        <Avatar user={user} size={32} />
        <span>
          <b>{displayName(user)}</b>
          <small>{tag}</small>
        </span>
      </span>
    </header>
  );
}

export function Stat({ label, value, note, tone }) {
  return (
    <div className={"adm-stat" + (tone ? " " + tone : "")}>
      <span>{label}</span>
      <b>{value}</b>
      {note && <small>{note}</small>}
    </div>
  );
}

export function Tabs({ tabs, cur, href }) {
  return (
    <div className="adm-tabs">
      {tabs.map(([k, l, n]) => (
        <a key={k || "all"} href={href(k)} className={(cur || "") === k ? "on" : ""}>
          {l}{n != null && <em>{n}</em>}
        </a>
      ))}
    </div>
  );
}

export function Chip({ tone, children }) {
  return <span className={"adm-pill " + (tone || "")}>{children}</span>;
}

export const STATUS_TONE = { pending: "warn", approved: "teal", published: "ok", rejected: "bad", removed: "gray", merged: "gray" };

export function Flash({ ok, error }) {
  if (error) return <p className="adm-flash bad">{error}</p>;
  if (ok) return <p className="adm-flash ok">{ok}</p>;
  return null;
}

export const who = (r, p = "") =>
  r[p + "first_name"] ? `${r[p + "initial"]}.${r[p + "first_name"]}` : r[p + "email"] || "—";

// Жижиг сонголттой товч: дарахад сонголтууд (холбоос) гарна
export function Pick({ label, value, options, badge }) {
  return (
    <details className="adm-dd">
      <summary>
        <span>{label}:</span> <b>{options.find((o) => o.on)?.label || value}</b>
        {badge > 0 && <em>{badge}</em>}
        <img className="ic" src="/icons/chevdown.svg" width={12} height={12} alt="" />
      </summary>
      <div className="adm-dd-menu">
        {options.map((o) => (
          <a key={o.href} href={o.href} className={o.on ? "on" : ""}>
            {o.label}{o.badge > 0 && <em>{o.badge}</em>}{o.on && <i>✓</i>}
          </a>
        ))}
      </div>
    </details>
  );
}
