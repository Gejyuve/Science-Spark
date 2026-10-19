import Link from "next/link";
import { fmtMnt } from "@/lib/money";
import { waitTone } from "@/lib/bounty";
import { When } from "./Bits";

// «Хэн юу гэв?» хуудасны дээд хэсэг: хариулт хүлээж буй шагналтай асуултууд ба бүх цаг үеийн хамгийн өндөр шагналууд
export default function BountyBoard({ open, top }) {
  return (
    <section className="ss-card bq-board" aria-label="Шагналтай асуултууд">
      <div className="bq-col">
        <h3>🏆 Хариулт хүлээж буй шагналтай асуултууд</h3>
        {open.length ? (
          <ol>
            {open.map((b) => (
              <li key={b.post_id}>
                <Link href={`/post/${b.post_id}`}>{b.title}</Link>
                <span className="bq-row">
                  <b className="bq-chip">{fmtMnt(b.amount)}</b>
                  <When d={b.created_at} size={12} className={`ss-date bq-age ${waitTone(b.created_at)}`} />
                  <small>{b.answers ? `${b.answers} хариулт` : "хариулт алга"}</small>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted">Одоогоор бүх шагналтай асуултад хариулт олдсон. Та асуултаа шагналтай асуугаарай.</p>
        )}
      </div>
      <div className="bq-col">
        <h3>✦ Бүх цаг үеийн хамгийн өндөр шагнал</h3>
        <ol>
          {top.map((b) => (
            <li key={b.post_id}>
              <Link href={`/post/${b.post_id}`}>{b.title}</Link>
              <span className="bq-row">
                <b className={"bq-chip" + (b.status === "awarded" ? " done" : "")}>{fmtMnt(b.amount)}</b>
                <small>{b.status === "awarded" ? <>✓ {b.w_initial}.{b.w_first} хүртсэн</> : "хариулт хүлээж байна"}</small>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
