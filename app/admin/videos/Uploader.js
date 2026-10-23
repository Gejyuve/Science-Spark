"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Spark from "../../components/Spark";
import { startUpload, cancelUpload, uploadDone } from "./actions";

const MB = 1024 * 1024;

// Видео оруулах: файл хөтчөөс шууд Cloudflare руу явна, явцыг хувиар харуулна
export default function Uploader({ maxBytes, playlists = [], defaultPrice = 100 }) {
  const router = useRouter();
  const fileRef = useRef(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [playlistId, setPlaylistId] = useState("");
  const [cost, setCost] = useState(String(defaultPrice));
  const [featured, setFeatured] = useState(false);
  const [file, setFile] = useState(null);
  const [pct, setPct] = useState(null);
  const [error, setError] = useState("");

  const pick = (f) => {
    setError("");
    if (!f) return setFile(null);
    if (!/^video\//.test(f.type)) return setError("Зөвхөн видео файл сонгоно уу");
    if (f.size > maxBytes) return setError(`Файл хэт том байна (${Math.round(maxBytes / MB)}MB-аас бага)`);
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, "").slice(0, 140));
  };

  async function submit(e) {
    e.preventDefault();
    if (!file || pct !== null) return;
    setError("");
    setPct(0);
    const r = await startUpload({ title, body, playlistId, cost, featured }).catch(() => ({ error: "Холболт тасарлаа" }));
    if (r.error) { setPct(null); return setError(r.error); }
    const ok = await new Promise((res) => {
      const fd = new FormData();
      fd.append("file", file);
      const x = new XMLHttpRequest();
      x.open("POST", r.uploadURL);
      x.upload.onprogress = (ev) => ev.lengthComputable && setPct(Math.round((ev.loaded / ev.total) * 100));
      x.onload = () => res(x.status >= 200 && x.status < 300);
      x.onerror = () => res(false);
      x.send(fd);
    });
    if (!ok) {
      await cancelUpload(r.id).catch(() => {});
      setPct(null);
      return setError("Видео оруулж чадсангүй. Интернэтээ шалгаад дахин оролдоно уу");
    }
    await uploadDone().catch(() => {});
    setPct(null); setFile(null); setTitle(""); setBody(""); setFeatured(false);
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  }

  const busy = pct !== null;
  return (
    <form className="adm-card vd-up" onSubmit={submit}>
      <div className="adm-card-head"><b>Видео оруулах</b></div>
      <label className={"vd-drop" + (file ? " has" : "")}>
        <input ref={fileRef} type="file" accept="video/*" disabled={busy} onChange={(e) => pick(e.target.files?.[0])} />
        <span className="vd-drop-ico" aria-hidden="true">🎬</span>
        {file ? <span><b>{file.name}</b><small>{(file.size / MB).toFixed(1)} MB</small></span>
          : <span><b>Видео файл сонгох</b><small>MP4, MOV, WEBM · {Math.round(maxBytes / MB)}MB хүртэл</small></span>}
      </label>
      <input className="vd-in" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Гарчиг" maxLength={140} disabled={busy} required />
      <textarea className="vd-in" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Тайлбар (заавал биш)" maxLength={2000} rows={3} disabled={busy} />
      <div className="vd-opts">
        <label><span>Playlist</span>
          <select value={playlistId} onChange={(e) => setPlaylistId(e.target.value)} disabled={busy}>
            <option value="">Playlist-гүй</option>
            {playlists.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </label>
        <label><span>Нээх үнэ (оч, 0 = үнэгүй)</span>
          <input type="number" min={0} max={100000} value={cost} onChange={(e) => setCost(e.target.value)} disabled={busy} />
        </label>
        <label className="adm-check"><input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} disabled={busy} /> Онцлох видео</label>
      </div>
      {error && <p className="vd-err">{error}</p>}
      {busy && <div className="vd-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${pct}%` }} /><span>{pct < 100 ? `${pct}% илгээж байна` : "Дуусгаж байна…"}</span></div>}
      <button type="submit" className="tm-btn" disabled={!file || busy || title.trim().length < 2}>
        {busy ? <span className="spk-btn"><Spark mono size={16} />Оруулж байна…</span> : "Оруулах"}
      </button>
      <p className="vd-hint">Оруулсны дараа Cloudflare видеог хэдэн минут боловсруулна. Бэлэн болмогц танд мэдэгдэл очно.</p>
    </form>
  );
}
