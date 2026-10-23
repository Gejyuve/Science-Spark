"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Player from "./Player";
import { unlockVideo } from "./actions";

// Видеоны дээд хэсэг: эхлээд зураг + «Тоглуулах» товч. Эрхтэй бол шууд тоглоно,
// эрхгүй бол очоор, төгрөгөөр нээх эсвэл Дэмжигч болох сонголт гарна.
export default function VideoGate({ v, src, thumb, title, loggedIn, sparks, wallet, autoplay = false }) {
  const [play, setPlay] = useState(false);
  const [ask, setAsk] = useState(false);
  useEffect(() => {
    if (!ask) return;
    const esc = (e) => e.key === "Escape" && setAsk(false);
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [ask]);
  // Нээсний дараа хуудас дахин ачаалагдахад шууд тоглуулна
  useEffect(() => {
    if (v.access) setAsk(false);
    if (autoplay && v.access && src) setPlay(true);
  }, [autoplay, v.access, src]);

  if (play && v.access && src) return <Player src={`${src}&autoplay=true`} title={title} videoId={v.id} track={loggedIn} />;
  const pct = v.seconds > 0 && v.duration > 0 ? Math.min(100, Math.round((v.seconds / v.duration) * 100)) : 0;
  return (
    <>
      <button type="button" className="vg-cover" onClick={() => (v.access ? setPlay(true) : setAsk(true))} aria-label="Тоглуулах">
        {thumb ? <img src={thumb} alt="" /> : <i aria-hidden="true">🎬</i>}
        <span className="vg-play"><b aria-hidden="true" />{pct > 0 ? "Үргэлжлүүлэх" : "Тоглуулах"}</span>
        {v.duration > 0 && <small className="vg-dur">{v.durationText}</small>}
        {pct > 0 && <i className="vc-prog" style={{ width: `${pct}%` }} />}
      </button>
      {ask && (
        <div className="vg-modal" role="dialog" aria-modal="true" aria-label="Видео нээх" onClick={(e) => e.target === e.currentTarget && setAsk(false)}>
          <div className="vg-box">
            <button type="button" className="vg-x" onClick={() => setAsk(false)} aria-label="Хаах">×</button>
            <b className="vg-h">Видеог үзэх</b>
            <p className="vg-p">Нэг удаа нээхэд тань үргэлж үзэх боломжтой. Таны дэмжлэг шинжлэх ухааны контент бүтээгчдэд хүрнэ.</p>
            {!loggedIn ? (
              <Link href="/login" className="vg-opt main"><span>Нэвтрэх</span><small>Нэвтэрч ороод очоор эсвэл төгрөгөөр нээнэ</small></Link>
            ) : (
              <>
                {v.price > 0 && (
                  <form action={unlockVideo}>
                    <input type="hidden" name="vid" value={v.id} />
                    <input type="hidden" name="method" value="spark" />
                    <button className="vg-opt" disabled={sparks < v.price}>
                      <span>✦ {v.price} очоор нээх</span>
                      <small>{sparks < v.price ? `Оч хүрэлцэхгүй: танд ${sparks} оч` : `Танд ${sparks.toLocaleString("en-US")} оч бий. Түвшин тань буурахгүй`}</small>
                    </button>
                  </form>
                )}
                {v.price_mnt > 0 && (wallet >= v.price_mnt ? (
                  <form action={unlockVideo}>
                    <input type="hidden" name="vid" value={v.id} />
                    <input type="hidden" name="method" value="mnt" />
                    <button className="vg-opt">
                      <span>💳 {v.price_mnt.toLocaleString("en-US")}₮ төлөх</span>
                      <small>Хэтэвчнээс: танд {wallet.toLocaleString("en-US")}₮</small>
                    </button>
                  </form>
                ) : (
                  <Link href="/wallet?topup=1" className="vg-opt">
                    <span>💳 {v.price_mnt.toLocaleString("en-US")}₮ төлөх</span>
                    <small>Хэтэвчинд {wallet.toLocaleString("en-US")}₮ байна. Цэнэглээд нээнэ</small>
                  </Link>
                ))}
                <Link href="/san" className="vg-opt gold"><span>⚡ Дэмжигч болох</span><small>Бүх видеог хязгааргүй үзнэ</small></Link>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
