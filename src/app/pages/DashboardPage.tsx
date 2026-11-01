/** โมดูล 6: Progress Dashboard (สถิติอย่างเดียว ส่วนตั้งค่า/ย้ายข้อมูลอยู่ที่เมนู "ตั้งค่า") */
import { findObjection } from "../../shared/content.ts";
import { difficultyLabel, RUBRIC, rubricItem } from "../../shared/rubric.ts";
import { EmptyState } from "../components/Feedback.tsx";
import { Icon, type IconName } from "../components/Icon.tsx";
import { Card, PageTitle } from "../components/Layout.tsx";
import { LineChart } from "../components/LineChart.tsx";
import { ScoreBar } from "../components/ScoreBar.tsx";
import { ui } from "../components/ui.ts";
import { formatDuration, formatThaiDate, formatThaiDateTime, scoreColor } from "../lib/format.ts";
import { useProgress } from "../lib/progress.ts";
import { navigate } from "../lib/router.ts";
import { average, averageCategoryScores, computeStreak, weakestCategory } from "../lib/stats.ts";

function StatTile({ label, value, sub, icon, gold }: { label: string; value: string; sub?: string; icon: IconName; gold?: boolean }) {
  return (
    <div className={`rounded-card border p-3 shadow-card ${gold ? "border-gold-500 bg-gold-100" : "border-line bg-white"}`}>
      <div className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
        <Icon name={icon} className={`h-4 w-4 ${gold ? "text-gold-700" : "text-brand-500"}`} />
        {label}
      </div>
      <p className={`mt-1 text-2xl font-bold ${gold ? "text-gold-700" : "text-brand-900"}`}>{value}</p>
      {sub && <p className="text-xs text-ink-muted">{sub}</p>}
    </div>
  );
}

export function DashboardPage() {
  const progress = useProgress();

  const { calls, drills, quizzes } = progress;
  const streak = computeStreak(progress);
  const recentAvg = average(calls.slice(-10).map((c) => c.overallScore));
  const catAvg = averageCategoryScores(calls.slice(-20));
  const weakest = catAvg ? weakestCategory(catAvg) : null;
  const quizAvg = average(quizzes.map((q) => (q.correct / q.total) * 100));
  const drillAvg = drills.length ? (drills.reduce((s, d) => s + d.score, 0) / drills.length).toFixed(1) : null;
  const chartPoints = calls.slice(-30).map((c) => ({ label: formatThaiDate(c.date), value: c.overallScore }));
  const reviewIds = progress.reviewObjectionIds.filter((id) => findObjection(id));
  const isEmpty = calls.length === 0 && drills.length === 0 && quizzes.length === 0;

  return (
    <div className="space-y-4">
      <PageTitle title="สถิติการฝึก" subtitle={`ข้อมูลเก็บในเบราว์เซอร์นี้${progress.traineeName ? ` · ${progress.traineeName}` : ""}`} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile icon="phone" label="สายที่ฝึก" value={String(calls.length)} sub={calls.length ? `ล่าสุด ${formatThaiDate(calls[calls.length - 1]!.date)}` : "ยังไม่มี"} />
        <StatTile icon="chart" label="คะแนนเฉลี่ย 10 สายล่าสุด" value={recentAvg === null ? "-" : String(recentAvg)} sub="เต็ม 100" />
        <StatTile
          icon="flame"
          label="Streak รายวัน"
          value={`${streak.current} วัน`}
          sub={streak.practicedToday ? `ฝึกแล้ววันนี้ · สูงสุด ${streak.best} วัน` : `วันนี้ยังไม่ได้ฝึก · สูงสุด ${streak.best} วัน`}
          gold
        />
        <StatTile
          icon="check"
          label="ข้ออ้าง / ควิซ"
          value={`${drills.length} / ${quizzes.length}`}
          sub={`เฉลี่ย ${drillAvg ?? "-"}/5 · ควิซ ${quizAvg === null ? "-" : `${quizAvg}%`}`}
        />
      </div>

      {isEmpty ? (
        <EmptyState title="ยังไม่มีข้อมูลการฝึก">
          <p>เริ่มโทรหาลูกค้าจำลองสายแรก แล้วกราฟและคะแนนจะแสดงที่นี่</p>
          <button type="button" onClick={() => navigate("/")} className={`${ui.btnPrimary} mt-3`}>
            เริ่มฝึกโทร
          </button>
        </EmptyState>
      ) : (
        <>
          <Card>
            <h2 className="font-semibold text-brand-900">คะแนนรวมย้อนหลัง</h2>
            {chartPoints.length ? (
              <div className="mt-2">
                <LineChart points={chartPoints} />
              </div>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">ยังไม่มีสายที่ประเมิน</p>
            )}
          </Card>

          {catAvg && weakest && (
            <Card>
              <h2 className="font-semibold text-brand-900">คะแนนเฉลี่ยรายด้าน (20 สายล่าสุด)</h2>
              <div className="mt-3 space-y-3">
                {RUBRIC.map((r) => (
                  <ScoreBar key={r.key} score={catAvg[r.key]} max={10} label={`${r.labelTh}${r.key === weakest ? " (จุดอ่อน)" : ""}`} />
                ))}
              </div>
              <button type="button" onClick={() => navigate("/drill", { focus: weakest })} className={`${ui.btnGold} mt-4 w-full`}>
                ฝึกจุดอ่อน: {rubricItem(weakest).labelTh}
              </button>
            </Card>
          )}

          {reviewIds.length > 0 && (
            <Card>
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold text-brand-900">ข้ออ้างที่ต้องทวน ({reviewIds.length})</h2>
                <a href="#/drill" className={`${ui.link} text-sm`}>
                  ไปฝึก
                </a>
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink">
                {reviewIds.slice(0, 5).map((id) => (
                  <li key={id}>"{findObjection(id)?.text}"</li>
                ))}
              </ul>
            </Card>
          )}

          {calls.length > 0 && (
            <Card>
              <h2 className="font-semibold text-brand-900">สายล่าสุด</h2>
              <ul className="mt-2 divide-y divide-line">
                {calls
                  .slice(-10)
                  .reverse()
                  .map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{c.personaName}</p>
                        <p className="text-xs text-ink-muted">
                          {formatThaiDateTime(c.date)} · ระดับ{difficultyLabel(c.difficulty)} · {formatDuration(c.durationSec)} นาที · {c.turns} รอบ
                        </p>
                        {c.complianceFlagged && (
                          <span className="mt-1 inline-block rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger-700">
                            Compliance risk
                          </span>
                        )}
                      </div>
                      <span className={`shrink-0 text-xl font-bold ${scoreColor(c.overallScore, 100)}`}>{c.overallScore}</span>
                    </li>
                  ))}
              </ul>
            </Card>
          )}
        </>
      )}

      <p className="text-center text-xs text-ink-muted">
        เสียงลูกค้า รุ่น AI ชื่อผู้ฝึก และการ Export/Import ข้อมูล ย้ายไปอยู่ที่เมนู{" "}
        <a href="#/settings" className={ui.link}>
          ตั้งค่า
        </a>
      </p>
    </div>
  );
}
