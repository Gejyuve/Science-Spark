"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { defaultAvatar } from "@/lib/covers";

const COLORS = ["#37C3B3", "#5B8DEF", "#F59E0B", "#E5484D", "#8E6CEF", "#00A89B", "#EF6C9C"];
const POLL = 4000;
const MAX = 1000;
const ROLE = { leader: "Удирдагч", board: "Зөвлөл" };

function Av({ u, size = 32 }) {
  if (u?.avatar) return <img className="ss-avatar" src={`/img/${u.avatar}`} width={size} height={size} alt="" style={{ width: size, height: size, objectFit: "cover" }} />;
  if (Number(u?.id) > 0) return <img className="ss-avatar" src={defaultAvatar(u.id)} width={size} height={size} alt="" style={{ width: size, height: size, objectFit: "cover" }} />;
  return (
    <span className="ss-avatar" aria-hidden="true" style={{ width: size, height: size, fontSize: Math.round(size * 0.42), background: COLORS[(Number(u?.id) || 0) % COLORS.length] }}>
      {(u?.first_name || "?")[0]}
    </span>
  );
}

const ub = (d) => new Date(new Date(d).toLocaleString("en-US", { timeZone: "Asia/Ulaanbaatar" }));
const hm = (d) => ub(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
function dayLabel(d) {
  const x = ub(d), now = ub(Date.now());
  const k = (t) => t.toDateString();
  if (k(x) === k(now)) return "Өнөөдөр";
  if (k(x) === k(new Date(now.getTime() - 864e5))) return "Өчигдөр";
  return `${x.getFullYear()}.${String(x.getMonth() + 1).padStart(2, "0")}.${String(x.getDate()).padStart(2, "0")}`;
}

// Холбоосыг дарж болохоор харуулна (бусад бичвэр энгийн текст хэвээр)
function Body({ text }) {
  const parts = text.split(/(https?:\/\/[^\s<]+[^\s<.,!?)\]])/g);
  return parts.map((p, i) => (i % 2 ? <a key={i} href={p} target="_blank" rel="noopener nofollow ugc">{p.replace(/^https?:\/\/(www\.)?/, "")}</a> : p));
}

