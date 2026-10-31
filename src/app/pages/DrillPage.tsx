/** โมดูล 3: Objection Drill (ฝึกตอบข้ออ้างแบบจับเวลา) */
import { useCallback, useEffect, useRef, useState } from "react";
import { findObjection, objectionGroupLabel, objectionsData } from "../../shared/content.ts";
import { LIMITS } from "../../shared/limits.ts";
import { RUBRIC_KEYS, rubricItem, SKILL_TO_OBJECTION_GROUPS, type RubricKey } from "../../shared/rubric.ts";
import type { ObjectionFeedback } from "../../shared/schemas.ts";
import type { Objection } from "../../shared/types.ts";
import { CopyButton } from "../components/CopyButton.tsx";
import { EmptyState, ErrorNotice, LoadingBlock } from "../components/Feedback.tsx";
import { Icon } from "../components/Icon.tsx";
import { Card, PageTitle } from "../components/Layout.tsx";
import { MicButton } from "../components/MicButton.tsx";
import { ScoreDots } from "../components/ScoreBar.tsx";
import { chipClass, ui } from "../components/ui.ts";
import { api } from "../lib/api.ts";
import { scoreColor } from "../lib/format.ts";
import { newId, progressActions, useProgress } from "../lib/progress.ts";
import { navigate } from "../lib/router.ts";
import { useSpeechRecognition, useSpeechSynthesis } from "../lib/speech.ts";
import { useLocalStorageState } from "../lib/useLocalStorage.ts";

type Phase = "idle" | "answering" | "grading" | "result" | "error";
type Filter = "all" | "review" | string;

const TIME_OPTIONS = [30, 45, 60, 90];

