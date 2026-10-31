import { RUBRIC_KEYS, type RubricKey } from "../../shared/rubric.ts";
import type { CallRecord, ProgressData } from "../../shared/schemas.ts";

/** YYYY-MM-DD ตามเวลาเครื่อง */
export function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** streak รายวัน: นับวันติดต่อกันที่มีการฝึก (สายจำลอง, drill หรือ quiz) */
export function computeStreak(progress: ProgressData, now = new Date()) {
  const days = new Set(
    [...progress.calls, ...progress.drills, ...progress.quizzes].map((r) => localDateKey(new Date(r.date))),
  );
  const practicedToday = days.has(localDateKey(now));
  let cursor = practicedToday ? now : addDays(now, -1);
  let current = 0;
  while (days.has(localDateKey(cursor))) {
    current += 1;
    cursor = addDays(cursor, -1);
  }
  // streak ที่ยาวที่สุด
  const sorted = [...days].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const day of sorted) {
    if (prev && localDateKey(addDays(new Date(`${prev}T12:00:00`), 1)) === day) run += 1;
    else run = 1;
    best = Math.max(best, run);
    prev = day;
  }
  return { current, best, practicedToday, totalDays: days.size };
}

export function averageCategoryScores(calls: CallRecord[]): Record<RubricKey, number> | null {
  if (calls.length === 0) return null;
  const sums = Object.fromEntries(RUBRIC_KEYS.map((k) => [k, 0])) as Record<RubricKey, number>;
  for (const c of calls) for (const k of RUBRIC_KEYS) sums[k] += c.scores[k];
  for (const k of RUBRIC_KEYS) sums[k] = Math.round((sums[k] / calls.length) * 10) / 10;
  return sums;
}

export function weakestCategory(scores: Record<RubricKey, number>): RubricKey {
  return RUBRIC_KEYS.reduce((min, k) => (scores[k] < scores[min] ? k : min), RUBRIC_KEYS[0]);
}

export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}
