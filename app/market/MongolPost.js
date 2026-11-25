import { postEstimate, postReady, fmtMnt } from "@/lib/market-shared";

// Монгол шуудангийн хүргэлтийн мөр: худалдан авагчид харагдах үнэ, хугацаа (тарифыг Тохиргооноос)
export default function MongolPost({ tariff = {}, weight, compact = false }) {
  const ready = postReady(tariff);
  const row = (label, ub) => {
    const v = postEstimate(tariff, weight, ub);
    const days = ub ? tariff.ubDays : tariff.aimagDays;
    return (
      <div><dt>{label}</dt><dd>{ready && v ? fmtMnt(v) : "Тарифаар"}{days ? <small> · {days} өдөр</small> : null}</dd></div>
    );
  };
  return (
    <div className={"mk-mp" + (compact ? " compact" : "")}>
      <div className="mk-mp-head">
        <span className="mk-mp-logo" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="20" height="20"><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z M3 7.5 12 12l9-4.5 M12 12v9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
        </span>
        <span><b>Монгол шуудан</b><small>Улсын хэмжээнд хүргэнэ</small></span>
      </div>
      <dl className="mk-mp-rows">
        {row("Улаанбаатар", true)}
        {row("Орон нутаг", false)}
      </dl>
    </div>
  );
}
