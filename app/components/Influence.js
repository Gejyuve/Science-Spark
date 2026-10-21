import Link from "next/link";
import { influenceList } from "@/lib/referral";
import { Person, followingSet, fmtK } from "./Bits";

// Профайл дээрх «Нөлөөлөл» товч: хэдэн хүнийг Science Spark-д авчирсан
export function InfluenceBtn({ href, n, className = "" }) {
  return (
    <Link href={href} className={"infl-btn " + className} title="Science Spark-ийн тухай эндээс сонсоод нэгдсэн хүмүүс">
      <img src="/icons/influence.svg" width={14} height={14} alt="" />
      Нөлөөлөл <b>{fmtK(n)}</b>
    </Link>
  );
}

// «Нөлөөлөл» жагсаалт: дагагчдын жагсаалт шиг (хүн, клуб, байгууллага бүгд энийг ашиглана)
export async function InfluencePage({ kind, targetId, name, back, me, mine }) {
  const rows = await influenceList(kind, targetId);
  const following = await followingSet(me);
  return (
    <div className="ss-card fl-page">
      <Link href={back} className="infl-back">← {name}</Link>
      <h1>Нөлөөлөл <span className="infl-n">{fmtK(rows.length)}</span></h1>
      <p className="infl-lead">
        {mine ? "Science Spark-ийн тухай танаас сонсоод нэгдсэн хүмүүс. Мэдлэг түгээсэнд баярлалаа!" : "Science Spark-ийн тухай эндээс сонсоод нэгдсэн хүмүүс."}
      </p>
      {rows.length === 0 ? (
        <p className="ss-empty">{mine ? "Одоохондоо танаас сонсоод нэгдсэн хүн алга. «Найзаа урих» холбоосоо хуваалцаарай." : "Одоохондоо эндээс сонсоод нэгдсэн хүн алга."}</p>
      ) : (
        <div className="fl-list">
          {rows.map((p) => <Person key={p.id} {...p} viewer={me} following={following} />)}
        </div>
      )}
    </div>
  );
}
