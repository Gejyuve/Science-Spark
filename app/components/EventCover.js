// Эвентийн зураггүй үед төрлөөр нь өнгөт ковер
export const TONE = { Лекц: "blue", Семинар: "blue", Хурал: "orange", Хакатон: "purple", Олимпиад: "purple", Уралдаан: "purple", Уулзалт: "teal", Өдөрлөг: "teal", Сургалт: "blue", Үзэсгэлэн: "orange", Аялал: "green", Бусад: "gray" };
export const GRAD = {
  blue: "linear-gradient(135deg,#0b3a8f,#2f7be0 55%,#4cc3f5)",
  purple: "linear-gradient(135deg,#5b2be0,#4b6cf0 55%,#22d3e6)",
  orange: "linear-gradient(135deg,#c2400d,#f08a24 60%,#ffc65c)",
  teal: "linear-gradient(135deg,#00695f,#00a89b 55%,#5ee6d0)",
  green: "linear-gradient(135deg,#1d5e2f,#2f9e57 55%,#8fdc7a)",
  gray: "linear-gradient(135deg,#2a3b47,#4f6676 60%,#8aa3b3)",
};

export default function Cover({ type, starts }) {
  const tone = TONE[type] || "gray";
  return (
    <div className="ev-cover" style={{ background: GRAD[tone] }}>
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <path d="M100 20 C108 80 120 92 180 100 C120 108 108 120 100 180 C92 120 80 108 20 100 C80 92 92 80 100 20Z" fill="#fff" opacity=".95" />
        <path d="M30 40 c2 8 4 10 12 12 c-8 2 -10 4 -12 12 c-2 -8 -4 -10 -12 -12 c8 -2 10 -4 12 -12Z" fill="#fff" opacity=".8" />
        <path d="M170 150 c2 7 3 8 10 10 c-7 2 -8 3 -10 10 c-2 -7 -3 -8 -10 -10 c7 -2 8 -3 10 -10Z" fill="#fff" opacity=".8" />
      </svg>
      <span>
        <b>{(type || "Эвент").toUpperCase()}</b>
        <small>{starts ? starts.replace("T", " · ").replaceAll("-", ".") : ""}</small>
      </span>
    </div>
  );
}
