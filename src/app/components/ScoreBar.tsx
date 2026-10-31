import { scoreBarColor, scoreColor } from "../lib/format.ts";

export function ScoreBar({ score, max, label }: { score: number; max: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, (score / max) * 100));
  return (
    <div className="w-full">
      {label && (
        <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
          <span className="text-ink">{label}</span>
          <span className={`font-semibold ${scoreColor(score, max)}`}>
            {score}/{max}
          </span>
        </div>
      )}
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-brand-100"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={score}
        aria-label={label}
      >
        <div className={`h-full rounded-full ${scoreBarColor(score, max)}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function ScoreDots({ score, max = 5 }: { score: number; max?: number }) {
  return (
    <div className="flex gap-1.5" aria-label={`${score} จาก ${max} คะแนน`}>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={`h-4 w-4 rounded-full ${i < score ? scoreBarColor(score, max) : "bg-line"}`}
        />
      ))}
    </div>
  );
}
