import Link from "next/link";
import { NOTIFY_TEXT, FROM_EDITORS, FROM_SITE } from "@/lib/notify";
import { relTime } from "@/lib/format";
import { Avatar } from "./Bits";
import { toggleFollow } from "../posts/actions";

const ICON = {
  tip: ["gift", "ok"], prize: ["crown", "ok"], pay_ok: ["gift", "ok"], premium_ok: ["crown", "ok"], pay_no: ["wallet", "gray"], pay_in: ["wallet", "ok"],
  withdraw_ok: ["wallet", "ok"], withdraw_no: ["wallet", "gray"],
  approved: ["f_shield", "ok"], approved_edited: ["f_shield", "ok"], restored: ["f_shield", "ok"],
  rejected: ["logic", "warn"], removed: ["logic", "bad"], deleted: ["logic", "bad"], comment_removed: ["logic", "bad"],
  admin_on: ["shield", "ok"], admin_off: ["shield", "gray"], restricted: ["logic", "bad"], unrestricted: ["f_shield", "ok"], unflagged: ["f_shield", "ok"],
  points_adj: ["pts", "ok"], earned: ["pts", "ok"], limit: ["pts", "warn"],
  logic_ok: ["flag20", "ok"], logic_no: ["flag20", "gray"], complaint_ok: ["flag20", "ok"], complaint_no: ["flag20", "gray"],
  help_ok: ["help", "ok"], help_no: ["help", "gray"],
  welcome: ["pts", "ok"], pw_changed: ["shield", "warn"],
};
const AVATAR_KINDS = ["follow", "comment", "reply", "spark", "comment_spark", "club_invite", "club_join", "club_left", "club_request", "club_ok", "club_no", "club_removed", "club_lead_offer", "club_lead_ok", "club_lead_no", "task_new", "task_done", "help_new"];

// Улаанбаатарын өдрөөр бүлэглэнэ: Шинэ (уншаагүй) · Өнөөдөр · Өчигдөр · Энэ долоо хоног · Өмнө
function groupOf(n) {
  if (!n.read_at) return "Шинэ";
  const day = (d) => Math.floor((new Date(d).getTime() + 8 * 3600000) / 86400000);
  const diff = day(Date.now()) - day(n.created_at);
  if (diff <= 0) return "Өнөөдөр";
  if (diff === 1) return "Өчигдөр";
  if (diff < 7) return "Энэ долоо хоног";
  return "Өмнө";
}

function Item({ n }) {
  const editors = FROM_EDITORS.includes(n.kind) || !n.actor_id;
  const who = n.kind === "tip" && !n.actor_id ? "Нэрээ нууцалсан уншигч" : FROM_SITE.includes(n.kind) ? "Science Spark" : editors ? "Редакц" : `${n.initial}.${n.first_name}`;
  const [ic, tone] = ICON[n.kind] || ["bell", "gray"];
  return (
    <div className={"nf-item" + (n.read_at ? "" : " unread")}>
      <Link href={`/n/${n.id}`} className="nf-link" aria-label="Мэдэгдэл нээх" />
      <span className="nf-ico">
        {AVATAR_KINDS.includes(n.kind) && !editors ? (
          <Avatar user={{ id: n.actor_id, first_name: n.first_name, avatar: n.avatar }} size={36} />
        ) : (
          <i className={"nf-badge " + tone}><img className="ic" src={`/icons/${ic}.svg`} width={18} height={18} alt="" /></i>
        )}
      </span>
      <span className="nf-body">
        <span className="nf-text">
          <b>{who}</b>{FROM_SITE.includes(n.kind) ? "" : " "}{NOTIFY_TEXT[n.kind] || n.kind}
          {n.title && <>: «{n.title}»</>}
        </span>
        {n.note && <span className="nf-note">“{n.note}”</span>}
        <small className={n.read_at ? "" : "fresh"}>{relTime(n.created_at).text}</small>
        {n.kind === "follow" && !n.following_back && n.actor_id && (
          <form action={toggleFollow} className="nf-act">
            <input type="hidden" name="user_id" value={n.actor_id} />
            <button type="submit">Дагах</button>
          </form>
        )}
      </span>
      {!n.read_at && <i className="nf-dot" aria-label="Уншаагүй" />}
    </div>
  );
}

export function NotifList({ items, empty = "Мэдэгдэл алга." }) {
  if (!items.length) return <p className="nf-empty">{empty}</p>;
  const groups = [];
  for (const n of items) {
    const g = groupOf(n);
    if (!groups.length || groups[groups.length - 1][0] !== g) groups.push([g, []]);
    groups[groups.length - 1][1].push(n);
  }
  return (
    <div className="nf-list">
      {groups.map(([g, list], i) => (
        <section key={g + i}>
          <h4 className="nf-group">{g}</h4>
          {list.map((n) => <Item key={n.id} n={n} />)}
        </section>
      ))}
    </div>
  );
}
