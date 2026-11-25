"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DOC_KINDS, DOC_MAX, DOC_MIME } from "@/lib/merchant-shared";
import Spark from "../components/Spark";

const kb = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1000))}KB`);

// Мерчантын баримт оруулах, жагсаах, хасах. Файл /api/merchant/doc руу шууд очно (нийтэд нээлттэй биш).
export default function Docs({ kinds, initial = [], only = null, readOnly = false }) {
  const router = useRouter();
  const [docs, setDocs] = useState(initial);
  const [kind, setKind] = useState(only || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function upload(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErr("");
    if (!kind) return setErr("Эхлээд баримтын төрлөө сонгоно уу");
    if (file.size > DOC_MAX) return setErr("Файл хэт том байна (4MB-аас бага)");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("kind", kind);
      fd.append("file", file);
      const r = await fetch("/api/merchant/doc", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Файл оруулж чадсангүй");
      setDocs((d) => [...d, j.doc]);
      router.refresh();
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    setErr("");
    const r = await fetch(`/api/merchant/doc/${id}`, { method: "DELETE" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(j.error || "Хасаж чадсангүй");
    setDocs((d) => d.filter((x) => x.id !== id));
    router.refresh();
  }

  const list = only ? docs.filter((d) => d.kind === only) : docs;
  return (
    <div className="mc-docs">
      {list.length > 0 && (
        <ul className="mc-doclist">
          {list.map((d) => (
            <li key={d.id}>
              <span className="mc-docic">{DOC_MIME[d.mime] || "Файл"}</span>
              <span className="mc-docname">
                <a href={`/api/merchant/doc/${d.id}`} target="_blank" rel="noopener">{d.file_name}</a>
                <small>{DOC_KINDS[d.kind]?.label || d.kind} · {kb(d.size)}</small>
              </span>
              {!readOnly && <button type="button" className="mc-link" onClick={() => remove(d.id)}>Хасах</button>}
            </li>
          ))}
        </ul>
      )}
      {!readOnly && (
        <div className="mc-docadd">
          {!only && (
            <div className="pf-select">
              <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Баримтын төрөл">
                <option value="">Баримтын төрөл</option>
                {kinds.map(([k, d]) => <option key={k} value={k}>{d.label}{d.need ? " (заавал)" : ""}</option>)}
              </select>
              <img src="/icons/chev16.svg" width={16} height={16} alt="" />
            </div>
          )}
          <label className={"mc-btn ghost mc-file" + (busy ? " busy" : "")}>
            {busy ? <Spark mono size={16} /> : null}{busy ? "Оруулж байна…" : "Файл хавсаргах"}
            <input type="file" accept="application/pdf,image/jpeg,image/png" onChange={upload} disabled={busy} />
          </label>
        </div>
      )}
      {err && <small className="mc-err">{err}</small>}
    </div>
  );
}
