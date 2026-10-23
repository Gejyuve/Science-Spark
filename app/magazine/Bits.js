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

// Дугаарын 3D дүрс: нүүр, нуруу, хуудасны ирмэг, гэрэл, газрын сүүдэр. Зузаан нь хуудасны тооноос хамаарна.
export function IssueMock({ issue, eager = false, size = "" }) {
  const src = issue.pages > 0 ? `/api/magazine/page?i=${issue.id}&p=1` : null;
  const t = Math.min(18, Math.max(6, Math.round((issue.pages || 40) * 0.14)));
  return (
    <span className={"mz-3d" + (size ? ` ${size}` : "")} style={{ "--t": `${t}px`, ...(src ? { "--img": `url("${src}")` } : {}) }}>
      <span className="mz-book">
        <span className="mz-face">
          {src ? <img src={src} alt={`№${issue.number} дугаарын нүүр`} loading={eager ? "eager" : "lazy"} draggable={false} /> : <i aria-hidden="true">№{issue.number}</i>}
        </span>
        <span className="mz-spine" aria-hidden="true" />
        <span className="mz-edge" aria-hidden="true" />
        <span className="mz-back" aria-hidden="true" />
      </span>
    </span>
  );
}
