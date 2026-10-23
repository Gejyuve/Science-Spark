"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Spark from "../../components/Spark";
import { MAX_PAGES } from "@/lib/magazine-shared";
import { IssueFields } from "./IssueFields";
import { PdfDrop, PdfProgress, uploadPdf } from "./PdfUploader";
import { createIssue } from "./actions";

// Шинэ дугаар нэмэх: мэдээллээ бичээд PDF-ээ сонгоход дугаар үүсч, хуудсууд нь шууд орно
export default function NewIssue({ next }) {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setErr(""); setDone(0); setTotal(0);
    const res = await createIssue(new FormData(e.currentTarget)).catch(() => ({ error: "Хадгалж чадсангүй" }));
    if (res?.error) { setErr(res.error); setBusy(false); return; }
    let msg = "Дугаар нэмэгдлээ";
    if (file) {
      try {
        const n = await uploadPdf(res.id, file, MAX_PAGES, setTotal, () => setDone((d) => d + 1));
        msg = `Дугаар нэмэгдэж, ${n} хуудас орлоо`;
      } catch (x) {
        msg = `Дугаар нэмэгдсэн ч PDF орсонгүй: ${x?.message || "PDF уншиж чадсангүй"}. Энд дахин оруулна уу`;
        router.push(`/admin/magazine/${res.id}?error=${encodeURIComponent(msg)}`);
        return;
      }
    }
    router.push(`/admin/magazine/${res.id}?ok=${encodeURIComponent(msg)}`);
  }

  return (
    <form onSubmit={submit} className="vd-form">
      <IssueFields i={{ number: next }} />
      <div className="vd-f"><span>Сэтгүүлийн PDF</span><PdfDrop file={file} busy={busy} onFile={(f) => { setFile(f); setErr(""); }} /></div>
      {busy && file && <PdfProgress done={done} total={total} />}
      {err && <p className="vd-err">{err}</p>}
      <button className="adm-btn teal spk-btn" disabled={busy}>{busy && <Spark mono size={16} />}{busy ? (file ? "Оруулж байна… хуудсаа хаахгүй байна уу" : "Хадгалж байна…") : file ? "+ Дугаар нэмж, PDF оруулах" : "+ Дугаар нэмэх"}</button>
      {!file && <p className="adm-muted">PDF-ээ дараа нь дугаарын «PDF оруулах» товчоор оруулж болно.</p>}
    </form>
  );
}
