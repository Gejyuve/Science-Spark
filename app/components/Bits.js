// Жижиг дахин ашиглах хэсгүүд: аватар, оч/дагагчийн тоо
const COLORS = ["#37C3B3", "#5B8DEF", "#F59E0B", "#E5484D", "#8E6CEF", "#00A89B", "#EF6C9C"];

export function fmtK(n) {
  n = Number(n) || 0;
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

export function Avatar({ user, size = 40 }) {
  const id = Number(user?.id) || 0;
  const letter = (user?.first_name || "?")[0];
  return (
    <span
      className="ss-avatar"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42), background: COLORS[id % COLORS.length] }}
      aria-hidden="true"
    >
      {letter}
    </span>
  );
}

export function Stat({ points = 0, followers = 0 }) {
  return (
    <span className="ss-stat">
      <img src="/icons/spark.svg" width={16} height={16} alt="" />
      <span>{fmtK(points)}</span>
      <i>·</i>
      <img src="/icons/followers.svg" width={13} height={13} alt="" />
      <span>{fmtK(followers)}</span>
    </span>
  );
}
