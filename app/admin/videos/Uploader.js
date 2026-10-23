"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Spark from "../../components/Spark";
import CategoryPicker from "../../components/CategoryPicker";
import { startUpload, cancelUpload, uploadDone } from "./actions";

const MB = 1024 * 1024;

// Видеоны контентын талбарууд: оруулах, засах хоёрт ижил
export function VideoFields({ v = {}, tree, authors, playlists, disabled = false }) {
  return (
    <>
      <label className="vd-f"><span>Гарчиг</span><input name="title" defaultValue={v.title || ""} maxLength={140} required disabled={disabled} /></label>
      <label className="vd-f"><span>Дэд гарчиг</span><input name="subtitle" defaultValue={v.subtitle || ""} maxLength={200} placeholder="Нэг өгүүлбэрээр (заавал биш)" disabled={disabled} /></label>
      <label className="vd-f"><span>Тайлбар</span><textarea name="body" defaultValue={v.body || ""} maxLength={5000} rows={4} className="vd-in" placeholder="Картан дээр эхний хэдэн мөр нь харагдана" disabled={disabled} /></label>
      <div className="vd-f"><span>Ангилал</span><CategoryPicker tree={tree} defaultValue={v.category || ""} required={false} compact /></div>
      <div className="vd-opts">
        <label><span>Нийтлэх профайл</span>
          <select name="author" defaultValue={v.author_id || ""} disabled={disabled}>
            {authors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <label><span>Playlist</span>
          <select name="playlist" defaultValue={v.playlist_id || ""} disabled={disabled}>
            <option value="">Playlist-гүй</option>
            {playlists.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </label>
      </div>
      <div className="vd-opts">
        <label><span>Очоор нээх үнэ (0 = сонголтгүй)</span><input name="price" type="number" min={0} max={100000} defaultValue={v.price ?? ""} disabled={disabled} /></label>
        <label><span>Төгрөгөөр нээх үнэ (0 = сонголтгүй)</span><input name="price_mnt" type="number" min={0} max={1000000} step={100} defaultValue={v.price_mnt ?? ""} disabled={disabled} /></label>
        <label className="adm-check"><input type="checkbox" name="featured" defaultChecked={!!v.featured} disabled={disabled} /> Онцлох видео</label>
      </div>
      <p className="vd-hint">Хоёр үнэ хоёулаа 0 бол видео бүх хүнд үнэгүй. Дэмжигчид үргэлж үнэгүй үзнэ.</p>
    </>
  );
}

// Видео оруулах: файл хөтчөөс шууд Cloudflare руу явна, явцыг хувиар харуулна
export default function Uploader({ maxBytes, playlists = [], tree, authors, defaults }) {
  const router = useRouter();
  const formRef = useRef(null);
  const [file, setFile] = useState(null);
  const [pct, setPct] = useState(null);
  const [error, setError] = useState("");
  const [key, setKey] = useState(0);

  const pick = (f) => {
    setError("");
    if (!f) return setFile(null);
    if (!/^video\//.test(f.type)) return setError("Зөвхөн видео файл сонгоно уу");
    if (f.size > maxBytes) return setError(`Файл хэт том байна (${Math.round(maxBytes / MB)}MB-аас бага)`);
    setFile(f);
    const t = formRef.current?.elements.title;
    if (t && !t.value) t.value = f.name.replace(/\.[^.]+$/, "").slice(0, 140);
  };

  async function submit(e) {
    e.preventDefault();
    if (!file || pct !== null) return;
    const fields = Object.fromEntries(new FormData(e.currentTarget));
    delete fields.file;
    setError("");
    setPct(0);
    const r = await startUpload(fields).catch(() => ({ error: "Холболт тасарлаа" }));
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
    setPct(null); setFile(null); setKey((k) => k + 1);
    router.refresh();
  }

  const busy = pct !== null;
  return (
    <form key={key} ref={formRef} className="adm-card vd-up" onSubmit={submit}>
      <div className="adm-card-head"><b>Видео оруулах</b></div>
      <label className={"vd-drop" + (file ? " has" : "")}>
        <input name="file" type="file" accept="video/*" disabled={busy} onChange={(e) => pick(e.target.files?.[0])} />
        <span className="vd-drop-ico" aria-hidden="true">🎬</span>
        {file ? <span><b>{file.name}</b><small>{(file.size / MB).toFixed(1)} MB</small></span>
          : <span><b>Видео файл сонгох</b><small>MP4, MOV, WEBM · {Math.round(maxBytes / MB)}MB хүртэл</small></span>}
      </label>
      <VideoFields v={defaults} tree={tree} authors={authors} playlists={playlists} disabled={busy} />
      {error && <p className="vd-err">{error}</p>}
      {busy && <div className="vd-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${pct}%` }} /><span>{pct < 100 ? `${pct}% илгээж байна` : "Дуусгаж байна…"}</span></div>}
      <button type="submit" className="tm-btn" disabled={!file || busy}>
        {busy ? <span className="spk-btn"><Spark mono size={16} />Оруулж байна…</span> : "Оруулах"}
      </button>
      <p className="vd-hint">Оруулсны дараа Cloudflare видеог хэдэн минут боловсруулна. Бэлэн болмогц танд мэдэгдэл очно.</p>
    </form>
  );
}
