/** โมดูล 5: Product Knowledge Quiz */
import { useState } from "react";
import type { QuizQuestion } from "../../shared/schemas.ts";
import { CopyButton } from "../components/CopyButton.tsx";
import { ErrorNotice, LoadingBlock } from "../components/Feedback.tsx";
import { Card, PageTitle } from "../components/Layout.tsx";
import { ScoreBar } from "../components/ScoreBar.tsx";
import { choiceClass, ui } from "../components/ui.ts";
import { SEED_QUIZ } from "../data/seedQuiz.ts";
import { api } from "../lib/api.ts";
import { scoreColor } from "../lib/format.ts";
import { newId, progressActions } from "../lib/progress.ts";

type Mode = "menu" | "loading" | "playing" | "done";
type Source = "seed" | "ai";

const TOPICS = [
  "คละหัวข้อ",
  "ความต่างของประกันชั้น 1 / 2+ / 3+ / 3",
  "พ.ร.บ. คุ้มครองอะไร",
  "ค่าเสียหายส่วนแรก",
  "การระบุชื่อผู้ขับขี่",
  "ส่วนลดประวัติดี",
  "ซ่อมห้าง / ซ่อมอู่ และทุนประกัน",
  "การขายทางโทรศัพท์ตามแนวปฏิบัติ",
];

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** สลับตำแหน่งตัวเลือก เพื่อไม่ให้จำตำแหน่งคำตอบได้ */
function shuffleChoices(q: QuizQuestion): QuizQuestion {
  const order = shuffle([0, 1, 2, 3]);
  return { ...q, choices: order.map((i) => q.choices[i]!), answerIndex: order.indexOf(q.answerIndex) };
}

const LETTERS = ["ก", "ข", "ค", "ง"];

