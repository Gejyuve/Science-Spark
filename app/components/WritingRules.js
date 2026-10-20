import { WRITING_TITLE, writingRules, ruleText } from "@/lib/writing";

const LETTERS = "абвгдеёжзиклмнопрстуфхцчшщэюя";

// Бичих самбарын доорх «Нийтлэл, мэдээ бичих дүрэм». Гэрээний хавсралттай ижил текст.
export default function WritingRules({ articleLevel, newsLevel }) {
  const groups = writingRules({ articleLevel, newsLevel });
  return (
    <section className="wr-card wr-rules" id="rules">
      <div className="wr-sec-head">
        <div>
          <h2>{WRITING_TITLE}</h2>
          <p>Бичвэрээ илгээхээсээ өмнө уншаарай. Энэ дүрэм нь Хэрэглэгчийн гэрээний хавсралт бөгөөд Редакц бичвэрийг үүгээр хянана.{" "}
            <a href="/terms#writing" target="_blank" rel="noopener">Гэрээнээс унших ↗</a></p>
        </div>
      </div>
      {groups.map(([id, title, items], i) => {
        let k = 0, sub = 0;
        return (
          <details key={id} className="wr-rule">
            <summary>{i + 1}. {title}</summary>
            {items.map((t) => {
              const isSub = t.startsWith("• ");
              const no = isSub ? `${LETTERS[sub++]})` : `${i + 1}.${++k}.`;
              if (!isSub) sub = 0;
              return <p key={t} className={isSub ? "sub" : ""}><span>{no}</span>{ruleText(isSub ? t.slice(2) : t)}</p>;
            })}
          </details>
        );
      })}
    </section>
  );
}
