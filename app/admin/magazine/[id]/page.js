import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { requireSection } from "@/lib/admin";
import { ISSUE_STATUS, MAX_PAGES } from "@/lib/magazine-shared";
import { fmtMnt } from "@/lib/money";
import Head, { Chip, Flash, Stat } from "../../_c/Head";
import { IssueFields } from "../IssueFields";
import { IssueCover } from "../../../magazine/Bits";
import PdfUploader from "../PdfUploader";
import { saveIssue, setIssueStatus, deleteIssue } from "../actions";

const NEXT = { draft: ["soon", "published"], soon: ["draft", "published"], published: ["archived"], archived: ["published"] };
const ACT = { draft: "Бэлтгэж байна болгох", soon: "«Удахгүй гарна» гэж харуулах", published: "Нийтлэх", archived: "Архивлах" };

// Нэг дугаарыг засах: мэдээлэл, үнэ, PDF оруулах, төлөв
export default async function AdminIssue({ params, searchParams }) {
  const user = await requireSection("magazine");
  if (user.role !== "superadmin") redirect("/admin");
  const [{ id }, { ok, error }] = await Promise.all([params, searchParams]);
  const [i] = await sql`SELECT i.*,
      (SELECT COUNT(*) FROM magazine_unlocks u WHERE u.issue_id = i.id)::int AS buyers,
      (SELECT COALESCE(SUM(paid_mnt), 0) FROM magazine_unlocks u WHERE u.issue_id = i.id)::int AS online,
      (SELECT COALESCE(SUM(qty), 0) FROM magazine_orders o WHERE o.issue_id = i.id AND o.status <> 'cancelled')::int AS copies,
      (SELECT COALESCE(SUM(bytes), 0) FROM magazine_pages p WHERE p.issue_id = i.id)::bigint AS bytes
    FROM magazine_issues i WHERE i.id = ${Number(id) || 0}`;
  if (!i) notFound();
  return (
    <>
      <Head user={user} title={`Сэтгүүл №${i.number}`} sub={i.title} tools={<Link href="/admin/magazine" className="adm-btn">← Бүх дугаар</Link>} />
      <Flash ok={ok} error={error} />
      <div className="adm-stats">
        <Stat label="Төлөв" value={ISSUE_STATUS[i.status]?.[0]} />
        <Stat label="Хуудас" value={i.pages || "—"} note={i.pages ? `${(Number(i.bytes) / 1048576).toFixed(1)} MB` : "PDF оруулаагүй"} />
        <Stat label="Онлайн уншигч" value={i.buyers} note={fmtMnt(i.online)} />
        <Stat label="Биет хувь" value={`${i.copies} ш`} />
      </div>
      <div className="vd-admin-grid">
        <section className="adm-card">
          <div className="adm-card-head"><b>Мэдээлэл, үнэ</b></div>
          <form action={saveIssue} className="vd-form">
            <input type="hidden" name="iid" value={i.id} />
            <IssueFields i={i} />
            <button className="adm-btn teal">Хадгалах</button>
          </form>
        </section>
        <section className="adm-card mz-adm-side">
          <div className="adm-card-head"><b>PDF файл</b>{i.pages > 0 && <Chip tone="ok">{i.pages} хуудас</Chip>}</div>
          <div className="mz-adm-cover"><IssueCover issue={i} /></div>
          <PdfUploader issueId={i.id} maxPages={MAX_PAGES} has={i.pages > 0} />
          <div className="adm-card-head"><b>Төлөв</b><Chip tone={ISSUE_STATUS[i.status]?.[1]}>{ISSUE_STATUS[i.status]?.[0]}</Chip></div>
          <p className="adm-muted">«Удахгүй гарна» үед хэрэглэгчид дугаарын нэрийг харж, нийтлэл, зар байршуулах хүсэлт илгээнэ. Нийтлэхэд хэсэг нийтэд нээлттэй бол бүх хэрэглэгчид мэдэгдэл очно.</p>
          <div className="adm-acts">
            {(NEXT[i.status] || []).map((s) => (
              <form key={s} action={setIssueStatus}>
                <input type="hidden" name="iid" value={i.id} />
                <input type="hidden" name="status" value={s} />
                <button className={"adm-btn" + (s === "published" ? " teal" : "")}>{ACT[s]}</button>
              </form>
            ))}
            <Link href={`/magazine/${i.id}`} className="adm-btn">Сайт дээр харах</Link>
          </div>
          {!i.buyers && !i.copies && (
            <form action={deleteIssue} className="mz-del">
              <input type="hidden" name="iid" value={i.id} />
              <button className="adm-btn danger">Дугаарыг устгах</button>
            </form>
          )}
        </section>
      </div>
    </>
  );
}
