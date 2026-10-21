"use client";

import { useEffect, useState } from "react";
import { answerReferral } from "../profile/actions";
import { REFERRAL_REWARD as REWARD } from "@/lib/referral-shared";

// Шинэ профайлын баярын цонхны хамгийн доор: Science Spark-ийн тухай хаанаас олж мэдсэн бэ? (заавал биш)
// Хүн, байгууллага, клубыг нэрээр нь хайж сонгоно. Сонгосон эх сурвалж урамшууллын оч авна.
const TABS = [
  ["person", "👤", "Хувь хүн", "Хүний нэрээр хайх"],
  ["org", "🏛️", "Байгууллага", "Байгууллагын нэрээр хайх"],
  ["club", "🔭", "Клуб", "Клубийн нэрээр хайх"],
];

export default function ReferralAsk() {
  const [kind, setKind] = useState("person");
  const [q, setQ] = useState("");
  const [items, setItems] = useState(null);
  const [pick, setPick] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setItems(null); return; }
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/referral?k=${kind}&q=${encodeURIComponent(term)}`, { signal: ctl.signal });
        setItems((await r.json()).items || []);
      } catch (e) {}
    }, 250);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q, kind]);

  const tab = (k) => { setKind(k); setPick(null); setItems(null); setQ(""); setError(null); };
  const send = async () => {
    if (!pick || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await answerReferral(kind, pick.id);
      if (r?.ok) setDone(r);
      else setError(r?.error || "Алдаа гарлаа");
    } catch (e) {
      setError("Алдаа гарлаа. Дахин оролдоно уу");
    }
    setBusy(false);
  };

  if (done) {
    return (
      <div className="cel-ref done">
        <b>💛 Баярлалаа!</b>
        <small>
          {done.reward
            ? <>«{done.name}» таны ачаар <b>+{done.reward} оч</b> авлаа. Мэдлэг түгээгчдээ талархсанд баярлалаа!</>
            : <>Таны хариултыг бүртгэлээ. Мэдлэг түгээгчдээ талархсанд баярлалаа!</>}
        </small>
      </div>
    );
  }

  const ph = TABS.find((t) => t[0] === kind)[3];
  return (
    <div className="cel-ref">
      <b>Science Spark-ийн тухай хаанаас олж мэдсэн бэ?</b>
      <small>Заавал биш. Танд замыг заасан хүн, байгууллага эсвэл клубыг сонговол тэдэнд <b>+{REWARD} оч</b> урамшуулал очно.</small>
      <div className="cel-ref-tabs" role="tablist">
        {TABS.map(([k, ic, label]) => (
          <button key={k} type="button" role="tab" aria-selected={kind === k} className={kind === k ? "on" : ""} onClick={() => tab(k)}>
            <span aria-hidden="true">{ic}</span> {label}
          </button>
        ))}
      </div>
      {pick ? (
        <div className="cel-ref-pick">
          <Item it={pick} kind={kind} />
          <button type="button" className="cel-ref-chg" onClick={() => setPick(null)}>Солих</button>
        </div>
      ) : (
        <>
          <input className="cel-ref-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={ph} aria-label={ph} maxLength={40} />
          {items && (
            <div className="cel-ref-list">
              {items.length === 0 && <span className="cel-ref-none">Олдсонгүй. Өөр нэрээр хайж үзнэ үү</span>}
              {items.map((it) => (
                <button key={it.id} type="button" onClick={() => { setPick(it); setError(null); }}>
                  <Item it={it} kind={kind} />
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {error && <span className="cel-ref-err">{error}</span>}
      {pick && (
        <button type="button" className="cel-ref-go" onClick={send} disabled={busy}>
          {busy ? "Илгээж байна…" : `✦ +${REWARD} оч илгээх`}
        </button>
      )}
    </div>
  );
}

function Item({ it, kind }) {
  return (
    <span className="cel-ref-it">
      <span className={"cel-ref-img" + (kind === "person" ? " r" : "")}>
        {it.img ? <img src={`/img/${it.img}`} alt="" /> : <span>{(it.name.replace(/^.\./, "")[0] || "?").toUpperCase()}</span>}
      </span>
      <span className="cel-ref-nm">
        <b>{it.name}</b>
        {it.sub && <small>{it.sub}</small>}
      </span>
    </span>
  );
}
