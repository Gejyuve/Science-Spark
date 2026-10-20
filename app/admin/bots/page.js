import Link from "next/link";
import { requireSuper } from "@/lib/admin";
import { listBots } from "@/lib/bots";
import { levelFor } from "@/lib/levels";
import { fmtDate } from "@/lib/format";
import Head, { Chip, Flash, who } from "../_c/Head";
import { Avatar } from "../../components/Bits";
import { createBot, switchBot } from "./actions";

// Зөвхөн супер админ: бот хаягууд. Ботоор ажиллахдаа сайтад тэр хүн болж нийтэлнэ, оч цуглуулна.
export default async function Bots({ searchParams }) {
  const user = await requireSuper("bots");
  const { ok, error } = await searchParams;
  const bots = await listBots();
  return (
    <>
      <Head user={user} title="Ботууд" sub="Имэйлгүй, зөвхөн супер админ удирддаг хувь хүний хаягууд. Сайтад энгийн хэрэглэгч шиг харагдана." />
      <Flash ok={ok} error={error} />
      <div className="adm-bar">
        <p className="adm-muted bt-note">Бот руу шилжихэд сайт даяар тэр хүнээр нийтэлж, сэтгэгдэл бичиж, оч өгнө. Дээд талын мөрөөс өөртөө буцна. Ботод ирсэн урамшуулал, асуултын шагнал ботын хэтэвчинд орно. Сарын шагналын санд бот оролцохгүй.</p>
        <span className="ss-grow" />
        <form action={createBot}><button className="adm-btn teal">+ Шинэ бот</button></form>
      </div>
      <section className="adm-card flush">
        {bots.length === 0 ? (
          <p className="adm-empty">Одоогоор бот алга. «Шинэ бот» дарж профайлыг нь бөглөнө үү.</p>
        ) : (
          <table className="adm-table">
            <thead><tr><th>Бот</th><th>Түвшин</th><th>Оч</th><th>Дагагч</th><th>Нийтлэл</th><th>Үүсгэсэн</th><th></th></tr></thead>
            <tbody>
              {bots.map((b) => (
                <tr key={b.id}>
                  <td>
                    <span className="adm-user">
                      <Avatar user={b} size={32} />
                      <span><b>{b.first_name ? who(b) : "Нэргүй (профайл бөглөөгүй)"}</b><small>{b.by_first ? `${b.by_initial}.${b.by_first} үүсгэсэн` : ""}</small></span>
                    </span>
                    {b.restricted_at && <Chip tone="bad">Хязгаарласан</Chip>}
                  </td>
                  <td>{levelFor(b.points).n} · {levelFor(b.points).name}</td>
                  <td>{b.points.toLocaleString("en-US")}</td>
                  <td>{b.followers}</td>
                  <td>{b.posts}</td>
                  <td>{fmtDate(b.created_at)}</td>
                  <td className="adm-right">
                    <span className="adm-acts">
                      {b.first_name && <Link href={`/u/${b.id}`} className="adm-btn">Профайл</Link>}
                      <form action={switchBot}>
                        <input type="hidden" name="to" value={b.id} />
                        {!b.first_name && <input type="hidden" name="next" value="/profile/edit" />}
                        <button className="adm-btn teal">Ботоор ажиллах{b.unread > 0 && <em className="bt-unread">{b.unread}</em>}</button>
                      </form>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