export function QuizPage() {
  const [mode, setMode] = useState<Mode>("menu");
  const [source, setSource] = useState<Source>("seed");
  const [count, setCount] = useState(10);
  const [topic, setTopic] = useState(TOPICS[0]!);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [error, setError] = useState<unknown>(null);

  const begin = (qs: QuizQuestion[], src: Source) => {
    setQuestions(qs);
    setAnswers(qs.map(() => null));
    setIndex(0);
    setSource(src);
    setMode("playing");
  };

  const startSeed = () => {
    setError(null);
    begin(shuffle(SEED_QUIZ).slice(0, Math.min(count, SEED_QUIZ.length)).map(shuffleChoices), "seed");
  };

  const startAi = async () => {
    setError(null);
    setMode("loading");
    try {
      const res = await api.quiz({ count, topic: topic === TOPICS[0] ? undefined : topic });
      begin(res.questions, "ai");
    } catch (err) {
      setError(err);
      setMode("menu");
    }
  };

  const current = questions[index];
  const selected = answers[index] ?? null;
  const correctCount = answers.filter((a, i) => a !== null && a === questions[i]?.answerIndex).length;

  const choose = (choice: number) => {
    if (selected !== null) return;
    setAnswers((prev) => prev.map((a, i) => (i === index ? choice : a)));
  };

  const next = () => {
    if (index + 1 < questions.length) {
      setIndex(index + 1);
      return;
    }
    progressActions.addQuiz({ id: newId(), date: new Date().toISOString(), correct: correctCount, total: questions.length, source });
    setMode("done");
  };

  if (mode === "loading") {
    return (
      <div className="space-y-4">
        <PageTitle title="ควิซความรู้ผลิตภัณฑ์" />
        <LoadingBlock label={`AI กำลังออกข้อสอบ ${count} ข้อ...`} hint="ประมาณ 10-30 วินาที" />
      </div>
    );
  }

  if (mode === "playing" && current) {
    return (
      <div className="space-y-4">
        <PageTitle title="ควิซความรู้ผลิตภัณฑ์" subtitle={source === "ai" ? "โจทย์ใหม่จาก AI" : "ชุดโจทย์ตั้งต้น"} />
        <div className="flex items-center justify-between text-sm text-ink-muted">
          <span>
            ข้อ {index + 1}/{questions.length}
          </span>
          <span className={ui.badge}>{current.topic}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-100">
          <div className="h-full bg-brand-500 transition-all" style={{ width: `${((index + (selected !== null ? 1 : 0)) / questions.length) * 100}%` }} />
        </div>
        <Card>
          <p className="text-lg font-semibold text-ink">{current.question}</p>
          <div className="mt-4 space-y-2">
            {current.choices.map((choice, i) => {
              const answered = selected !== null;
              const isCorrect = i === current.answerIndex;
              const isSelected = i === selected;
              const stateClass = !answered
                ? choiceClass(false)
                : isCorrect
                  ? "rounded-card border-2 border-success bg-success-soft p-3 text-left text-success-700"
                  : isSelected
                    ? "rounded-card border-2 border-danger bg-danger-soft p-3 text-left text-danger-700"
                    : "rounded-card border border-line bg-white p-3 text-left text-ink-muted";
              return (
                <button key={i} type="button" disabled={answered} onClick={() => choose(i)} className={`flex w-full items-start gap-3 ${stateClass}`}>
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                    {LETTERS[i]}
                  </span>
                  <span className="pt-0.5">{choice}</span>
                </button>
              );
            })}
          </div>
          {selected !== null && (
            <div className={`mt-4 ${selected === current.answerIndex ? ui.noticeSuccess : ui.noticeDanger}`}>
              <p className="font-semibold">{selected === current.answerIndex ? "ถูกต้อง" : `ยังไม่ถูก คำตอบคือ ${LETTERS[current.answerIndex]}`}</p>
              <p className="mt-1 text-ink">{current.explanation}</p>
            </div>
          )}
        </Card>
        <button type="button" onClick={next} disabled={selected === null} className={`${ui.btnPrimary} w-full`}>
          {index + 1 < questions.length ? "ข้อต่อไป" : "ดูผลคะแนน"}
        </button>
      </div>
    );
  }

  if (mode === "done") {
    const wrong = questions.filter((q, i) => answers[i] !== q.answerIndex);
    const summaryText = wrong.map((q) => `${q.question}\nคำตอบ: ${q.choices[q.answerIndex]}\n${q.explanation}`).join("\n\n");
    return (
      <div className="space-y-4">
        <PageTitle title="ผลควิซ" />
        <Card className="text-center">
          <p className="text-sm text-ink-muted">ตอบถูก</p>
          <p className={`text-5xl font-bold ${scoreColor(correctCount, questions.length)}`}>
            {correctCount}
            <span className="text-2xl text-ink-muted">/{questions.length}</span>
          </p>
          <div className="mx-auto mt-3 max-w-xs">
            <ScoreBar score={correctCount} max={questions.length} />
          </div>
        </Card>
        {wrong.length > 0 && (
          <Card>
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-semibold text-brand-900">ข้อที่ควรทบทวน ({wrong.length})</h2>
              <CopyButton text={summaryText} label="คัดลอกสรุป" />
            </div>
            <ul className="mt-3 space-y-3">
              {wrong.map((q, i) => (
                <li key={i} className="rounded-xl bg-brand-50 p-3 text-sm">
                  <p className="font-medium text-ink">{q.question}</p>
                  <p className="mt-1 text-success-700">คำตอบ: {q.choices[q.answerIndex]}</p>
                  <p className="mt-1 text-ink-muted">{q.explanation}</p>
                </li>
              ))}
            </ul>
          </Card>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={source === "ai" ? () => void startAi() : startSeed} className={ui.btnPrimary}>
            ทำชุดใหม่อีกครั้ง
          </button>
          <button type="button" onClick={() => setMode("menu")} className={ui.btnSecondary}>
            กลับไปเลือกแบบทดสอบ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageTitle title="ควิซความรู้ผลิตภัณฑ์" subtitle="ทบทวนความต่างของประกันแต่ละชั้น พ.ร.บ. ค่าเสียหายส่วนแรก การระบุผู้ขับขี่ และส่วนลดประวัติดี" />
      {error !== null && (
        <ErrorNotice error={error} onRetry={() => void startAi()}>
          <button type="button" onClick={startSeed} className={`${ui.link} text-sm`}>
            ใช้ชุดโจทย์ตั้งต้นแทน (ไม่ต้องใช้ AI)
          </button>
        </ErrorNotice>
      )}
      <Card>
        <label className="block space-y-1.5">
          <span className={ui.label}>จำนวนข้อ</span>
          <select className={ui.input} value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {[5, 10].map((n) => (
              <option key={n} value={n}>
                {n} ข้อ
              </option>
            ))}
          </select>
        </label>
      </Card>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <h2 className="font-semibold text-brand-900">ชุดโจทย์ตั้งต้น</h2>
          <p className="mt-1 text-sm text-ink-muted">{SEED_QUIZ.length} ข้อที่เตรียมไว้ ใช้ได้ทันทีแม้โควตา AI หมด สุ่มลำดับและตัวเลือกทุกครั้ง</p>
          <button type="button" onClick={startSeed} className={`${ui.btnPrimary} mt-3 w-full`}>
            เริ่มทำชุดตั้งต้น
          </button>
        </Card>
        <Card>
          <h2 className="font-semibold text-brand-900">ให้ AI สร้างโจทย์ใหม่</h2>
          <p className="mt-1 text-sm text-ink-muted">สร้างจากข้อมูลแผนประกันของบริษัท (products.json)</p>
          <select className={`${ui.input} mt-3`} value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="หัวข้อ">
            {TOPICS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => void startAi()} className={`${ui.btnSecondary} mt-3 w-full`}>
            สร้างโจทย์ด้วย AI
          </button>
        </Card>
      </div>
    </div>
  );
}