export function DrillPage({ focusParam }: { focusParam: string | null }) {
  const focus = (RUBRIC_KEYS as readonly string[]).includes(focusParam ?? "") ? (focusParam as RubricKey) : null;
  const progress = useProgress();
  const [filter, setFilter] = useState<Filter>("all");
  const [timeLimit, setTimeLimit] = useLocalStorageState("tsr.drillSeconds", LIMITS.defaultDrillSeconds);
  const [readAloud, setReadAloud] = useLocalStorageState("tsr.drillTts", true);
  const [phase, setPhase] = useState<Phase>("idle");
  const [current, setCurrent] = useState<Objection | null>(null);
  const [answer, setAnswer] = useState("");
  const [remaining, setRemaining] = useState(timeLimit);
  const [result, setResult] = useState<ObjectionFeedback | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [timeTaken, setTimeTaken] = useState(0);
  const startedAt = useRef(0);
  const answerRef = useRef("");
  const submittingRef = useRef(false);
  const tts = useSpeechSynthesis();

  useEffect(() => {
    answerRef.current = answer;
  }, [answer]);

  const onVoice = useCallback((text: string) => {
    setAnswer((prev) => `${prev ? `${prev} ` : ""}${text}`.slice(0, LIMITS.maxDrillAnswerChars));
  }, []);
  const mic = useSpeechRecognition(onVoice);
  const takeTranscript = mic.takeTranscript;
  const cancelSpeech = tts.cancel;

  const reviewIds = progress.reviewObjectionIds.filter((id) => findObjection(id));

  const pool = (): Objection[] => {
    if (filter === "review") return reviewIds.map((id) => findObjection(id)).filter((o): o is Objection => o !== undefined);
    if (filter !== "all") return objectionsData.objections.filter((o) => o.group === filter);
    if (focus) return objectionsData.objections.filter((o) => SKILL_TO_OBJECTION_GROUPS[focus].includes(o.group));
    return objectionsData.objections;
  };

  const begin = (objection: Objection) => {
    tts.unlock();
    mic.cancel();
    setCurrent(objection);
    setAnswer("");
    setResult(null);
    setError(null);
    setRemaining(timeLimit);
    startedAt.current = Date.now();
    submittingRef.current = false;
    setPhase("answering");
    if (readAloud) void tts.speak(objection.text, "female");
  };

  const pickRandom = () => {
    const candidates = pool();
    if (candidates.length === 0) return;
    const withoutCurrent = candidates.length > 1 ? candidates.filter((o) => o.id !== current?.id) : candidates;
    const next = withoutCurrent[Math.floor(Math.random() * withoutCurrent.length)];
    if (next) begin(next);
  };

  const submit = useCallback(
    async (objection: Objection, answerText: string, taken: number) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      // รวมคำพูดที่ไมค์ยังฟังค้างอยู่ (ยังไม่ถึง onend) เข้ากับคำตอบ แล้วหยุดไมค์ทันที
      const live = takeTranscript();
      const finalAnswer = [answerText, live]
        .filter((s) => s.trim())
        .join(" ")
        .trim()
        .slice(0, LIMITS.maxDrillAnswerChars);
      setAnswer(finalAnswer);
      cancelSpeech();
      setTimeTaken(taken);
      setPhase("grading");
      setError(null);
      try {
        const feedback = await api.objection({
          objectionId: objection.id,
          answer: finalAnswer,
          timeTakenSec: taken,
          timeLimitSec: timeLimit,
          focusSkill: focus ?? undefined,
        });
        setResult(feedback);
        setPhase("result");
        progressActions.addDrill({
          id: newId(),
          date: new Date().toISOString(),
          objectionId: objection.id,
          score: feedback.score,
        });
      } catch (err) {
        setError(err);
        setPhase("error");
      } finally {
        submittingRef.current = false;
      }
    },
    [focus, timeLimit, takeTranscript, cancelSpeech],
  );

  // นับถอยหลัง เมื่อหมดเวลาส่งคำตอบอัตโนมัติ
  useEffect(() => {
    if (phase !== "answering" || !current) return;
    const id = setInterval(() => {
      const left = Math.max(0, timeLimit - Math.floor((Date.now() - startedAt.current) / 1000));
      setRemaining(left);
      if (left === 0) {
        clearInterval(id);
        void submit(current, answerRef.current, timeLimit);
      }
    }, 250);
    return () => clearInterval(id);
  }, [phase, current, timeLimit, submit]);

  const groups = objectionsData.groups;

  return (
    <div className="space-y-4">
      <PageTitle
        title="ฝึกตอบข้ออ้าง"
        subtitle={`สุ่มข้ออ้างจากคลัง ${objectionsData.objections.length} ข้อ ตอบภายในเวลาที่กำหนด แล้วรับคะแนน 1-5 พร้อมคำตอบต้นแบบ 2 แบบ`}
      />

      {focus && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-gold-500 bg-gold-100 p-3">
          <p className="text-sm text-brand-900">
            <span className="font-semibold">โหมดฝึกจุดอ่อน: {rubricItem(focus).labelTh}</span>
            <br />
            สุ่มเฉพาะข้ออ้างที่เกี่ยวข้อง และ AI จะเน้นคำแนะนำด้านนี้
          </p>
          <button type="button" onClick={() => navigate("/drill")} className={`${ui.link} text-sm`}>
            ออกจากโหมดนี้
          </button>
        </div>
      )}

      {(phase === "idle" || phase === "result" || phase === "error") && (
        <Card>
          <p className="mb-2 text-sm font-semibold text-ink">เลือกหมวด</p>
          <div className="flex flex-wrap gap-2">
            {[{ id: "all", label: focus ? "ตามจุดอ่อน" : "ทุกหมวด" }, ...groups, { id: "review", label: `ต้องทวน (${reviewIds.length})` }].map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setFilter(g.id)}
                aria-pressed={filter === g.id}
                className={chipClass(filter === g.id)}
              >
                {g.label}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-ink">
            <label className="inline-flex items-center gap-2">
              เวลาตอบ
              <select
                value={timeLimit}
                onChange={(e) => setTimeLimit(Number(e.target.value))}
                className="rounded-lg border border-line bg-white px-2 py-1 text-ink focus:border-brand-500 focus:ring-2 focus:ring-brand-300 focus:outline-none"
              >
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t} วินาที
                  </option>
                ))}
              </select>
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input type="checkbox" className="accent-brand-700" checked={readAloud} onChange={(e) => setReadAloud(e.target.checked)} disabled={!tts.supported} />
              อ่านข้ออ้างออกเสียง
            </label>
          </div>
          {filter === "review" && reviewIds.length === 0 ? (
            <div className="mt-3">
              <EmptyState title="ยังไม่มีข้ออ้างที่ต้องทวน">ข้อที่ได้คะแนนต่ำกว่า 3 จะถูกเก็บไว้ที่นี่อัตโนมัติ</EmptyState>
            </div>
          ) : (
            <button
              type="button"
              onClick={pickRandom}
              className={`${ui.btnHero} mt-4`}
            >
              <Icon name={phase === "idle" ? "shuffle" : "arrowRight"} className="h-6 w-6" />
              {phase === "idle" ? "สุ่มข้ออ้าง" : "ข้อต่อไป"}
            </button>
          )}
        </Card>
      )}

      {current && phase !== "idle" && (
        <Card className="border-brand-300">
          <div className="flex items-center justify-between gap-2">
            <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-900">
              หมวด {objectionGroupLabel(current.group)}
            </span>
            {phase === "answering" && (
              <span
                className={`inline-flex items-center gap-1 font-mono text-lg font-bold ${remaining <= 10 ? "text-danger" : "text-ink"}`}
                aria-live="polite"
              >
                <Icon name="clock" className="h-5 w-5" /> {remaining}s
              </span>
            )}
          </div>
          <p className="mt-3 text-xs text-ink-muted">ลูกค้าพูดว่า</p>
          <div className="flex items-start gap-2">
            <p className="flex-1 text-xl font-semibold text-ink">"{current.text}"</p>
            {tts.supported && (
              <button
                type="button"
                onClick={() => void tts.speak(current.text, "female")}
                disabled={mic.listening}
                className="rounded-lg p-2 text-brand-500 hover:bg-brand-50 disabled:opacity-40"
                aria-label="ฟังอีกครั้ง"
              >
                <Icon name="speaker" className="h-5 w-5" />
              </button>
            )}
          </div>
          {phase === "answering" && (
            <>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-brand-100">
                <div
                  className={`h-full transition-all ${remaining <= 10 ? "bg-danger" : "bg-brand-500"}`}
                  style={{ width: `${(remaining / timeLimit) * 100}%` }}
                />
              </div>
              {mic.listening && <p className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-700">กำลังฟัง... {mic.interim}</p>}
              {mic.error && <p className="mt-3 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning-700">{mic.error}</p>}
              {readAloud && tts.error && <p className="mt-3 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning-700">เสียงอ่านข้ออ้าง: {tts.error}</p>}
              <div className="mt-3 flex items-end gap-2">
                <MicButton
                  listening={mic.listening}
                  supported={mic.supported}
                  onClick={() => {
                    // หยุดเสียงอ่านข้ออ้างก่อนเปิดไมค์ ไม่ให้ไมค์เก็บเสียง TTS เข้าคำตอบ
                    if (!mic.listening) tts.cancel();
                    mic.toggle();
                  }}
                />
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value.slice(0, LIMITS.maxDrillAnswerChars))}
                  rows={4}
                  placeholder="พูดหรือพิมพ์คำตอบของคุณ..."
                  className={`${ui.input} min-w-0 flex-1 resize-none`}
                  aria-label="คำตอบของคุณ"
                />
              </div>
              <button
                type="button"
                onClick={() => void submit(current, answer, Math.round((Date.now() - startedAt.current) / 1000))}
                disabled={!answer.trim() && !mic.interim.trim()}
                className={`${ui.btnPrimary} mt-3 w-full`}
              >
                ส่งคำตอบ
              </button>
            </>
          )}
        </Card>
      )}

      {phase === "grading" && <LoadingBlock label="AI โค้ชกำลังให้คะแนน..." hint="ประมาณ 5-15 วินาที" />}

      {phase === "error" && current && (
        <ErrorNotice error={error} onRetry={() => void submit(current, answer, timeTaken)} retryLabel="ส่งคำตอบอีกครั้ง">
          <p className="text-sm">แนวทางจากหัวหน้าทีม: {current.hint}</p>
        </ErrorNotice>
      )}

      {phase === "result" && result && current && (
        <div className="space-y-3">
          <Card>
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm text-ink-muted">คะแนน</p>
                <p className={`text-3xl font-bold ${scoreColor(result.score, 5)}`}>
                  {result.score}
                  <span className="text-lg text-ink-muted">/5</span>
                </p>
              </div>
              <ScoreDots score={result.score} />
            </div>
            <p className="mt-2 text-ink">{result.verdict}</p>
            {result.score < 3 && (
              <p className="mt-2 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning-700">บันทึกไว้ใน "ข้ออ้างที่ต้องทวน" แล้ว</p>
            )}
            {answer.trim() && (
              <div className="mt-3 rounded-xl bg-brand-50 p-3 text-sm text-ink-muted">
                <span className="font-semibold">คำตอบของคุณ ({timeTaken} วินาที):</span> {answer}
              </div>
            )}
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {result.strengths.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-success-700">ทำได้ดี</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink">
                    {result.strengths.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-warning-700">ควรปรับ</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink">
                  {result.improvements.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="mt-3 text-sm text-ink-muted">
              <span className="font-semibold">แนวทางจากหัวหน้าทีม:</span> {current.hint}
            </p>
          </Card>
          {(
            [
              ["แบบนุ่มนวล", result.modelAnswers.gentle],
              ["แบบตรงประเด็น", result.modelAnswers.direct],
            ] as const
          ).map(([label, text]) => (
            <Card key={label}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-brand-700">คำตอบต้นแบบ{label}</p>
                <CopyButton text={text} />
              </div>
              <p className="mt-2 leading-relaxed text-ink">{text}</p>
            </Card>
          ))}
          <button
            type="button"
            onClick={() => begin(current)}
            className={`${ui.btnSecondary} w-full`}
          >
            ลองตอบข้อนี้อีกครั้ง
          </button>
        </div>
      )}

      {reviewIds.length > 0 && phase !== "answering" && phase !== "grading" && (
        <Card>
          <p className="font-semibold text-ink">ข้ออ้างที่ต้องทวน ({reviewIds.length})</p>
          <ul className="mt-2 divide-y divide-line">
            {reviewIds.map((id) => {
              const o = findObjection(id);
              if (!o) return null;
              return (
                <li key={id} className="flex items-center justify-between gap-2 py-2">
                  <span className="text-sm text-ink">"{o.text}"</span>
                  <button type="button" onClick={() => begin(o)} className="shrink-0 rounded-lg bg-brand-100 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-300/60">
                    ฝึกข้อนี้
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
