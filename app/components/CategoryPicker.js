"use client";

import { useMemo, useState } from "react";

// Ангилал сонгох: үндсэн ангилал → салбар → дэд салбар… дараалсан сонголт.
// tree: { path, name, kids } (lib/tree.js plainTree). Дор хаяж 2 түвшин (салбар) сонгох шаардлагатай.
export default function CategoryPicker({ tree, name = "category", defaultValue = "", required = true, compact = false }) {
  const [path, setPath] = useState(defaultValue || "");
  const byPath = useMemo(() => {
    const m = new Map();
    (function go(n) { m.set(n.path, n); n.kids.forEach(go); })(tree);
    return m;
  }, [tree]);
  const parts = path ? path.split("/") : [];
  // Сонгосон түвшин бүрийн жагсаалт
  const levels = [];
  let cur = tree;
  for (let i = 0; i <= parts.length; i++) {
    if (!cur || !cur.kids.length) break;
    levels.push({ parent: cur, value: parts[i] ? parts.slice(0, i + 1).join("/") : "" });
    cur = parts[i] ? byPath.get(parts.slice(0, i + 1).join("/")) : null;
  }
  const depth = parts.length;
  const ok = depth >= 2;
  const label = ["Үндсэн ангилал", "Салбар", "Дэд салбар", "Нарийн салбар", "Сэдэв"];
  return (
    <div className={"cat-pick" + (compact ? " compact" : "")}>
      <input type="hidden" name={name} value={ok ? path : ""} />
      {required && (
        <input className="ii-req" tabIndex={-1} aria-hidden="true" required value={ok ? path : ""} onChange={() => {}}
          ref={(el) => el && el.setCustomValidity(ok ? "" : depth === 1 ? "Салбараа сонгоно уу" : "Ангиллаа сонгоно уу")} />
      )}
      {levels.map((lv, i) => (
        <label key={lv.parent.path || "root"} className="cat-sel">
          <span>{label[i] || "Дэд салбар"}{i >= 2 && <em> заавал биш</em>}</span>
          <span className="cat-box">
            <select value={lv.value} onChange={(e) => setPath(e.target.value || parts.slice(0, i).join("/"))}>
              <option value="">{i === 0 ? "Сонгоно уу" : i >= 2 ? "— (энэ түвшинд үлдэх)" : "Сонгоно уу"}</option>
              {lv.parent.kids.map((k) => <option key={k.path} value={k.path}>{k.name}</option>)}
            </select>
            <img src="/icons/chevdown.svg" width={18} height={18} alt="" />
          </span>
        </label>
      ))}
      {depth > 0 && (
        <p className="cat-path">
          {parts.map((_, i) => byPath.get(parts.slice(0, i + 1).join("/"))?.name).join(" › ")}
        </p>
      )}
    </div>
  );
}
