// Дугаарын нүүр (1-р хуудас). Хуудас оруулаагүй бол дугаарын тоотой хоосон нүүр.
export function IssueCover({ issue, eager = false }) {
  return (
    <span className="mz-cover">
      {issue.pages > 0
        ? <img src={`/api/magazine/page?i=${issue.id}&p=1`} alt={`№${issue.number} дугаарын нүүр`} loading={eager ? "eager" : "lazy"} draggable={false} />
        : <i aria-hidden="true">№{issue.number}</i>}
    </span>
  );
}

export const phoneFmt = (p) => String(p || "").replace(/^(\d{4})(\d{4})$/, "$1-$2");

export { IssueMock } from "./Mock";
