/** โมดูล 6: Progress Dashboard (เก็บใน localStorage พร้อม export/import JSON) */
import { useRef, useState, type ChangeEvent } from "react";
import { findObjection } from "../../shared/content.ts";
import { difficultyLabel, RUBRIC, rubricItem } from "../../shared/rubric.ts";
import { EmptyState } from "../components/Feedback.tsx";
import { Icon, type IconName } from "../components/Icon.tsx";
import { Card, PageTitle } from "../components/Layout.tsx";
import { LineChart } from "../components/LineChart.tsx";
import { ScoreBar } from "../components/ScoreBar.tsx";
import { ui } from "../components/ui.ts";
import { formatDuration, formatThaiDate, formatThaiDateTime, scoreColor } from "../lib/format.ts";
import { clearPasscode, getTraineeName, setTraineeName } from "../lib/passcode.ts";
import { progressActions, useProgress } from "../lib/progress.ts";
import { navigate } from "../lib/router.ts";
import { parseProgress } from "../lib/storage.ts";
import { average, averageCategoryScores, computeStreak, localDateKey, weakestCategory } from "../lib/stats.ts";

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
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [name, setName] = useState(progress.traineeName || getTraineeName());

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

  const exportJson = () => {
    const data = { ...progress, traineeName: name.trim() || progress.traineeName };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const who = (data.traineeName || "tsr").replace(/[^\p{L}\p{N}_-]+/gu, "-");
    a.href = url;
    a.download = `tsr-progress-${who}-${localDateKey(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage({ kind: "ok", text: "ดาวน์โหลดไฟล์แล้ว ส่งไฟล์นี้ให้หัวหน้าทีมหรือนำไป import ที่เครื่องอื่นได้" });
  };

  const importJson = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setMessage({ kind: "error", text: "ไฟล์ใหญ่เกิน 2 MB" });
      return;
    }
    try {
      const parsed = parseProgress(JSON.parse(await file.text()));
      if (!parsed) {
        setMessage({ kind: "error", text: "ไฟล์ไม่ใช่ข้อมูลสถิติของ TSR Motor Sales Coach หรือรูปแบบไม่ถูกต้อง" });
        return;
      }
      const ok = window.confirm(
        `แทนที่ข้อมูลในเครื่องนี้ (${calls.length} สาย) ด้วยข้อมูลจากไฟล์ (${parsed.calls.length} สาย, ${parsed.drills.length} ข้ออ้าง, ${parsed.quizzes.length} ควิซ)?`,
      );
      if (!ok) return;
      progressActions.replaceAll(parsed);
      if (parsed.traineeName) setName(parsed.traineeName);
      setMessage({ kind: "ok", text: "นำเข้าข้อมูลเรียบร้อย" });
    } catch {
      setMessage({ kind: "error", text: "อ่านไฟล์ไม่ได้ กรุณาเลือกไฟล์ .json ที่ export จากแอปนี้" });
    }
  };

  const resetAll = () => {
    if (window.confirm("ลบสถิติการฝึกทั้งหมดในเครื่องนี้? (แนะนำให้ export เก็บไว้ก่อน)")) {
      progressActions.reset();
      setMessage({ kind: "ok", text: "ล้างข้อมูลแล้ว" });
    }
  };

  const saveName = () => {
    setTraineeName(name);
    progressActions.setTraineeName(name);
    setMessage({ kind: "ok", text: "บันทึกชื่อแล้ว" });
  };

  const logout = () => {
    if (window.confirm("ออกจากระบบ? (สถิติในเครื่องยังอยู่ครบ)")) {
      clearPasscode();
      window.location.reload();
    }
  };

  return (
    <div className="space-y-4">
      <PageTitle title="สถิติการฝึก" subtitle={`ข้อมูลเก็บในเบราว์เซอร์นี้${progress.traineeName ? ` · ${progress.traineeName}` : ""}`} />

      {message && <p className={message.kind === "ok" ? ui.noticeSuccess : ui.noticeDanger}>{message.text}</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile icon="phone" label="สายที่ฝึก" value={String(calls.length)} sub={calls.length ? `ล่าสุด ${formatThaiDate(calls[calls.length - 1]!.date)}` : "ยังไม่มี"} />
        <StatTile icon="chart" label="คะแนนเฉลี่ย 10 สายล่าสุด" value={recentAvg === null ? "-" : String(recentAvg)} sub="เต็ม 100" />
        <StatTile
          icon="objection"
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

      <Card>
        <h2 className="font-semibold text-brand-900">ย้ายเครื่อง / ส่งให้หัวหน้าทีม</h2>
        <p className="mt-1 text-sm text-ink-muted">Export เป็นไฟล์ JSON แล้วนำไป Import ที่เครื่องอื่น หรือส่งให้หัวหน้าทีมดูผลการฝึก</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <button type="button" onClick={exportJson} className={ui.btnPrimary}>
            Export JSON
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} className={ui.btnSecondary}>
            Import JSON
          </button>
          <button type="button" onClick={resetAll} className={`${ui.btnSecondary} text-danger-700`}>
            ล้างข้อมูล
          </button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void importJson(e)} />
      </Card>

      <Card>
        <h2 className="font-semibold text-brand-900">ตั้งค่า</h2>
        <label className="mt-3 block space-y-1.5">
          <span className={ui.label}>ชื่อเล่น / รหัสพนักงาน</span>
          <div className="flex gap-2">
            <input className={ui.input} value={name} onChange={(e) => setName(e.target.value)} maxLength={64} />
            <button type="button" onClick={saveName} className={`${ui.btnSecondary} shrink-0`}>
              บันทึก
            </button>
          </div>
        </label>
        <button type="button" onClick={logout} className={`${ui.link} mt-4 text-sm`}>
          ออกจากระบบ (ล้างรหัสผ่านทีมในเครื่องนี้)
        </button>
      </Card>
    </div>
  );
}
