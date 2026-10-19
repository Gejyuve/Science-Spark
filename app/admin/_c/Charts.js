// Тоймын энгийн SVG графикууд (сервер дээр зурагдана, сан хэрэглэхгүй)
const W = 640, H = 200, PAD = { l: 36, r: 10, t: 12, b: 26 };
const n = (v) => Number(v || 0).toLocaleString("en-US");
// Тэнхлэгийн товч бичлэг: 60000 → 60k, 1200000 → 1.2M
const short = (v) => (v >= 1e6 ? `${+(v / 1e6).toFixed(1)}M` : v >= 1e4 ? `${+(v / 1e3).toFixed(0)}k` : n(v));

function ticks(max) {
  if (max <= 4) return [0, Math.max(1, max)];
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const nice = [1, 2, 5, 10].map((m) => m * step).find((s) => max / s <= 4) || step * 10;
  const out = [];
  for (let v = 0; v <= max + nice / 2; v += nice) out.push(v);
  return out;
}

// Багана (bars) + шугам (line, өөр тэнхлэг): жишээ нь шинэ хэрэглэгч ба нийт хэрэглэгч
export function GrowthChart({ data, bar, line, barLabel, lineLabel, barColor = "#37c3b3", lineColor = "#0a84ff" }) {
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const bmax = Math.max(1, ...data.map((d) => Number(d[bar]) || 0));
  const bt = ticks(bmax);
  const top = bt[bt.length - 1] || 1;
  const lvals = line ? data.map((d) => Number(d[line]) || 0) : [];
  const lmin = line ? Math.min(...lvals) : 0, lmax = line ? Math.max(...lvals) : 1;
  const ly = (v) => PAD.t + ih - (lmax === lmin ? ih / 2 : ((v - lmin) / (lmax - lmin)) * ih * 0.9 + ih * 0.05);
  const bw = iw / data.length;
  const every = Math.ceil(data.length / 12);
  return (
    <figure className="ov-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={barLabel}>
        {bt.map((v) => {
          const y = PAD.t + ih - (v / top) * ih;
          return (
            <g key={v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} className="ov-grid" />
              <text x={PAD.l - 6} y={y + 4} className="ov-ax" textAnchor="end">{short(v)}</text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const v = Number(d[bar]) || 0;
          const h = (v / top) * ih;
          return (
            <g key={i}>
              <rect x={PAD.l + i * bw + bw * 0.15} y={PAD.t + ih - h} width={bw * 0.7} height={Math.max(h, v ? 1.5 : 0)} rx={Math.min(4, bw * 0.2)} fill={barColor}>
                <title>{`${d.label}: ${n(v)} ${barLabel}${line ? ` · ${lineLabel} ${n(d[line])}` : ""}`}</title>
              </rect>
              {i % every === 0 && <text x={PAD.l + i * bw + bw / 2} y={H - 8} className="ov-ax" textAnchor="middle">{d.label}</text>}
            </g>
          );
        })}
        {line && (
          <polyline fill="none" stroke={lineColor} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
            points={data.map((d, i) => `${PAD.l + i * bw + bw / 2},${ly(Number(d[line]) || 0)}`).join(" ")} />
        )}
      </svg>
      <figcaption>
        <span><i style={{ background: barColor }} />{barLabel}</span>
        {line && <span><i className="ln" style={{ background: lineColor }} />{lineLabel}</span>}
      </figcaption>
    </figure>
  );
}

// Хувиар харуулах жагсаалт
export function PctList({ rows, empty = "Мэдээлэл алга", color = "#37c3b3" }) {
  const total = rows.reduce((s, r) => s + Number(r.n || 0), 0);
  if (!total) return <p className="adm-empty">{empty}</p>;
  return (
    <ul className="ov-pct">
      {rows.map((r) => {
        const p = (Number(r.n) / total) * 100;
        return (
          <li key={r.label}>
            <span>{r.label}</span>
            <i><em style={{ width: `${p}%`, background: r.color || color }} /></i>
            <b>{p < 1 && p > 0 ? "<1" : Math.round(p)}%</b>
            <small>{n(r.n)}</small>
          </li>
        );
      })}
    </ul>
  );
}
