import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { requireSection, canSee, STATUS_LABELS, ago, WARN_LIMIT } from "@/lib/admin";
import { ROLE_LABELS } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { levelFor } from "@/lib/levels";
import { REFERRAL_KINDS } from "@/lib/referral";
import { adminSetRole, restrictUser, adjustPoints, warnUser, cancelDeletion, deleteUser } from "../../actions";
import Head, { Chip, Flash, who, STATUS_TONE } from "../../_c/Head";
import { Avatar } from "../../../components/Bits";

export default async function UserDetail({ params, searchParams }) {
  const me = await requireSection("users");
  const { id } = await params;
  const { ok, error } = await searchParams;
  const n = Number(id);
  if (!Number.isInteger(n)) notFound();
  const [u] = await sql`
    SELECT u.*, COALESCE((SELECT SUM(delta) FROM points_ledger WHERE user_id = u.id), 0)::int AS points,
      (SELECT COUNT(*) FROM follows WHERE followee_id = u.id)::int AS followers,
      (SELECT COUNT(*) FROM posts WHERE reviewer_id = u.id AND status IN ('published','approved','rejected'))::int AS reviewed
    FROM users u WHERE u.id = ${n}`;
  if (!u) notFound();
  const posts = await sql`SELECT id, kind, title, status, created_at FROM posts WHERE author_id = ${n} ORDER BY created_at DESC LIMIT 10`;
  const warnings = await sql`SELECT w.note, w.created_at, x.initial, x.first_name, x.email FROM user_warnings w
                             LEFT JOIN users x ON x.id = w.admin_id WHERE w.user_id = ${n} ORDER BY w.created_at`;
  const [ref] = await sql`SELECT r.kind, r.target_id, r.reward, COALESCE(c.name, x.initial || '.' || x.first_name) AS name
                         FROM referrals r LEFT JOIN clubs c ON r.kind <> 'person' AND c.id = r.target_id
                         LEFT JOIN users x ON r.kind = 'person' AND x.id = r.target_id WHERE r.user_id = ${n}`;
  const ledger = await sql`SELECT delta, reason, created_at FROM points_ledger WHERE user_id = ${n} ORDER BY created_at DESC LIMIT 10`;
  const log = canSee(me, "audit")
    ? await sql`SELECT a.action, a.created_at, x.initial, x.first_name, x.email FROM audit_log a
                LEFT JOIN users x ON x.id = a.actor_id
                WHERE a.target_type = 'user' AND a.target_id = ${n} ORDER BY a.created_at DESC LIMIT 10`
    : [];
  const sup = me.role === "superadmin";
  const self = u.id === me.id;
  const protectedUser = self || u.role === "superadmin";
  const canRestrict = !protectedUser && sup;
  const lv = levelFor(u.points);
  const from = `/admin/users/${u.id}`;

  return (
    <>
      <Head user={me} title={who(u)} sub={<Link href="/admin/users">← Хэрэглэгчид</Link>} />
      <Flash ok={ok} error={error} />
      <div className="adm-grid2">
        <section className="adm-card">
          <div className="adm-profile">
            <Avatar user={u} size={56} />
            <div>
              <b>{u.surname ? `${u.surname} ` : ""}{u.first_name || "Нэргүй"}</b>
              <small>{u.email}</small>
              <span className="adm-chips">
                <Chip tone="dark">{ROLE_LABELS[u.role]}</Chip>
                <Chip>{{ person: "Хувь хүн", org: "Байгууллага", club: "Клуб" }[u.account_type] || u.account_type}</Chip>
                {u.restricted_at && <Chip tone="bad">Хязгаарласан</Chip>}
                {u.delete_pending_at && <Chip tone="bad">Устгахаар хүлээгдэж буй</Chip>}
              </span>
            </div>
          </div>
          <dl className="adm-dl">
            <dt>Түвшин</dt><dd>{lv.n} · {lv.name}</dd>
            <dt>Оч</dt><dd>{u.points.toLocaleString("en-US")}</dd>
            <dt>Дагагч</dt><dd>{u.followers}</dd>
            <dt>Хянасан</dt><dd>{u.reviewed}</dd>
            <dt>Бүртгүүлсэн</dt><dd>{fmtDate(u.created_at)}</dd>
            {ref && (<><dt>Хаанаас сонссон</dt><dd>
              <Link href={ref.kind === "person" ? `/u/${ref.target_id}` : `/${ref.kind}/${ref.target_id}`}>{ref.name || "Устгагдсан"}</Link>
              {" · "}{REFERRAL_KINDS[ref.kind]}{ref.reward ? ` · +${ref.reward} оч` : " · оч олгоогүй"}
            </dd></>)}
            {u.restricted_at && (<><dt>Хязгаарласан</dt><dd>{fmtDate(u.restricted_at)} — {u.restrict_note}</dd></>)}
          </dl>
          <span className="adm-acts">
            <Link href={`/u/${u.id}`} className="adm-link">Нийтийн профайл →</Link>
          </span>
        </section>

        <div className="adm-stack">
          <section className="adm-card">
            <div className="adm-card-head"><b>Эрх</b></div>
            {!sup ? (
              <p className="adm-muted">Эрхийг зөвхөн супер админ солино.</p>
            ) : protectedUser ? (
              <p className="adm-muted">{self ? "Өөрийн эрхийг солих боломжгүй." : "Супер админ эрх зөвхөн тохиргоогоор олгогдоно."}</p>
            ) : (
              <form action={adminSetRole} className="adm-inline">
                <input type="hidden" name="user_id" value={u.id} />
                <input type="hidden" name="from" value={from} />
                <select name="role" defaultValue={u.role}>
                  <option value="user">Хэрэглэгч</option>
                  <option value="admin">Админ</option>
                </select>
                <button className="adm-btn dark">Хадгалах</button>
              </form>
            )}
            <p className="adm-muted small">Админ: контент хянаж засах, нуух, клубын даалгавар, тайлан батлах, логик алдаа шийдэх, хэрэглэгчид сануулга өгөх. Санхүүг зөвхөн харна. Эрх, оч, хязгаарлалт, устгах, тохиргоо зөвхөн супер админд.</p>
          </section>

          <section className="adm-card">
            <div className="adm-card-head"><b>Сануулга ({warnings.length}/{WARN_LIMIT})</b></div>
            {warnings.length > 0 && (
              <ul className="adm-feed">
                {warnings.map((w, i) => (
                  <li key={i}><span><b>{i + 1}.</b> {w.note} <small className="adm-muted">· {who(w)}</small></span><small>{fmtDate(w.created_at)}</small></li>
                ))}
              </ul>
            )}
            {u.delete_pending_at ? (
              <p className="adm-banner">Энэ профайл {WARN_LIMIT} сануулга авч устгах дараалалд орсон. Супер админ эцэслэн шийднэ.</p>
            ) : u.role === "user" && !self ? (
              <form action={warnUser} className="adm-inline">
                <input type="hidden" name="user_id" value={u.id} />
                <input name="note" required maxLength={500} placeholder="Шалтгаан (хэрэглэгчид очно)" />
                <button className="adm-btn danger">Сануулга өгөх</button>
              </form>
            ) : (
              <p className="adm-muted">Сануулга зөвхөн энгийн хэрэглэгчид өгнө.</p>
            )}
            <p className="adm-muted small">{WARN_LIMIT} дахь сануулгаар профайл хязгаарлагдаж, устгах дараалалд орно. Устгагдсан имэйлээр дахин бүртгүүлэх боломжгүй.</p>
          </section>

          {sup && !protectedUser && (
            <section className="adm-card">
              <div className="adm-card-head"><b>Профайл устгах</b></div>
              {u.delete_pending_at && (
                <form action={cancelDeletion} className="adm-inline">
                  <input type="hidden" name="user_id" value={u.id} />
                  <button className="adm-btn">Дарааллаас гаргаж сэргээх</button>
                </form>
              )}
              <details className="adm-pop">
                <summary className="adm-btn danger">Эцэслэн устгах</summary>
                <form action={deleteUser} className="adm-form">
                  <input type="hidden" name="user_id" value={u.id} />
                  <input name="note" maxLength={300} placeholder="Шалтгаан (хоосон бол сануулгууд)" />
                  <input name="confirm" required placeholder={`Баталгаажуулах: ${u.email}`} />
                  <button className="adm-btn danger">Устгаж, имэйлийг хаах</button>
                </form>
              </details>
              <p className="adm-muted small">Профайл, нийтлэл, сэтгэгдэл бүгд устаж, буцаах боломжгүй.</p>
            </section>
          )}

          {sup && (
          <section className="adm-card">
            <div className="adm-card-head"><b>Хязгаарлалт</b></div>
            {!canRestrict ? (
              <p className="adm-muted">Энэ хэрэглэгчийг хязгаарлах боломжгүй.</p>
            ) : u.restricted_at ? (
              <form action={restrictUser} className="adm-inline">
                <input type="hidden" name="user_id" value={u.id} />
                <input type="hidden" name="undo" value="1" />
                <button className="adm-btn">Хязгаарлалт цуцлах</button>
              </form>
            ) : (
              <form action={restrictUser} className="adm-inline">
                <input type="hidden" name="user_id" value={u.id} />
                <input name="note" required maxLength={500} placeholder="Шалтгаан (заавал)" />
                <button className="adm-btn danger">Хязгаарлах</button>
              </form>
            )}
            <p className="adm-muted small">Хязгаарлагдсан хэрэглэгч нийтлэл, асуулт, сэтгэгдэл бичих, оч өгөх боломжгүй.</p>
          </section>
          )}

          {me.role === "superadmin" && !self && (
            <section className="adm-card">
              <div className="adm-card-head"><b>Оч нэмэх / хасах</b></div>
              <form action={adjustPoints} className="adm-inline">
                <input type="hidden" name="who" value={u.id} />
                <input type="hidden" name="from" value={from} />
                <input name="delta" type="number" required min={-10000} max={10000} placeholder="±оч" className="adm-num" />
                <input name="note" required maxLength={300} placeholder="Шалтгаан (заавал)" />
                <button className="adm-btn dark">Бичих</button>
              </form>
            </section>
          )}
        </div>
      </div>

      <div className="adm-grid2">
        <section className="adm-card">
          <div className="adm-card-head"><b>Сүүлийн нийтлэлүүд</b></div>
          {posts.length === 0 ? <p className="adm-empty">Нийтлэл алга.</p> : (
            <ul className="adm-feed">
              {posts.map((p) => (
                <li key={p.id}>
                  <Chip tone={STATUS_TONE[p.status]}>{STATUS_LABELS[p.status]}</Chip>
                  <Link href={`/post/${p.id}`}>{p.title}</Link>
                  <small>{ago(p.created_at)}</small>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="adm-card">
          <div className="adm-card-head"><b>Очны түүх</b></div>
          {ledger.length === 0 ? <p className="adm-empty">Бичлэг алга.</p> : (
            <ul className="adm-feed">
              {ledger.map((l, i) => (
                <li key={i}>
                  <b className={l.delta < 0 ? "adm-neg" : "adm-pos"}>{l.delta > 0 ? "+" : ""}{l.delta}</b>
                  <span>{l.reason}</span>
                  <small>{ago(l.created_at)}</small>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {log.length > 0 && (
        <section className="adm-card">
          <div className="adm-card-head"><b>Энэ хэрэглэгч дээрх үйлдлүүд</b></div>
          <ul className="adm-feed">
            {log.map((a, i) => (
              <li key={i}><span><b>{who(a)}</b> · {a.action}</span><small>{ago(a.created_at)}</small></li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
