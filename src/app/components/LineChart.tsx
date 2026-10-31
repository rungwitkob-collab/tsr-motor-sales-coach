/** กราฟเส้นแบบ SVG ขนาดเล็ก (ไม่ใช้ library เพื่อให้ bundle เบา) */
export interface ChartPoint {
  label: string;
  value: number;
}

export function LineChart({ points, max = 100, height = 180 }: { points: ChartPoint[]; max?: number; height?: number }) {
  const width = 600;
  const pad = { top: 16, right: 16, bottom: 28, left: 36 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const x = (i: number) => pad.left + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => pad.top + innerH - (Math.max(0, Math.min(max, v)) / max) * innerH;
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = points.length > 1 ? `${path} L${x(points.length - 1)},${y(0)} L${x(0)},${y(0)} Z` : "";
  const gridValues = [0, max / 2, max];
  const labelEvery = Math.max(1, Math.ceil(points.length / 6));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="กราฟคะแนนรวมย้อนหลัง">
      {gridValues.map((g) => (
        <g key={g}>
          <line x1={pad.left} x2={width - pad.right} y1={y(g)} y2={y(g)} className="stroke-line" strokeDasharray="4 4" />
          <text x={pad.left - 8} y={y(g) + 4} textAnchor="end" fontSize="12" className="fill-ink-muted">
            {g}
          </text>
        </g>
      ))}
      {area && <path d={area} className="fill-brand-300" opacity="0.25" />}
      {points.length > 1 && <path d={path} fill="none" className="stroke-brand-500" strokeWidth="2.5" strokeLinejoin="round" />}
      {points.map((p, i) => (
        <g key={`${p.label}-${i}`}>
          <circle cx={x(i)} cy={y(p.value)} r="4.5" className={p.value >= max * 0.8 ? "fill-gold-500 stroke-gold-700" : "fill-white stroke-brand-500"} strokeWidth="2">
            <title>{`${p.label}: ${p.value}`}</title>
          </circle>
          {i % labelEvery === 0 && (
            <text x={x(i)} y={height - 8} textAnchor="middle" fontSize="11" className="fill-ink-muted">
              {p.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
