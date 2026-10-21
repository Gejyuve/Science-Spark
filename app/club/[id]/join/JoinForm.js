"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { requestJoin } from "../../../clubs/actions";
import { latinShare, LATIN_LIMIT, LATIN_MSG } from "@/lib/format";
import { countWords } from "@/lib/profile";
import Spark from "../../../components/Spark";

export default function JoinForm({ clubId, blocked, rules }) {
  const [state, action, pending] = useActionState(requestJoin, null);
  const [reason, setReason] = useState("");
  const [agree, setAgree] = useState(false);
  const [more, setMore] = useState(false);
  const words = countWords(reason);
  const bad = words > 100 || latinShare(reason) > LATIN_LIMIT;
  return (
    <form action={action} className="jn-form">
      <input type="hidden" name="club_id" value={clubId} />
      {rules && (
        <div className={"jn-rules" + (more ? " open" : "")}>
          <b>Клубийн дүрэм</b>
          <p>{rules}</p>
          <button type="button" onClick={() => setMore((x) => !x)}>{more ? "Хураах ⌃" : "Үргэлжлүүлж унших ⌄"}</button>
        </div>
      )}
      <label className="jn-label">Нэгдэх шалтгаан <em>Заавал биш</em></label>
      <div className={"pf-area" + (bad ? " bad" : "")}>
        <textarea name="reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} disabled={blocked} placeholder="Клубт нэгдэхийг яагаад хүсч байгаагаа товч бичнэ үү…" />
        <span className={bad ? "bad" : ""}>{latinShare(reason) > LATIN_LIMIT ? LATIN_MSG : `${words} / 100 үг`}</span>
      </div>
      <label className="jn-agree">
        <input type="checkbox" name="agree" checked={agree} onChange={(e) => setAgree(e.target.checked)} disabled={blocked} required
          onInvalid={(e) => e.target.setCustomValidity("Клубийн дүрмийг зөвшөөрнө үү")} onInput={(e) => e.target.setCustomValidity("")} />
        <span>Клубийн дүрмийг уншиж танилцсан, зөвшөөрч байна</span>
      </label>
      {state?.error && <p className="error">{state.error}</p>}
      <button type="submit" className="jn-go" disabled={blocked || pending || bad}>{blocked ? "Нэгдэх боломжгүй" : pending ? <span className="spk-btn"><Spark mono size={16} />Илгээж байна…</span> : "Клубт нэгдэх"}</button>
    </form>
  );
}
