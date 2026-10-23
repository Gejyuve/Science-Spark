"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Spark from "../../components/Spark";
import CategoryPicker from "../../components/CategoryPicker";
import ImageInput from "../../components/ImageInput";
import { startUpload, cancelUpload, uploadDone } from "./actions";

const MB = 1024 * 1024;
const GB = 1024 * MB;
// Cloudflare tus: хэсэг бүр 256KiB-ийн үржвэр байна. 50MB-аар илгээж, тасарвал тухайн хэсгээс нь үргэлжлүүлнэ.
const CHUNK = 50 * MB;
const size = (n) => (n >= GB ? `${(n / GB).toFixed(2)} GB` : `${(n / MB).toFixed(1)} MB`);

function tusRequest(method, url, headers, body, onProgress) {
  return new Promise((res) => {
    const x = new XMLHttpRequest();
    x.open(method, url);
    x.setRequestHeader("Tus-Resumable", "1.0.0");
    for (const [k, v] of Object.entries(headers)) x.setRequestHeader(k, v);
    if (onProgress) x.upload.onprogress = (e) => onProgress(e.loaded);
    x.onload = () => res(x);
    x.onerror = () => res(null);
    x.send(body ?? null);
  });
}

// Файлыг хэсэглэн илгээнэ. Алдаа гарвал серверээс хаана хүртэл хүрснийг асууж (HEAD), 5 хүртэл удаа дахин оролдоно.
async function tusUpload(url, file, onPct) {
  let offset = 0, fails = 0;
  while (offset < file.size) {
    const end = Math.min(offset + CHUNK, file.size);
    const x = await tusRequest("PATCH", url, { "Upload-Offset": String(offset), "Content-Type": "application/offset+octet-stream" }, file.slice(offset, end),
      (loaded) => onPct(Math.min(99, Math.floor(((offset + loaded) / file.size) * 100))));
    if (x && x.status >= 200 && x.status < 300) {
      offset = Number(x.getResponseHeader("Upload-Offset")) || end;
      fails = 0;
      continue;
    }
    if (++fails > 5) return false;
    await new Promise((r) => setTimeout(r, 1000 * 2 ** fails));
    const h = await tusRequest("HEAD", url, {});
    if (h && h.status >= 200 && h.status < 300) offset = Number(h.getResponseHeader("Upload-Offset")) || offset;
  }
  onPct(100);
  return true;
}

// Видеоны контентын талбарууд: оруулах, засах хоёрт ижил
export function VideoFields({ v = {}, tree, authors, playlists, disabled = false }) {
  return (
    <>
      <label className="vd-f"><span>Гарчиг</span><input name="title" defaultValue={v.title || ""} maxLength={140} required disabled={disabled} /></label>
      <label className="vd-f"><span>Дэд гарчиг</span><input name="subtitle" defaultValue={v.subtitle || ""} maxLength={200} placeholder="Нэг өгүүлбэрээр (заавал биш)" disabled={disabled} /></label>
      <label className="vd-f"><span>Тайлбар</span><textarea name="body" defaultValue={v.body || ""} maxLength={5000} rows={4} className="vd-in" placeholder="Картан дээр эхний хэдэн мөр нь харагдана" disabled={disabled} /></label>
      <div className="vd-f"><span>Thumbnail зураг</span>
        <ImageInput name="image" aspect={16 / 9} maxW={1280} variant="drop" initial={v.image_id || null}>
          <span className="wr-ring"><img src="/icons/imgadd.svg" width={26} height={26} alt="" /></span>
          <b>Thumbnail зураг нэмэх</b>
          <small>16:9 харьцаа · 1280×720 px. Оруулахгүй бол видеоны 2 дахь секундын кадр харагдана</small>
        </ImageInput>
      </div>
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
        <label><span>Очоор нээх үнэ <i className="wr-star">*</i></span><input name="price" type="number" min={0} max={100000} required placeholder="Жишээ: 100" defaultValue={v.price ?? ""} disabled={disabled} /></label>
        <label><span>Төгрөгөөр нээх үнэ <i className="wr-star">*</i></span><input name="price_mnt" type="number" min={0} max={1000000} step={100} required placeholder="Жишээ: 3000" defaultValue={v.price_mnt ?? ""} disabled={disabled} /></label>
        <label className="adm-check"><input type="checkbox" name="featured" defaultChecked={!!v.featured} disabled={disabled} /> Онцлох видео</label>
      </div>
      <p className="vd-hint">0 гэж бичвэл тэр аргаар нээх сонголт гарахгүй. Хоёулаа 0 бол видео бүх хүнд үнэгүй. Дэмжигч сарын эрхээрээ (сард 10 видео) нээж болно.</p>
    </>
  );
}

// Видео оруулах: файл хөтчөөс шууд Cloudflare руу явна, явцыг хувиар харуулна
export default function Uploader({ maxBytes, playlists = [], tree, authors }) {
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
    if (f.size > maxBytes) return setError(`Файл хэт том байна (${size(maxBytes)}-аас бага)`);
    setFile(f);
    const t = formRef.current?.elements.title;
    if (t && !t.value) t.value = f.name.replace(/\.[^.]+$/, "").slice(0, 140);
  };

  async function submit(e) {
    e.preventDefault();
    if (!file || pct !== null) return;
    const fields = Object.fromEntries(new FormData(e.currentTarget));
    delete fields.file;
    fields.size = file.size;
    setError("");
    setPct(0);
    const r = await startUpload(fields).catch(() => ({ error: "Холболт тасарлаа" }));
    if (r.error) { setPct(null); return setError(r.error); }
    const ok = await tusUpload(r.uploadURL, file, setPct);
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
  // Оруулж байхад хуудсыг хаах, өөр хуудас руу явахаас сэрэмжлүүлнэ
  useEffect(() => {
    if (!busy) return;
    const warn = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);
  return (
    <form key={key} ref={formRef} className="adm-card vd-up" onSubmit={submit}>
      <div className="adm-card-head"><b>Видео оруулах</b></div>
      <label className={"vd-drop" + (file ? " has" : "")}>
        <input name="file" type="file" accept="video/*" disabled={busy} onChange={(e) => pick(e.target.files?.[0])} />
        <span className="vd-drop-ico" aria-hidden="true">🎬</span>
        {file ? <span><b>{file.name}</b><small>{size(file.size)}</small></span>
          : <span><b>Видео файл сонгох</b><small>MP4, MOV, WEBM · {size(maxBytes)} хүртэл, 3 цаг хүртэл урттай</small></span>}
      </label>
      <VideoFields tree={tree} authors={authors} playlists={playlists} disabled={busy} />
      {error && <p className="vd-err">{error}</p>}
      {busy && <div className="vd-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${pct}%` }} /><span>{pct < 100 ? `${pct}% илгээж байна` : "Дуусгаж байна…"}</span></div>}
      <button type="submit" className="tm-btn" disabled={!file || busy}>
        {busy ? <span className="spk-btn"><Spark mono size={16} />Оруулж байна…</span> : "Оруулах"}
      </button>
      <p className="vd-hint">Том файл хэсэг хэсгээр явна, интернэт түр тасарвал өөрөө үргэлжилнэ. Дуустал энэ хуудсыг хааж болохгүй. Оруулсны дараа Cloudflare видеог хэдэн минут боловсруулна. Бэлэн болмогц танд мэдэгдэл очно.</p>
    </form>
  );
}