// Клубийн групп чат: гишүүд хоорондоо бичнэ. Шинэ мессежийг хэдэн секунд тутам шалгана.
export default function ClubChat({ clubId, me, isLeader, initial, more: initialMore }) {
  const [msgs, setMsgs] = useState(initial);
  const [more, setMore] = useState(initialMore);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [sending, setSending] = useState(false);
  const [fresh, setFresh] = useState(0);
  const list = useRef(null);
  const input = useRef(null);
  const last = useRef(initial.at(-1)?.id || 0);
  const stick = useRef(true);
  const keep = useRef(null);
  const url = `/api/club/${clubId}/chat`;

  const atBottom = () => {
    const el = list.current;
    return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };
  const toBottom = (smooth) => {
    const el = list.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    setFresh(0);
  };

  const merge = useCallback((add, deleted = []) => {
    if (!add.length && !deleted.length) return;
    setMsgs((cur) => {
      const gone = new Set(deleted);
      const have = new Set(cur.map((m) => m.id));
      const next = cur.map((m) => (gone.has(m.id) ? { ...m, body: null } : m)).concat(add.filter((m) => !have.has(m.id)));
      return next;
    });
    if (add.length) last.current = Math.max(last.current, add.at(-1).id);
  }, []);

  const poll = useCallback(async () => {
    try {
      const r = await fetch(`${url}?after=${last.current}`, { cache: "no-store" });
      if (!r.ok) return;
      const d = await r.json();
      stick.current = atBottom();
      merge(d.messages, d.deleted);
      const others = d.messages.filter((m) => m.user?.id !== me.id).length;
      if (!stick.current && others) setFresh((n) => n + others);
    } catch (e) {}
  }, [url, me.id, merge]);

  useEffect(() => {
    let t;
    const tick = async () => {
      if (document.visibilityState === "visible") await poll();
      t = setTimeout(tick, POLL);
    };
    t = setTimeout(tick, POLL);
    const vis = () => document.visibilityState === "visible" && poll();
    document.addEventListener("visibilitychange", vis);
    return () => { clearTimeout(t); document.removeEventListener("visibilitychange", vis); };
  }, [poll]);

  // Эхлэхэд болон шинэ мессеж ирэхэд доош гүйлгэнэ; хуучныг ачаалахад байрлалаа хадгална
  useLayoutEffect(() => {
    const el = list.current;
    if (!el) return;
    if (keep.current != null) { el.scrollTop = el.scrollHeight - keep.current; keep.current = null; return; }
    if (stick.current) el.scrollTop = el.scrollHeight;
  }, [msgs]);

  const older = async () => {
    const first = msgs[0]?.id;
    if (!first) return;
    const r = await fetch(`${url}?before=${first}`, { cache: "no-store" }).catch(() => null);
    if (!r?.ok) return;
    const d = await r.json();
    keep.current = list.current.scrollHeight - list.current.scrollTop;
    setMsgs((cur) => d.messages.filter((m) => !cur.some((c) => c.id === m.id)).concat(cur));
    setMore(d.more);
  };

  const send = async (e) => {
    e?.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setErr("");
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.error || "Илгээж чадсангүй. Дахин оролдоно уу."); return; }
      setText("");
      stick.current = true;
      await poll();
      toBottom(true);
    } catch (e) {
      setErr("Сүлжээний алдаа. Дахин оролдоно уу.");
    } finally {
      setSending(false);
      input.current?.focus();
    }
  };

  const remove = async (id) => {
    if (!confirm("Энэ мессежийг устгах уу?")) return;
    const r = await fetch(`${url}?m=${id}`, { method: "DELETE" }).catch(() => null);
    if (r?.ok) merge([], [id]);
  };

  // Бичих талбарыг агуулгадаа тааруулж өндөрсгөнө
  useLayoutEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }, [text]);

  let prev = null;
  return (
    <div className="ch-box">
      <div className="ch-list" ref={list} onScroll={() => { if (atBottom()) setFresh(0); }} aria-live="polite">
        {more && <button type="button" className="ch-more" onClick={older}>Өмнөх мессежүүд</button>}
        {msgs.length === 0 && (
          <div className="ch-empty">
            <img className="ic" src="/icons/comment.svg" width={36} height={36} alt="" />
            <b>Клубийн чат нээгдлээ</b>
            <span>Гишүүддээ мэндчилгээ илгээж, анхны яриаг эхлүүлээрэй.</span>
          </div>
        )}
        {msgs.map((m) => {
          const day = dayLabel(m.at);
          const newDay = !prev || dayLabel(prev.at) !== day;
          const mine = m.user?.id === me.id;
          const group = !newDay && prev && prev.user?.id === m.user?.id && new Date(m.at) - new Date(prev.at) < 5 * 60e3;
          prev = m;
          return (
            <div key={m.id}>
              {newDay && <div className="ch-day"><span>{day}</span></div>}
              <div className={"ch-msg" + (mine ? " me" : "") + (group ? " grp" : "")}>
                {!mine && (group ? <span className="ch-av-sp" /> : m.user ? <Link href={`/u/${m.user.id}`} className="ch-av"><Av u={m.user} /></Link> : <span className="ch-av"><Av u={null} /></span>)}
                <div className="ch-col">
                  {!mine && !group && (
                    <span className="ch-name">
                      {m.user ? <Link href={`/u/${m.user.id}`}>{m.user.initial}.{m.user.first_name}</Link> : "Хэрэглэгч"}
                      {ROLE[m.role] && <em className={m.role}>{ROLE[m.role]}</em>}
                    </span>
                  )}
                  <div className="ch-row">
                    <div className={"ch-bubble" + (m.body == null ? " gone" : "")}>
                      {m.body == null ? "Мессеж устгагдсан" : <Body text={m.body} />}
                      <time dateTime={new Date(m.at).toISOString()}>{hm(m.at)}</time>
                    </div>
                    {m.body != null && (mine || isLeader) && (
                      <button type="button" className="ch-del" onClick={() => remove(m.id)} title="Устгах" aria-label="Мессеж устгах">✕</button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {fresh > 0 && <button type="button" className="ch-fresh" onClick={() => toBottom(true)}>↓ {fresh} шинэ мессеж</button>}
      <form className="ch-compose" onSubmit={send}>
        <Av u={me} size={36} />
        <div className="ch-field">
          <textarea
            ref={input}
            rows={1}
            value={text}
            maxLength={MAX}
            placeholder="Клубийн гишүүддээ бичих..."
            aria-label="Мессеж"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) send(e); }}
          />
          {text.length > MAX - 100 && <small>{MAX - text.length}</small>}
        </div>
        <button type="submit" className="ch-send" disabled={!text.trim() || sending} aria-label="Илгээх">
          <img src="/icons/arrowr.svg" width={20} height={20} alt="" />
        </button>
      </form>
      {err && <p className="ch-err">{err}</p>}
    </div>
  );
}
