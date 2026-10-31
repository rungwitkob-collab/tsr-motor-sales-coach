/** โมดูล 2: Call Evaluation (scorecard หลังจบสาย) */
import type { EvaluateResponse } from "../../shared/api.ts";
import { difficultyLabel, OUTCOME_LABELS, rubricItem, type RubricKey } from "../../shared/rubric.ts";
import type { ChatMessage } from "../../shared/types.ts";
import { CopyButton } from "../components/CopyButton.tsx";
import { Icon } from "../components/Icon.tsx";
import { Card } from "../components/Layout.tsx";
import { ScoreBar } from "../components/ScoreBar.tsx";
import { ui } from "../components/ui.ts";
import { formatDuration, scoreColor } from "../lib/format.ts";

export function EvaluationView({
  result,
  messages,
  durationSec,
  onRetrySame,
  onPracticeWeakness,
  onNewCustomer,
}: {
  result: EvaluateResponse;
  messages: ChatMessage[];
  durationSec: number;
  onRetrySame: () => void;
  onPracticeWeakness: (key: RubricKey) => void;
  onNewCustomer: () => void;
}) {
  const weakest = result.categories.reduce((min, c) => (c.score < min.score ? c : min), result.categories[0]!);
  const h = result.hiddenProfile;
  const turns = messages.filter((m) => m.role === "tsr").length;

  return (
    <div className="space-y-4">
      <Card className="text-center">
        <p className="text-sm text-ink-muted">
          {result.persona.name} · {result.persona.title} · ระดับ{difficultyLabel(result.difficulty)}
        </p>
        <p className={`mt-2 text-6xl font-bold ${scoreColor(result.overallScore, 100)}`}>
          {result.overallScore}
          <span className="text-2xl text-ink-muted">/100</span>
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2 text-sm">
          <span className={result.outcome === "sold" ? ui.badgeGold : ui.badge}>{OUTCOME_LABELS[result.outcome]}</span>
          <span className={ui.badge}>เวลา {formatDuration(durationSec)}</span>
          <span className={ui.badge}>{turns} รอบ</span>
        </div>
        <p className="mt-4 text-left leading-relaxed text-ink">{result.summary}</p>
      </Card>

      {result.compliance.flagged ? (
        <div className="rounded-card border-2 border-danger bg-danger-soft p-4" role="alert">
          <p className="flex items-center gap-2 font-bold text-danger-700">
            <Icon name="warning" className="h-6 w-6" /> Compliance risk: พบความเสี่ยงด้านการปฏิบัติตามกฎ
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6 text-sm text-ink">
            {result.compliance.issues.length > 0 ? (
              result.compliance.issues.map((issue, i) => <li key={i}>{issue}</li>)
            ) : (
              <li>AI พบพฤติกรรมเสี่ยง กรุณาทบทวนการแนะนำตัวและการให้ข้อมูล</li>
            )}
          </ul>
        </div>
      ) : (
        <p className={`${ui.noticeSuccess} flex items-center gap-2`}>
          <Icon name="shield" className="h-5 w-5" /> ไม่พบความเสี่ยงด้าน compliance ในสายนี้
        </p>
      )}

      <section className={ui.cardAccent}>
        <p className="text-sm font-semibold text-brand-700">สิ่งที่ควรฝึกต่อ</p>
        <p className="mt-1 text-ink">{result.nextFocus}</p>
      </section>

      <div className="grid gap-2 sm:grid-cols-3">
        <button type="button" onClick={onRetrySame} className={ui.btnPrimary}>
          ลองใหม่กับ persona เดิม
        </button>
        <button
          type="button"
          onClick={() => onPracticeWeakness(weakest.key)}
          className={ui.btnGold}
        >
          ฝึกจุดอ่อน: {rubricItem(weakest.key).labelTh}
        </button>
        <button type="button" onClick={onNewCustomer} className={ui.btnSecondary}>
          เลือกลูกค้าใหม่
        </button>
      </div>

      <h2 className="pt-2 text-lg font-bold text-brand-900">คะแนนรายด้าน</h2>
      <div className="space-y-3">
        {result.categories.map((cat) => {
          const item = rubricItem(cat.key);
          return (
            <Card key={cat.key} className={cat.key === weakest.key ? "ring-2 ring-gold-500" : ""}>
              <div className="mb-2">
                <p className="font-semibold text-ink">{item.labelTh}</p>
                <p className="text-xs text-ink-muted">{item.label}</p>
              </div>
              <ScoreBar score={cat.score} max={10} label="คะแนน" />
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-semibold text-success-700">ทำได้ดี</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink">
                    {cat.strengths.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-sm font-semibold text-warning-700">ควรปรับ</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink">
                    {cat.improvements.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="mt-3 rounded-xl bg-brand-50 p-3">
                <p className="text-xs font-semibold text-ink-muted">คุณพูดว่า</p>
                <p className="text-sm text-ink-muted italic">"{cat.example.quote || "(ไม่ได้พูดถึงในสายนี้)"}"</p>
                <p className="mt-2 text-xs font-semibold text-brand-700">ควรพูดแทนว่า</p>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-ink">"{cat.example.rewrite}"</p>
                  <CopyButton text={cat.example.rewrite} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <p className="font-semibold text-success-700">ข้อมูลที่ค้นพบ</p>
          {result.discoveredInfo.length ? (
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink">
              {result.discoveredInfo.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-ink-muted">ยังไม่ได้ข้อมูลสำคัญของลูกค้า</p>
          )}
        </Card>
        <Card>
          <p className="font-semibold text-danger-700">ข้อมูลที่พลาดไป</p>
          {result.missedInfo.length ? (
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink">
              {result.missedInfo.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-ink-muted">ถามครบทุกประเด็นสำคัญ</p>
          )}
        </Card>
      </div>

      <details className={ui.card}>
        <summary className="cursor-pointer font-semibold text-brand-900">เฉลยข้อมูลซ่อนของลูกค้า</summary>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-ink-muted">รถ</dt><dd className="text-ink">{h.car} ปี {h.carYear}</dd></div>
          <div><dt className="text-ink-muted">ประกันปัจจุบัน</dt><dd className="text-ink">{h.currentInsurance}</dd></div>
          <div><dt className="text-ink-muted">งบประมาณ</dt><dd className="text-ink">{h.budget}</dd></div>
          <div><dt className="text-ink-muted">การใช้รถ</dt><dd className="text-ink">{h.usage}</dd></div>
          <div><dt className="text-ink-muted">ความกังวล</dt><dd className="text-ink">{h.painPoints.join(", ")}</dd></div>
          <div><dt className="text-ink-muted">ปัจจัยตัดสินใจ</dt><dd className="text-ink">{h.decisionFactors.join(", ")}</dd></div>
          <div className="sm:col-span-2"><dt className="text-ink-muted">ลูกค้าจะซื้อถ้า</dt><dd className="text-ink">{h.willBuyIf}</dd></div>
          <div className="sm:col-span-2"><dt className="text-ink-muted">ลูกค้าจะวางสายถ้า</dt><dd className="text-ink">{h.hangUpIf}</dd></div>
        </dl>
      </details>

      <details className={ui.card}>
        <summary className="cursor-pointer font-semibold text-brand-900">บทสนทนาทั้งหมด</summary>
        <ol className="mt-3 space-y-2 text-sm">
          {messages.map((m, i) => (
            <li key={i} className={m.role === "tsr" ? "text-brand-700" : "text-ink"}>
              <span className="font-semibold">{m.role === "tsr" ? "TSR" : result.persona.name}:</span> {m.text}
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}
