"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Spark from "../../components/Spark";
import { finishPages } from "./actions";

// pdf.js-ийг public/ дотроос ачаална (зөвхөн энэ хуудсанд, бусад хэрэглэгчид татахгүй)
const PDFJS = "/pdfjs-5.4.624";
const WIDTH = 1600; // хуудасны зургийн өргөн (px): дэлгэцэнд тод, хэвлэхэд хангалтгүй
const MAX_BYTES = 3_800_000;

async function loadPdfjs() {
  const lib = await import(/* webpackIgnore: true */ `${PDFJS}/pdf.min.mjs`);
  lib.GlobalWorkerOptions.workerSrc = `${PDFJS}/pdf.worker.min.mjs`;
  return lib;
}

const toBlob = (canvas, type, q) => new Promise((res) => canvas.toBlob(res, type, q));

// Нэг хуудсыг зураг болгоно. WEBP дэмжихгүй хөтөч (Safari) JPEG-ээр; хэт том бол чанар, хэмжээг багасгана.
async function renderPage(pdf, n) {
  const page = await pdf.getPage(n);
  const base = page.getViewport({ scale: 1 });
  for (const [w, q] of [[WIDTH, 0.86], [WIDTH, 0.72], [1300, 0.7], [1100, 0.65]]) {
    const vp = page.getViewport({ scale: w / base.width });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(vp.width);
    canvas.height = Math.round(vp.height);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    let blob = await toBlob(canvas, "image/webp", q);
    if (!blob || blob.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg", q);
    canvas.width = canvas.height = 0;
    if (blob && blob.size <= MAX_BYTES) return { blob, w: vp.width, h: vp.height };
  }
  throw new Error(`${n}-р хуудас хэт том байна`);
}

async function upload(issueId, n, r) {
  for (let t = 0; t < 4; t++) {
    const fd = new FormData();
    fd.append("issue", issueId);
    fd.append("page", n);
    fd.append("w", Math.round(r.w));
    fd.append("h", Math.round(r.h));
    fd.append("file", r.blob, `p${n}.${r.blob.type === "image/webp" ? "webp" : "jpg"}`);
    const res = await fetch("/api/magazine/upload", { method: "POST", body: fd }).catch(() => null);
    if (res?.ok) return;
    const j = res ? await res.json().catch(() => ({})) : {};
    if (res && res.status < 500 && res.status !== 429) throw new Error(j.error || `${n}-р хуудсыг оруулж чадсангүй`);
    await new Promise((ok) => setTimeout(ok, 1000 * 2 ** t));
  }
  throw new Error(`${n}-р хуудсыг оруулж чадсангүй. Интернэтээ шалгаад дахин оролдоно уу`);
}

// PDF-ийг хөтөч дээр хуудас бүрээр нь зураг болгож оруулна. PDF файл өөрөө сервер рүү явахгүй.
// onTotal(n): хуудасны тоо мэдэгдэхэд, onPage(): нэг хуудас орох бүрт. Оруулсан хуудасны тоог буцаана.
export async function uploadPdf(issueId, file, maxPages, onTotal, onPage) {
  const lib = await loadPdfjs();
  const pdf = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
  const n = pdf.numPages;
  if (n > maxPages) throw new Error(`PDF ${n} хуудастай байна. Дээд тал нь ${maxPages}`);
  onTotal(n);
  // Дараагийн хуудсыг зурж байхад өмнөхийг нь илгээнэ
  let pending = null;
  for (let p = 1; p <= n; p++) {
    const r = await renderPage(pdf, p);
    if (pending) await pending;
    pending = upload(issueId, p, r).then(onPage);
  }
  await pending;
  await pdf.destroy();
  const res = await finishPages(issueId, n);
  if (res?.error) throw new Error(res.error);
  return n;
}

export function PdfDrop({ file, has, busy, onFile }) {
  return (
    <label className={"vd-drop" + (file ? " has" : "")}>
      <input type="file" accept="application/pdf,.pdf" disabled={busy} onChange={(e) => onFile(e.target.files?.[0] || null)} />
      <span className="vd-drop-ico" aria-hidden="true">📄</span>
      <span>
        <b>{file ? file.name : has ? "Шинэ PDF-ээр солих" : "PDF файл сонгох"}</b>
        <small>{file ? `${(file.size / 1048576).toFixed(1)} MB` : "Хуудас бүр тод зураг болж орно. PDF файл өөрөө сайт дээр хадгалагдахгүй"}</small>
      </span>
    </label>
  );
}

export function PdfProgress({ done, total }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return <div className="vd-bar"><i style={{ width: `${pct}%` }} /><span>{total ? `${done}/${total} хуудас · ${pct}%` : "PDF уншиж байна…"}</span></div>;
}

export default function PdfUploader({ issueId, maxPages, has }) {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  async function start() {
    if (!file || busy) return;
    setBusy(true); setErr(""); setOk(""); setDone(0);
    try {
      const n = await uploadPdf(issueId, file, maxPages, setTotal, () => setDone((d) => d + 1));
      setOk(`${n} хуудас орлоо`);
      setFile(null);
      router.refresh();
    } catch (e) {
      setErr(e?.message || "PDF уншиж чадсангүй");
    }
    setBusy(false);
  }

  return (
    <div className="vd-up">
      <PdfDrop file={file} has={has} busy={busy} onFile={(f) => { setFile(f); setErr(""); setOk(""); }} />
      {busy && <PdfProgress done={done} total={total} />}
      {err && <p className="vd-err">{err}</p>}
      {ok && <p className="adm-flash ok">{ok}</p>}
      {file && <button type="button" className="adm-btn teal spk-btn" onClick={start} disabled={busy}>{busy && <Spark mono size={16} />}{busy ? "Оруулж байна… хуудсаа хаахгүй байна уу" : has ? "Хуудсуудыг солих" : "Хуудсуудыг оруулах"}</button>}
    </div>
  );
}
