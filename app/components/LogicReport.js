"use client";

import { useRef, useState } from "react";
import { reportLogic } from "../posts/actions";

// Figma 621:496 · Логик алдаа мэдэгдэх цонх
export default function LogicReport({ postId, kind, title, loggedIn }) {
  const dlg = useRef(null);
  const [n, setN] = useState(0);
  if (!loggedIn) {
    return (
      <a href="/login" className="ar-iconbtn" title="Логик алдаа мэдэгдэх" aria-label="Логик алдаа мэдэгдэх">
        <img className="ic" src="/icons/logic.svg" width={20} height={20} alt="" />
      </a>
    );
  }
  return (
    <>
      <button type="button" className="ar-iconbtn" title="Логик алдаа мэдэгдэх" aria-label="Логик алдаа мэдэгдэх" onClick={() => dlg.current?.showModal()}>
        <img className="ic" src="/icons/logic.svg" width={20} height={20} alt="" />
      </button>
      <dialog ref={dlg} className="lr-dlg" onClick={(e) => e.target === dlg.current && dlg.current.close()}>
        <form action={reportLogic} className="lr-box">
          <input type="hidden" name="post_id" value={postId} />
          <div className="lr-head">
            <span className="lr-ico"><img className="ic" src="/icons/logic.svg" width={20} height={20} alt="" /></span>
            <div>
              <b>Логик алдаа мэдэгдэх</b>
              <small>Энэ контентод байгаа логик, баримтын алдааг товч бичнэ үү.</small>
            </div>
            <button type="button" className="lr-x" aria-label="Хаах" onClick={() => dlg.current.close()}>×</button>
          </div>
          <div className="lr-post">
            <img className="ic" src="/icons/f_text.svg" width={16} height={16} alt="" />
            <span><small>{kind}</small><b>{title}</b></span>
          </div>
          <label className="lr-field">
            <span>Алдааны тайлбар <em>{n} / 200</em></span>
            <textarea name="body" required minLength={10} maxLength={200} rows={4} onInput={(e) => setN(e.target.value.length)}
              placeholder="Жишээ: 2-р догол дахь тооцоо буруу байна, 3.14159 гэж бичсэн боловч…" />
          </label>
          <p className="lr-note">🔒 Мэдэгдэл зөвхөн редакцад очно. Алдаа шийдвэрлэгдсэн үед танд мэдэгдэл ирнэ.</p>
          <div className="lr-acts">
            <button type="button" className="lr-cancel" onClick={() => dlg.current.close()}>Болих</button>
            <button type="submit" className="lr-send">Илгээх</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
